// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStockConversionAdapter} from "./interfaces/IStockConversion.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

/// @notice Uniswap V3 SwapRouter02 (no per-call deadline in the struct).
interface IV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/// @title ExternalTradeRouter
/// @notice Lets StockDotFun users trade EXISTING Robinhood Chain coins (that did
///         NOT launch on StockDotFun) through the platform and earn a tokenized
///         stock reward. Each trade routes ETH<->coin on the coin's own Uniswap
///         V3 pool, skims a small platform fee (in WETH), and converts that fee
///         into the trader's chosen stock via the shared, whitelist-gated
///         StockDotFun conversion adapter — paid straight to the trader.
///
///         Safety model:
///         - Only OWNER-listed coins are tradable (each vetted as a real,
///           sellable ERC20 on a real V3 pool). Trading a hostile/honeypot token
///           is impossible unless an operator lists it.
///         - The stock reward is BEST-EFFORT: if the conversion can't complete
///           (route cap, stale route, slippage), the fee is refunded to the
///           trader as ETH instead — the trade never fails and the trader is
///           never overcharged.
///         - Holds no funds between calls; every path sweeps residual WETH back
///           to the trader as ETH.
///         - nonReentrant; SafeERC20 throughout; fee-on-transfer-safe on sells
///           (uses measured received amounts).
contract ExternalTradeRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IWETH public immutable weth;
    IV3SwapRouter public immutable v3Router;
    IStockConversionAdapter public immutable stockAdapter;

    /// @notice Platform fee in basis points of the trade size. Capped at 3%.
    uint16 public feeBps;
    uint16 public constant MAX_FEE_BPS = 300;

    struct Listing {
        bool enabled;
        uint24 poolFee; // the coin/WETH Uniswap V3 fee tier (e.g. 10000 = 1%)
    }

    /// @notice coin => trading listing. Only enabled coins are tradable.
    mapping(address => Listing) public listings;

    error NotListed();
    error ZeroAmount();
    error Expired();
    error SlippageExceeded();
    error EthTransferFailed();
    error OnlyWeth();
    error FeeTooHigh();

    event ListingSet(address indexed coin, bool enabled, uint24 poolFee);
    event FeeSet(uint16 feeBps);
    event ExternalBuy(
        address indexed trader, address indexed coin, address indexed stock, uint256 ethIn, uint256 coinOut, uint256 feeWeth
    );
    event ExternalSell(
        address indexed trader, address indexed coin, address indexed stock, uint256 coinIn, uint256 ethOut, uint256 feeWeth
    );
    event RewardPaid(address indexed trader, address indexed stock, uint256 feeWeth, uint256 stockOut);
    event RewardRefunded(address indexed trader, uint256 feeWeth); // conversion failed -> fee returned as ETH

    constructor(IWETH weth_, IV3SwapRouter v3Router_, IStockConversionAdapter stockAdapter_, uint16 feeBps_, address owner_)
        Ownable(owner_)
    {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        weth = weth_;
        v3Router = v3Router_;
        stockAdapter = stockAdapter_;
        feeBps = feeBps_;
    }

    // --------------------------------------------------------------------- //
    //                            owner controls                             //
    // --------------------------------------------------------------------- //

    /// @notice List/unlist an external coin. `poolFee` is the coin/WETH V3 fee
    ///         tier. Operators MUST verify the coin is a standard, sellable
    ///         ERC20 with a real V3 pool before enabling it.
    function setListing(address coin, bool enabled, uint24 poolFee) external onlyOwner {
        listings[coin] = Listing({enabled: enabled, poolFee: poolFee});
        emit ListingSet(coin, enabled, poolFee);
    }

    function setFeeBps(uint16 feeBps_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = feeBps_;
        emit FeeSet(feeBps_);
    }

    // --------------------------------------------------------------------- //
    //                                trading                                //
    // --------------------------------------------------------------------- //

    /// @notice Buy a listed coin with native ETH; earn `stock` on the fee.
    /// @param coin The listed external coin to buy.
    /// @param stock The tokenized stock to receive as reward (verified route).
    /// @param minCoinOut Minimum coin out from the swap (trader slippage bound).
    /// @param minStockOut Minimum stock out from the fee conversion.
    /// @param deadline Unix deadline for the whole trade.
    function buyWithETH(address coin, address stock, uint256 minCoinOut, uint256 minStockOut, uint256 deadline)
        external
        payable
        nonReentrant
        returns (uint256 coinOut)
    {
        if (block.timestamp > deadline) revert Expired();
        if (msg.value == 0) revert ZeroAmount();
        Listing memory l = listings[coin];
        if (!l.enabled) revert NotListed();

        weth.deposit{value: msg.value}();

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 swapAmount = msg.value - fee;

        // Swap WETH -> coin, delivered straight to the trader.
        IERC20(address(weth)).forceApprove(address(v3Router), swapAmount);
        coinOut = v3Router.exactInputSingle(
            IV3SwapRouter.ExactInputSingleParams({
                tokenIn: address(weth),
                tokenOut: coin,
                fee: l.poolFee,
                recipient: msg.sender,
                amountIn: swapAmount,
                amountOutMinimum: minCoinOut,
                sqrtPriceLimitX96: 0
            })
        );

        _rewardOrRefund(stock, fee, minStockOut, deadline);
        _sweep(); // any residual WETH -> ETH back to trader

        emit ExternalBuy(msg.sender, coin, stock, msg.value, coinOut, fee);
    }

    /// @notice Sell a listed coin for native ETH; earn `stock` on the fee.
    ///         Requires a one-time coin approval to this router.
    /// @param coin The listed external coin to sell.
    /// @param stock The tokenized stock to receive as reward (verified route).
    /// @param amountIn Coin amount to sell.
    /// @param minEthOut Minimum NET ETH the trader receives (after fee).
    /// @param minStockOut Minimum stock out from the fee conversion.
    /// @param deadline Unix deadline for the whole trade.
    function sellForETH(
        address coin,
        address stock,
        uint256 amountIn,
        uint256 minEthOut,
        uint256 minStockOut,
        uint256 deadline
    ) external nonReentrant returns (uint256 ethOut) {
        if (block.timestamp > deadline) revert Expired();
        if (amountIn == 0) revert ZeroAmount();
        Listing memory l = listings[coin];
        if (!l.enabled) revert NotListed();

        // Pull coin; measure actual received (fee-on-transfer safe).
        uint256 balBefore = IERC20(coin).balanceOf(address(this));
        IERC20(coin).safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 received = IERC20(coin).balanceOf(address(this)) - balBefore;

        // Swap coin -> WETH into this router (so we can skim the fee).
        IERC20(coin).forceApprove(address(v3Router), received);
        uint256 grossWeth = v3Router.exactInputSingle(
            IV3SwapRouter.ExactInputSingleParams({
                tokenIn: coin,
                tokenOut: address(weth),
                fee: l.poolFee,
                recipient: address(this),
                amountIn: received,
                amountOutMinimum: 0, // net floor enforced below
                sqrtPriceLimitX96: 0
            })
        );

        uint256 fee = (grossWeth * feeBps) / 10_000;
        uint256 userWeth = grossWeth - fee;
        if (userWeth < minEthOut) revert SlippageExceeded();

        _rewardOrRefund(stock, fee, minStockOut, deadline);

        // Unwrap the trader's proceeds (plus any refunded fee swept below).
        weth.withdraw(userWeth);
        (bool ok,) = msg.sender.call{value: userWeth}("");
        if (!ok) revert EthTransferFailed();
        ethOut = userWeth;

        _sweep(); // refunded fee (if conversion failed) + dust -> ETH to trader

        emit ExternalSell(msg.sender, coin, stock, amountIn, ethOut, fee);
    }

    // --------------------------------------------------------------------- //
    //                               internals                               //
    // --------------------------------------------------------------------- //

    /// @dev Convert `feeWeth` -> `stock` to the trader. Best-effort: on any
    ///      failure the WETH is left in the router and later swept back to the
    ///      trader as ETH (so the trade never reverts on a reward hiccup).
    function _rewardOrRefund(address stock, uint256 feeWeth, uint256 minStockOut, uint256 deadline) internal {
        if (feeWeth == 0) return;
        IERC20(address(weth)).forceApprove(address(stockAdapter), feeWeth);
        try stockAdapter.convert(stock, feeWeth, minStockOut, deadline, msg.sender) returns (uint256 stockOut) {
            emit RewardPaid(msg.sender, stock, feeWeth, stockOut);
        } catch {
            IERC20(address(weth)).forceApprove(address(stockAdapter), 0);
            emit RewardRefunded(msg.sender, feeWeth);
        }
    }

    /// @dev Return any WETH held by the router to the trader as native ETH.
    function _sweep() internal {
        uint256 bal = IERC20(address(weth)).balanceOf(address(this));
        if (bal == 0) return;
        weth.withdraw(bal);
        (bool ok,) = msg.sender.call{value: bal}("");
        if (!ok) revert EthTransferFailed();
    }

    receive() external payable {
        if (msg.sender != address(weth)) revert OnlyWeth();
    }
}
