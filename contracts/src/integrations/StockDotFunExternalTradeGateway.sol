// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {FlapDexAdapterRegistry} from "./flap/FlapDexAdapterRegistry.sol";
import {IFlapDexAdapter} from "./flap/IFlapDexAdapter.sol";

interface IExternalTradeRewardManager {
    /// @notice Record an attributed, eligible trade. Returns reward credits granted.
    function recordTrade(address trader, uint256 quoteValueWei) external returns (uint256 credits);
}

/// @title StockDotFunExternalTradeGateway
/// @notice Single entry point for trading graduated Flap tokens through
///         StockDotFun. Routes to the migrated DEX pool via an APPROVED adapter,
///         proves attribution on-chain (ExternalTradeExecuted), verifies real
///         balance deltas (never trusts router return data), optionally collects
///         an explicitly-disclosed reward-program fee and records reward
///         credits. Custodies no user funds after settlement.
///
///         Security: SafeERC20, ReentrancyGuard, Pausable, Ownable2Step; no
///         delegatecall, no arbitrary external calls, no user-selected router or
///         recipient; adapters/pools are allowlisted in the registry; native
///         refunds returned; zero output and expired orders rejected; reward fee
///         is 0 whenever the reward campaign is inactive.
contract StockDotFunExternalTradeGateway is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SOURCE_FLAP = keccak256("FLAP");
    uint16 public constant MAX_FEE_BPS = 300; // hard cap 3%
    address private constant NATIVE = address(0);

    FlapDexAdapterRegistry public immutable registry;

    address public feeRecipient;
    IExternalTradeRewardManager public rewardManager;
    /// @notice Reward campaign switch. When false: NO reward fee is charged and
    ///         NO credits are recorded (honest "campaign paused").
    bool public rewardsActive;
    uint16 public rewardFeeBps;

    event ExternalTradeExecuted(
        address indexed trader,
        address indexed token,
        address indexed pool,
        address inputToken,
        address outputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 rewardFeePaid,
        uint256 rewardCredits,
        bytes32 source
    );
    event RewardConfigSet(address rewardManager, bool rewardsActive, uint16 rewardFeeBps);
    event FeeRecipientSet(address feeRecipient);

    error Expired();
    error ZeroAmount();
    error ZeroOutput();
    error SlippageExceeded();
    error EthTransferFailed();
    error FeeTooHigh();

    constructor(address registry_, address feeRecipient_, address owner_) Ownable(owner_) {
        registry = FlapDexAdapterRegistry(registry_);
        feeRecipient = feeRecipient_;
    }

    // --------------------------------------------------------------------- //
    //                                 admin                                 //
    // --------------------------------------------------------------------- //

    function setRewardConfig(address rewardManager_, bool rewardsActive_, uint16 rewardFeeBps_) external onlyOwner {
        if (rewardFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        rewardManager = IExternalTradeRewardManager(rewardManager_);
        rewardsActive = rewardsActive_;
        rewardFeeBps = rewardFeeBps_;
        emit RewardConfigSet(rewardManager_, rewardsActive_, rewardFeeBps_);
    }

    function setFeeRecipient(address r) external onlyOwner {
        feeRecipient = r;
        emit FeeRecipientSet(r);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --------------------------------------------------------------------- //
    //                                trading                                //
    // --------------------------------------------------------------------- //

    /// @notice Buy a graduated Flap token with native ETH, attributed to msg.sender.
    function buy(address token, uint256 minOut, uint256 deadline)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256 outputAmount)
    {
        if (block.timestamp > deadline) revert Expired();
        if (msg.value == 0) revert ZeroAmount();
        (address adapter, address pool,,) = registry.resolve(token);

        uint256 fee = _rewardFee(msg.value);
        uint256 swapAmount = msg.value - fee;

        // Delta-verified: measure the trader's own token balance, never trust
        // the adapter/router return value.
        uint256 before = IERC20(token).balanceOf(msg.sender);
        IFlapDexAdapter(adapter).buyWithETH{value: swapAmount}(token, minOut, msg.sender, deadline);
        outputAmount = IERC20(token).balanceOf(msg.sender) - before;
        if (outputAmount == 0) revert ZeroOutput();
        if (outputAmount < minOut) revert SlippageExceeded();

        uint256 credits = _settleFeeAndReward(msg.sender, fee, msg.value);
        emit ExternalTradeExecuted(
            msg.sender, token, pool, NATIVE, token, msg.value, outputAmount, fee, credits, SOURCE_FLAP
        );
    }

    /// @notice Sell a graduated Flap token for native ETH, attributed to msg.sender.
    ///         Requires a one-time token approval to this gateway.
    function sell(address token, uint256 amountIn, uint256 minOut, uint256 deadline)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 outputAmount)
    {
        if (block.timestamp > deadline) revert Expired();
        if (amountIn == 0) revert ZeroAmount();
        (address adapter, address pool,,) = registry.resolve(token);

        // One-hop transfer trader -> adapter (avoids double-taxing tax tokens);
        // the adapter swaps its full received balance.
        IERC20(token).safeTransferFrom(msg.sender, adapter, amountIn);

        uint256 before = address(this).balance;
        IFlapDexAdapter(adapter).sellForETH(token, minOut, address(this), deadline);
        uint256 grossEth = address(this).balance - before;
        if (grossEth == 0) revert ZeroOutput();

        uint256 fee = _rewardFee(grossEth);
        uint256 net = grossEth - fee;
        if (net < minOut) revert SlippageExceeded();

        (bool ok,) = msg.sender.call{value: net}("");
        if (!ok) revert EthTransferFailed();
        outputAmount = net;

        uint256 credits = _settleFeeAndReward(msg.sender, fee, grossEth);
        emit ExternalTradeExecuted(msg.sender, token, pool, token, NATIVE, amountIn, net, fee, credits, SOURCE_FLAP);
    }

    // --------------------------------------------------------------------- //
    //                               internals                               //
    // --------------------------------------------------------------------- //

    /// @dev Reward fee is charged ONLY while the campaign is active.
    function _rewardFee(uint256 amount) internal view returns (uint256) {
        if (!rewardsActive || rewardFeeBps == 0) return 0;
        return (amount * rewardFeeBps) / 10_000;
    }

    /// @dev Forward the fee to the reward-program recipient and record credits.
    ///      Reward recording is best-effort — a manager hiccup never fails the
    ///      trade (the trader already received their output).
    function _settleFeeAndReward(address trader, uint256 fee, uint256 quoteValue) internal returns (uint256 credits) {
        if (fee > 0) {
            (bool ok,) = feeRecipient.call{value: fee}("");
            if (!ok) revert EthTransferFailed();
        }
        if (rewardsActive && address(rewardManager) != address(0)) {
            try rewardManager.recordTrade(trader, quoteValue) returns (uint256 c) {
                credits = c;
            } catch {
                credits = 0;
            }
        }
    }

    /// @dev Accept native ETH only from adapters mid-swap (sell settlement).
    receive() external payable {}
}
