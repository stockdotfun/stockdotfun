// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

interface IERC20Min {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

interface IWETHMin {
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
}

/// @dev Minimal, self-contained V4 multi-hop router used to PROVE the real
///      WETH -> ETH -> USDG -> stock path against the live PoolManager on a fork.
///      Mirrors the settle/take semantics the production adapter will use.
contract MiniV4Router is IUnlockCallback {
    using BalanceDeltaLibrary for BalanceDelta;

    IPoolManager public immutable pm;
    address public constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    constructor(IPoolManager _pm) {
        pm = _pm;
    }

    function swapWethToStock(
        PoolKey memory baseHop,
        bool z1,
        PoolKey memory stockHop,
        bool z2,
        uint256 wethIn,
        address recipient
    ) external returns (uint256 stockOut) {
        IWETHMin(WETH).withdraw(wethIn); // WETH -> native ETH (base pool is ETH/USDG)
        bytes memory res = pm.unlock(abi.encode(baseHop, z1, stockHop, z2, wethIn, recipient));
        stockOut = abi.decode(res, (uint256));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(pm), "not pm");
        (PoolKey memory k1, bool z1, PoolKey memory k2, bool z2, uint256 ethIn, address recipient) =
            abi.decode(data, (PoolKey, bool, PoolKey, bool, uint256, address));

        // ---- hop 1: ETH -> USDG ----
        BalanceDelta d1 = pm.swap(
            k1, SwapParams({zeroForOne: z1, amountSpecified: -int256(ethIn), sqrtPriceLimitX96: _limit(z1)}), ""
        );
        Currency inC1 = z1 ? k1.currency0 : k1.currency1;
        Currency outC1 = z1 ? k1.currency1 : k1.currency0;
        uint256 mid = z1 ? uint256(uint128(d1.amount1())) : uint256(uint128(d1.amount0()));
        _settle(inC1, ethIn);
        pm.take(outC1, address(this), mid);

        // ---- hop 2: USDG -> stock ----
        BalanceDelta d2 =
            pm.swap(k2, SwapParams({zeroForOne: z2, amountSpecified: -int256(mid), sqrtPriceLimitX96: _limit(z2)}), "");
        Currency inC2 = z2 ? k2.currency0 : k2.currency1;
        Currency outC2 = z2 ? k2.currency1 : k2.currency0;
        uint256 stockOut = z2 ? uint256(uint128(d2.amount1())) : uint256(uint128(d2.amount0()));
        _settle(inC2, mid);
        pm.take(outC2, recipient, stockOut);

        return abi.encode(stockOut);
    }

    function _limit(bool zeroForOne) internal pure returns (uint160) {
        return zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
    }

    function _settle(Currency c, uint256 amt) internal {
        if (Currency.unwrap(c) == address(0)) {
            pm.settle{value: amt}();
        } else {
            pm.sync(c);
            IERC20Min(Currency.unwrap(c)).transfer(address(pm), amt);
            pm.settle();
        }
    }

    receive() external payable {}
}

contract StockSwapForkTest is Test {
    // Verified Part 1 / Part 2 addresses on Robinhood Chain 4663.
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant AAPL = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;

    MiniV4Router router;

    function setUp() public {
        string memory rpc = vm.envOr("RHC_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com"));
        vm.createSelectFork(rpc);
        router = new MiniV4Router(IPoolManager(POOL_MANAGER));
    }

    function _baseHop() internal pure returns (PoolKey memory) {
        // ETH(0x0)/USDG fee 460 tickSpacing 9 — verified deepest base pool.
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(USDG),
            fee: 460,
            tickSpacing: 9,
            hooks: IHooks(address(0))
        });
    }

    /// @dev Build the USDG<->stock pool key with sorted currencies, and the
    ///      direction for selling USDG into it.
    function _stockHop(address stock, uint24 fee, int24 spacing)
        internal
        pure
        returns (PoolKey memory key, bool sellUsdgZeroForOne)
    {
        (address c0, address c1) = USDG < stock ? (USDG, stock) : (stock, USDG);
        key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: fee,
            tickSpacing: spacing,
            hooks: IHooks(address(0))
        });
        // Selling USDG: zeroForOne is true iff USDG is currency0.
        sellUsdgZeroForOne = (c0 == USDG);
    }

    function testForkWethToTSLA() public {
        uint256 wethIn = 0.1 ether;
        deal(WETH, address(router), wethIn);
        address recipient = address(0xBEEF);
        (PoolKey memory hop, bool z2) = _stockHop(TSLA, 3000, 60);

        uint256 out = router.swapWethToStock(_baseHop(), true, hop, z2, wethIn, recipient);

        emit log_named_uint("TSLA out (wei)", out);
        assertGt(out, 0, "no TSLA acquired");
        assertEq(IERC20Min(TSLA).balanceOf(recipient), out, "recipient did not receive TSLA");
        // Discovery quoted ~0.44 TSLA for 0.1 WETH; assert within a sane band.
        assertGt(out, 0.3 ether, "TSLA out below expected band");
        assertLt(out, 0.6 ether, "TSLA out above expected band");
    }

    function testForkWethToAAPL() public {
        uint256 wethIn = 0.1 ether;
        deal(WETH, address(router), wethIn);
        address recipient = address(0xCAFE);
        (PoolKey memory hop, bool z2) = _stockHop(AAPL, 10000, 200);

        uint256 out = router.swapWethToStock(_baseHop(), true, hop, z2, wethIn, recipient);

        emit log_named_uint("AAPL out (wei)", out);
        assertGt(out, 0, "no AAPL acquired");
        assertEq(IERC20Min(AAPL).balanceOf(recipient), out);
    }
}
