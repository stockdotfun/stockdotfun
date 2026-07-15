// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StockRouteRegistry} from "../../src/v2/StockRouteRegistry.sol";
import {UniswapV4RouterAdapter} from "../../src/v2/UniswapV4RouterAdapter.sol";
import {IStockConversionAdapter} from "../../src/v2/interfaces/IStockConversion.sol";
import {ExternalTradeRouter, IWETH, IV3SwapRouter} from "../../src/v2/ExternalTradeRouter.sol";

/// @notice Proves the ExternalTradeRouter on a Robinhood Chain mainnet fork:
///         a user trades the LIVE CashCat / Juggernaut coins through StockDotFun
///         (real Uniswap V3 pools) and receives a REAL TSLA stock reward on the
///         skimmed fee. Also proves the allowlist gate and the best-effort
///         fee-refund path.
contract ExternalTradeRouterForkTest is Test {
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant V3_ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2; // Uniswap V3 SwapRouter02

    // Live external coins (canonical, high-volume) — both 1% (10000) V3/WETH pools.
    address constant CASHCAT = 0x020bfC650A365f8BB26819deAAbF3E21291018b4;
    address constant JUGGERNAUT = 0xD7321801CAae694090694Ff55A9323139F043B88;
    uint24 constant POOL_FEE = 10000;

    StockRouteRegistry registry;
    UniswapV4RouterAdapter adapter;
    ExternalTradeRouter router;

    address alice;

    function setUp() public {
        vm.createSelectFork(vm.envOr("RHC_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")));

        registry = new StockRouteRegistry(address(this));
        adapter = new UniswapV4RouterAdapter(POOL_MANAGER, address(registry));

        // Seed the verified TSLA route (same params proven in StockConversionForkTest):
        // base ETH/USDG (fee 460, ts 9), stock TSLA/USDG (fee 3000, ts 60).
        StockRouteRegistry.StockRoute memory r = StockRouteRegistry.StockRoute({
            status: StockRouteRegistry.StockRouteStatus.VERIFIED,
            baseInputIsNative: true,
            baseHop: StockRouteRegistry.V4Pool({
                currency0: address(0), currency1: USDG, fee: 460, tickSpacing: 9, hooks: address(0)
            }),
            stockHop: StockRouteRegistry.V4Pool({
                currency0: TSLA, currency1: USDG, fee: 3000, tickSpacing: 60, hooks: address(0)
            }),
            maxWethPerConversion: 0.5 ether,
            maxSlippageBps: 300,
            maxRouteAge: 7 days,
            lastValidatedAt: 0
        });
        registry.setRoute(TSLA, r);
        registry.markValidated(TSLA);

        router = new ExternalTradeRouter(
            IWETH(WETH), IV3SwapRouter(V3_ROUTER), IStockConversionAdapter(address(adapter)), 100, address(this)
        );
        router.setListing(CASHCAT, true, POOL_FEE);
        router.setListing(JUGGERNAUT, true, POOL_FEE);

        alice = makeAddr("alice");
        vm.deal(alice, 10 ether);
    }

    function test_buyCashCat_deliversCoinPlusStockReward() public {
        vm.prank(alice);
        uint256 coinOut =
            router.buyWithETH{value: 1 ether}(CASHCAT, TSLA, 1, 1, block.timestamp + 600);

        assertGt(coinOut, 0, "no CashCat received");
        assertEq(IERC20(CASHCAT).balanceOf(alice), coinOut, "CashCat not delivered to trader");
        assertGt(IERC20(TSLA).balanceOf(alice), 0, "no TSLA reward paid to trader");
        assertEq(alice.balance, 9 ether, "should have spent exactly 1 ETH");
        _assertRouterEmpty(CASHCAT);
    }

    function test_buyJuggernaut_deliversCoinPlusStockReward() public {
        vm.prank(alice);
        uint256 coinOut =
            router.buyWithETH{value: 1 ether}(JUGGERNAUT, TSLA, 1, 1, block.timestamp + 600);

        assertGt(coinOut, 0, "no Juggernaut received");
        assertGt(IERC20(TSLA).balanceOf(alice), 0, "no TSLA reward paid");
        _assertRouterEmpty(JUGGERNAUT);
    }

    function test_sellCashCat_returnsEthPlusStockReward() public {
        vm.startPrank(alice);
        uint256 coinOut = router.buyWithETH{value: 1 ether}(CASHCAT, TSLA, 1, 1, block.timestamp + 600);
        uint256 tslaAfterBuy = IERC20(TSLA).balanceOf(alice);
        uint256 ethAfterBuy = alice.balance;

        IERC20(CASHCAT).approve(address(router), coinOut);
        uint256 ethOut = router.sellForETH(CASHCAT, TSLA, coinOut, 1, 1, block.timestamp + 600);
        vm.stopPrank();

        assertGt(ethOut, 0, "no ETH from sell");
        assertEq(alice.balance, ethAfterBuy + ethOut, "ETH not returned to trader");
        assertGt(IERC20(TSLA).balanceOf(alice), tslaAfterBuy, "no TSLA reward on sell");
        assertEq(IERC20(CASHCAT).balanceOf(alice), 0, "CashCat not fully sold");
        _assertRouterEmpty(CASHCAT);
    }

    function test_rejectsUnlistedCoin() public {
        address random = makeAddr("randomCoin");
        vm.prank(alice);
        vm.expectRevert(ExternalTradeRouter.NotListed.selector);
        router.buyWithETH{value: 1 ether}(random, TSLA, 1, 1, block.timestamp + 600);
    }

    function test_rewardRefundedAsEth_whenConversionFails() public {
        // Impossible minStockOut -> adapter reverts -> fee refunded as ETH.
        vm.prank(alice);
        uint256 coinOut = router.buyWithETH{value: 1 ether}(CASHCAT, TSLA, 1, 1e30, block.timestamp + 600);

        assertGt(coinOut, 0, "trade should still succeed");
        assertEq(IERC20(TSLA).balanceOf(alice), 0, "no stock should be delivered");
        // fee (0.01 ETH) refunded -> alice net spent only the 0.99 ETH swap amount.
        assertEq(alice.balance, 10 ether - 0.99 ether, "fee not refunded on conversion failure");
        _assertRouterEmpty(CASHCAT);
    }

    function _assertRouterEmpty(address coin) internal view {
        assertEq(IERC20(WETH).balanceOf(address(router)), 0, "WETH stuck in router");
        assertEq(IERC20(coin).balanceOf(address(router)), 0, "coin stuck in router");
        assertEq(IERC20(TSLA).balanceOf(address(router)), 0, "TSLA stuck in router");
        assertEq(address(router).balance, 0, "ETH stuck in router");
    }
}
