// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IStockConversionAdapter} from "../v2/interfaces/IStockConversion.sol";

interface IWETH2 {
    function deposit() external payable;
}

/// @title ExternalFeeStockAccumulator
/// @notice Self-funds the Flap trading-reward inventory: reward fees skimmed by
///         the StockDotFunExternalTradeGateway (native ETH) accumulate here, and
///         a keeper periodically converts them into supported tokenized stock via
///         the VERIFIED, whitelist-gated stock-conversion adapter — delivered
///         straight into the reward vault. Conversion is batched (amortizes gas +
///         slippage) and can only route to verified stock routes; the accumulator
///         custodies only the pending ETH between conversions.
///
///         Wiring: gateway.setFeeRecipient(thisAccumulator). No gateway change —
///         fees flow here as native ETH via receive().
contract ExternalFeeStockAccumulator is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    IWETH2 public immutable weth;
    IStockConversionAdapter public immutable adapter;
    /// @notice Destination for converted stock (the reward vault's balance =
    ///         its payable inventory).
    address public rewardVault;

    event FeeReceived(address indexed from, uint256 amount);
    event StockAccumulated(address indexed stock, uint256 ethIn, uint256 stockOut, address vault);
    event RewardVaultSet(address vault);
    event Rescued(address indexed token, address to, uint256 amount);

    error ZeroAmount();
    error InsufficientBalance();
    error EthTransferFailed();

    constructor(address weth_, address adapter_, address rewardVault_, address admin) {
        weth = IWETH2(weth_);
        adapter = IStockConversionAdapter(adapter_);
        rewardVault = rewardVault_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(KEEPER_ROLE, admin);
    }

    // ---- admin ----

    function setRewardVault(address v) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardVault = v;
        emit RewardVaultSet(v);
    }

    function setKeeper(address keeper, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) _grantRole(KEEPER_ROLE, keeper);
        else _revokeRole(KEEPER_ROLE, keeper);
    }

    /// @notice Recover stuck assets (e.g. if a conversion route is retired).
    function rescueETH(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
        emit Rescued(address(0), to, amount);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(to, amount);
        emit Rescued(token, to, amount);
    }

    // ---- keeper ----

    function pendingEth() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Convert `ethAmount` of accumulated fees into `stock`, delivered
    ///         into the reward vault. Keeper batches this across the reward
    ///         basket (per weights) off-chain; the adapter enforces the verified
    ///         route, per-conversion size cap and `minStockOut` slippage floor.
    function accumulate(address stock, uint256 ethAmount, uint256 minStockOut, uint256 deadline)
        external
        onlyRole(KEEPER_ROLE)
        nonReentrant
        returns (uint256 stockOut)
    {
        if (ethAmount == 0) revert ZeroAmount();
        if (ethAmount > address(this).balance) revert InsufficientBalance();

        weth.deposit{value: ethAmount}();
        IERC20(address(weth)).forceApprove(address(adapter), ethAmount);
        stockOut = adapter.convert(stock, ethAmount, minStockOut, deadline, rewardVault);
        // defensive: clear residual approval
        IERC20(address(weth)).forceApprove(address(adapter), 0);
        emit StockAccumulated(stock, ethAmount, stockOut, rewardVault);
    }

    receive() external payable {
        emit FeeReceived(msg.sender, msg.value);
    }
}
