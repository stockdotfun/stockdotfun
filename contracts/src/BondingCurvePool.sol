// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRouterAdapter} from "./interfaces/IRouterAdapter.sol";
import {IPlatformControls} from "./interfaces/IPlatformControls.sol";
import {RewardVault} from "./RewardVault.sol";
import {CreatorRewardVault} from "./CreatorRewardVault.sol";

/// @title BondingCurvePool
/// @notice Constant-product bonding curve (virtual reserves) for one meme
///         token, quoted in the platform quote asset (WETH, surfaced as ETH).
///
///         Fees are taken on the quote side of every buy/sell and split:
///           - holder share  -> RewardVault (converted to the paired stock
///                              token via the router adapter when available;
///                              otherwise accrued in quote — fail-safe)
///           - creator share -> CreatorRewardVault, per creator preference
///           - protocol share-> treasury
///
///         Wallet-to-wallet token transfers are untaxed by design.
contract BondingCurvePool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum CreatorPreference {
        ETH, // paid in the quote asset (WETH), unwrappable to ETH 1:1
        STOCK,
        SPLIT
    }

    struct FeeConfig {
        uint16 totalFeeBps; // fee on trade size, capped at MAX_FEE_BPS
        uint16 holderShareBps; // shares of the fee; must sum to 10_000
        uint16 creatorShareBps;
        uint16 protocolShareBps;
    }

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_FEE_BPS = 1_000; // 10% hard cap

    address public immutable factory;
    IERC20 public immutable memeToken;
    IERC20 public immutable quoteAsset;
    IERC20 public immutable stockAsset;
    RewardVault public immutable rewardVault;
    CreatorRewardVault public immutable creatorVault;
    address public immutable treasury;
    address public immutable creator;
    CreatorPreference public immutable creatorPreference;

    FeeConfig public feeConfig;

    /// Virtual reserves define the curve's starting price and depth.
    uint256 public immutable virtualQuote;
    uint256 public immutable virtualToken;
    /// Real reserves held by this pool.
    uint256 public realQuote;

    /// Router for quote -> stock conversion; address(0) = not configured.
    IRouterAdapter public routerAdapter;
    /// Quote raised at which the pool emits Graduated (migration TODO).
    uint256 public immutable graduationTarget;
    bool public graduated;

    event Buy(address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 fee);
    event Sell(address indexed seller, uint256 tokensIn, uint256 quoteOut, uint256 fee);
    event FeeRouted(uint256 holderAmount, address holderAsset, uint256 creatorAmount, uint256 protocolAmount);
    event Graduated(uint256 realQuoteReserve);
    event RouterAdapterUpdated(address adapter);

    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh();
    error SharesInvalid();
    error SlippageExceeded();
    error OnlyFactory();
    error ExceedsCurveDepth();
    error TradingIsPaused();
    error SlippageBoundRequired();
    error RouterMisbehaved();

    /// @dev Grouped constructor args — a single memory struct keeps the
    ///      constructor off the "stack too deep" cliff (14 params otherwise).
    struct InitParams {
        address memeToken;
        address quoteAsset;
        address stockAsset;
        address rewardVault;
        address creatorVault;
        address treasury;
        address creator;
        CreatorPreference creatorPreference;
        FeeConfig feeConfig;
        uint256 virtualQuote;
        uint256 virtualToken;
        uint256 graduationTarget;
        address routerAdapter;
    }

    error InvalidCurveParams();

    constructor(InitParams memory p) {
        if (
            p.memeToken == address(0) || p.quoteAsset == address(0) || p.stockAsset == address(0)
                || p.rewardVault == address(0) || p.creatorVault == address(0) || p.treasury == address(0)
                || p.creator == address(0)
        ) revert ZeroAddress();
        if (p.virtualQuote == 0 || p.virtualToken == 0) revert InvalidCurveParams();
        if (p.feeConfig.totalFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (uint256(p.feeConfig.holderShareBps) + p.feeConfig.creatorShareBps + p.feeConfig.protocolShareBps != BPS) {
            revert SharesInvalid();
        }

        factory = msg.sender;
        memeToken = IERC20(p.memeToken);
        quoteAsset = IERC20(p.quoteAsset);
        stockAsset = IERC20(p.stockAsset);
        rewardVault = RewardVault(p.rewardVault);
        creatorVault = CreatorRewardVault(p.creatorVault);
        treasury = p.treasury;
        creator = p.creator;
        creatorPreference = p.creatorPreference;
        feeConfig = p.feeConfig;
        virtualQuote = p.virtualQuote;
        virtualToken = p.virtualToken;
        graduationTarget = p.graduationTarget;
        routerAdapter = IRouterAdapter(p.routerAdapter);
    }

    // ---- Views ----

    function tokenReserve() public view returns (uint256) {
        return memeToken.balanceOf(address(this));
    }

    function quoteBuy(uint256 quoteIn) public view returns (uint256 tokensOut, uint256 fee) {
        fee = (quoteIn * feeConfig.totalFeeBps) / BPS;
        uint256 net = quoteIn - fee;
        uint256 q = virtualQuote + realQuote;
        uint256 t = virtualToken + tokenReserve();
        uint256 k = q * t;
        // Round tokensOut DOWN (ceil the divided term) so rounding favors the
        // pool, never paying out more tokens than the curve strictly owes.
        uint256 denom = q + net;
        tokensOut = t - (k + denom - 1) / denom;
    }

    function quoteSell(uint256 tokensIn) public view returns (uint256 quoteOut, uint256 fee) {
        uint256 q = virtualQuote + realQuote;
        uint256 t = virtualToken + tokenReserve();
        uint256 k = q * t;
        // Round grossOut DOWN so a full round-trip can never exceed realQuote.
        uint256 denom = t + tokensIn;
        uint256 grossOut = q - (k + denom - 1) / denom;
        fee = (grossOut * feeConfig.totalFeeBps) / BPS;
        quoteOut = grossOut - fee;
    }

    // ---- Trading ----

    function buy(uint256 quoteIn, uint256 minTokensOut) external nonReentrant returns (uint256 tokensOut) {
        if (IPlatformControls(factory).tradingPaused()) revert TradingIsPaused();
        if (quoteIn == 0) revert ZeroAmount();
        // Slippage-insensitive trades are rejected outright: callers must
        // commit to a non-zero minimum-out bound.
        if (minTokensOut == 0) revert SlippageBoundRequired();
        uint256 fee;
        (tokensOut, fee) = quoteBuy(quoteIn);
        if (tokensOut < minTokensOut) revert SlippageExceeded();
        // Never sell more than the pool actually holds; oversized buys must be
        // split or wait for graduation/migration.
        if (tokensOut > tokenReserve()) revert ExceedsCurveDepth();

        quoteAsset.safeTransferFrom(msg.sender, address(this), quoteIn);
        realQuote += quoteIn - fee;
        memeToken.safeTransfer(msg.sender, tokensOut);

        _routeFee(fee);
        emit Buy(msg.sender, quoteIn, tokensOut, fee);

        if (!graduated && realQuote >= graduationTarget && graduationTarget > 0) {
            graduated = true;
            emit Graduated(realQuote);
        }
    }

    function sell(uint256 tokensIn, uint256 minQuoteOut) external nonReentrant returns (uint256 quoteOut) {
        if (IPlatformControls(factory).tradingPaused()) revert TradingIsPaused();
        if (tokensIn == 0) revert ZeroAmount();
        if (minQuoteOut == 0) revert SlippageBoundRequired();
        uint256 fee;
        (quoteOut, fee) = quoteSell(tokensIn);
        if (quoteOut < minQuoteOut) revert SlippageExceeded();

        memeToken.safeTransferFrom(msg.sender, address(this), tokensIn);
        realQuote -= quoteOut + fee;
        quoteAsset.safeTransfer(msg.sender, quoteOut);

        _routeFee(fee);
        emit Sell(msg.sender, tokensIn, quoteOut, fee);
    }

    // ---- Fee routing ----

    function _routeFee(uint256 fee) internal {
        if (fee == 0) return;
        FeeConfig memory cfg = feeConfig;
        uint256 holderAmt = (fee * cfg.holderShareBps) / BPS;
        uint256 creatorAmt = (fee * cfg.creatorShareBps) / BPS;
        uint256 protocolAmt = fee - holderAmt - creatorAmt;

        // Holder share: try converting quote -> stock; fall back to quote.
        address holderAsset = address(quoteAsset);
        if (holderAmt > 0) {
            (uint256 stockOut, bool swapped) = _trySwapToStock(holderAmt, address(this));
            if (swapped) {
                holderAsset = address(stockAsset);
                holderAmt = stockOut;
                stockAsset.forceApprove(address(rewardVault), stockOut);
                rewardVault.notifyReward(address(stockAsset), stockOut);
            } else {
                quoteAsset.forceApprove(address(rewardVault), holderAmt);
                rewardVault.notifyReward(address(quoteAsset), holderAmt);
            }
        }

        // Creator share, per preference (stock conversion falls back to quote).
        if (creatorAmt > 0) {
            if (creatorPreference == CreatorPreference.ETH) {
                _notifyCreator(address(quoteAsset), creatorAmt);
            } else if (creatorPreference == CreatorPreference.STOCK) {
                _creatorStockOrQuote(creatorAmt);
            } else {
                uint256 half = creatorAmt / 2;
                _notifyCreator(address(quoteAsset), creatorAmt - half);
                _creatorStockOrQuote(half);
            }
        }

        if (protocolAmt > 0) {
            quoteAsset.safeTransfer(treasury, protocolAmt);
        }
        emit FeeRouted(holderAmt, holderAsset, creatorAmt, protocolAmt);
    }

    function _creatorStockOrQuote(uint256 quoteAmt) internal {
        (uint256 stockOut, bool swapped) = _trySwapToStock(quoteAmt, address(this));
        if (swapped) {
            stockAsset.forceApprove(address(creatorVault), stockOut);
            creatorVault.notify(creator, address(stockAsset), stockOut);
        } else {
            _notifyCreator(address(quoteAsset), quoteAmt);
        }
    }

    function _notifyCreator(address asset, uint256 amount) internal {
        IERC20(asset).forceApprove(address(creatorVault), amount);
        creatorVault.notify(creator, asset, amount);
    }

    /// @dev Fail-safe conversion with strict accounting:
    ///      - No adapter configured, or the adapter reverts: (0,false) —
    ///        callers fall back to accruing the fee in quote. A revert rolls
    ///        back any quote the adapter pulled, so nothing is lost.
    ///      - Adapter "succeeds": the received stock amount is measured by
    ///        BALANCE DELTA, never trusted from the return value.
    ///      - Adapter consumed quote but delivered zero stock: the funds are
    ///        gone and the fallback would otherwise pay the vault out of the
    ///        curve reserve — so the whole trade FAILS CLOSED instead
    ///        (RouterMisbehaved). Reserve backing can never be silently
    ///        drained by a misbehaving router.
    function _trySwapToStock(uint256 quoteAmt, address recipient) internal returns (uint256 stockOut, bool swapped) {
        IRouterAdapter adapter = routerAdapter;
        if (address(adapter) == address(0)) return (0, false);
        uint256 stockBefore = stockAsset.balanceOf(recipient);
        uint256 quoteBefore = quoteAsset.balanceOf(address(this));
        quoteAsset.forceApprove(address(adapter), quoteAmt);
        try adapter.swapExactInput(address(quoteAsset), address(stockAsset), quoteAmt, 0, recipient) returns (uint256) {
            uint256 received = stockAsset.balanceOf(recipient) - stockBefore;
            if (received == 0) {
                // Zero delivery: only safe to fall back if our quote was not
                // consumed. Otherwise the trade must revert.
                if (quoteAsset.balanceOf(address(this)) < quoteBefore) {
                    revert RouterMisbehaved();
                }
                quoteAsset.forceApprove(address(adapter), 0);
                return (0, false);
            }
            return (received, true);
        } catch {
            quoteAsset.forceApprove(address(adapter), 0);
            return (0, false);
        }
    }

    // ---- Admin (factory-owned) ----

    function setRouterAdapter(address adapter) external {
        if (msg.sender != factory) revert OnlyFactory();
        routerAdapter = IRouterAdapter(adapter);
        emit RouterAdapterUpdated(adapter);
    }
}
