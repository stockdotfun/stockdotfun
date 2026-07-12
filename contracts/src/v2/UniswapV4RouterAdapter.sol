// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {StockRouteRegistry} from "./StockRouteRegistry.sol";
import {IStockConversionAdapter} from "./interfaces/IStockConversion.sol";

interface IWETH9 {
    function withdraw(uint256) external;
}

/// @title UniswapV4RouterAdapter
/// @notice Converts WETH -> USDG -> stock through the verified Robinhood Chain
///         Uniswap V4 deployment, using ONLY the whitelisted route stored in the
///         StockRouteRegistry for the given stock. It cannot be pointed at an
///         arbitrary token, pool, hook, router, recipient, or calldata: the
///         `stock` selects a fixed route, the recipient is supplied by the
///         caller but no external call target is ever caller-controlled, and the
///         swap path is fully determined on-chain. Enforces per-conversion size
///         cap, `minStockOut`, and `deadline`. Holds no funds between calls.
contract UniswapV4RouterAdapter is IStockConversionAdapter, IUnlockCallback, ReentrancyGuard {
    using BalanceDeltaLibrary for BalanceDelta;
    using SafeERC20 for IERC20;

    IPoolManager public immutable poolManager;
    StockRouteRegistry public immutable registry;
    address public constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address public constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    error DeadlinePassed();
    error NotConvertible(address stock);
    error ExceedsMaxSize(uint256 wethIn, uint256 maxWeth);
    error InsufficientStockOut(uint256 got, uint256 min);
    error OnlyPoolManager();
    error ZeroAmount();

    event Converted(address indexed stock, uint256 wethIn, uint256 stockOut, address indexed recipient);

    struct SwapCtx {
        PoolKey k1;
        bool z1;
        PoolKey k2;
        bool z2;
        uint256 amountIn;
        bool inputIsNative;
        address recipient;
    }

    constructor(address poolManager_, address registry_) {
        poolManager = IPoolManager(poolManager_);
        registry = StockRouteRegistry(registry_);
    }

    /// @inheritdoc IStockConversionAdapter
    function convert(address stock, uint256 wethIn, uint256 minStockOut, uint256 deadline, address recipient)
        external
        nonReentrant
        returns (uint256 stockOut)
    {
        if (wethIn == 0 || minStockOut == 0) revert ZeroAmount();
        if (block.timestamp > deadline) revert DeadlinePassed();
        if (!registry.isConvertible(stock)) revert NotConvertible(stock);

        StockRouteRegistry.StockRoute memory r = registry.getRoute(stock);
        if (r.maxWethPerConversion != 0 && wethIn > r.maxWethPerConversion) {
            revert ExceedsMaxSize(wethIn, r.maxWethPerConversion);
        }

        IERC20(WETH).safeTransferFrom(msg.sender, address(this), wethIn);
        if (r.baseInputIsNative) IWETH9(WETH).withdraw(wethIn); // WETH -> native ETH

        PoolKey memory k1 = _toKey(r.baseHop);
        PoolKey memory k2 = _toKey(r.stockHop);
        address baseTok = r.baseInputIsNative ? address(0) : WETH;

        bytes memory res = poolManager.unlock(
            abi.encode(
                SwapCtx({
                    k1: k1,
                    z1: Currency.unwrap(k1.currency0) == baseTok,
                    k2: k2,
                    z2: Currency.unwrap(k2.currency0) == USDG,
                    amountIn: wethIn,
                    inputIsNative: r.baseInputIsNative,
                    recipient: recipient
                })
            )
        );
        stockOut = abi.decode(res, (uint256));
        if (stockOut < minStockOut) revert InsufficientStockOut(stockOut, minStockOut);
        emit Converted(stock, wethIn, stockOut, recipient);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        SwapCtx memory c = abi.decode(data, (SwapCtx));

        // hop 1: base (ETH/WETH) -> USDG
        BalanceDelta d1 = poolManager.swap(
            c.k1,
            SwapParams({zeroForOne: c.z1, amountSpecified: -int256(c.amountIn), sqrtPriceLimitX96: _limit(c.z1)}),
            ""
        );
        Currency inC1 = c.z1 ? c.k1.currency0 : c.k1.currency1;
        Currency outC1 = c.z1 ? c.k1.currency1 : c.k1.currency0;
        uint256 mid = c.z1 ? uint256(uint128(d1.amount1())) : uint256(uint128(d1.amount0()));
        _settle(inC1, c.amountIn);
        poolManager.take(outC1, address(this), mid);

        // hop 2: USDG -> stock
        BalanceDelta d2 = poolManager.swap(
            c.k2, SwapParams({zeroForOne: c.z2, amountSpecified: -int256(mid), sqrtPriceLimitX96: _limit(c.z2)}), ""
        );
        Currency inC2 = c.z2 ? c.k2.currency0 : c.k2.currency1;
        Currency outC2 = c.z2 ? c.k2.currency1 : c.k2.currency0;
        uint256 outAmt = c.z2 ? uint256(uint128(d2.amount1())) : uint256(uint128(d2.amount0()));
        _settle(inC2, mid);
        poolManager.take(outC2, c.recipient, outAmt);

        return abi.encode(outAmt);
    }

    function _toKey(StockRouteRegistry.V4Pool memory p) internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(p.currency0),
            currency1: Currency.wrap(p.currency1),
            fee: p.fee,
            tickSpacing: p.tickSpacing,
            hooks: IHooks(p.hooks)
        });
    }

    function _limit(bool zeroForOne) internal pure returns (uint160) {
        return zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
    }

    function _settle(Currency c, uint256 amt) internal {
        if (Currency.unwrap(c) == address(0)) {
            poolManager.settle{value: amt}();
        } else {
            poolManager.sync(c);
            IERC20(Currency.unwrap(c)).safeTransfer(address(poolManager), amt);
            poolManager.settle();
        }
    }

    receive() external payable {}
}
