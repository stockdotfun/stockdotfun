// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StockRouteRegistry} from "../../src/v2/StockRouteRegistry.sol";
import {UniswapV4RouterAdapter} from "../../src/v2/UniswapV4RouterAdapter.sol";
import {ExternalTradeRewardVault} from "../../src/rewards/ExternalTradeRewardVault.sol";
import {ExternalFeeStockAccumulator} from "../../src/rewards/ExternalFeeStockAccumulator.sol";
import {FlapV2DexAdapter} from "../../src/integrations/flap/FlapV2DexAdapter.sol";
import {FlapDexAdapterRegistry} from "../../src/integrations/flap/FlapDexAdapterRegistry.sol";
import {StockDotFunExternalTradeGateway} from "../../src/integrations/StockDotFunExternalTradeGateway.sol";

/// @notice Proves the self-funding reward loop on a Robinhood Chain fork:
///         a real WOBL trade through the gateway skims a reward fee (ETH), which
///         accumulates in ExternalFeeStockAccumulator and is converted by a
///         keeper into REAL TSLA delivered into the reward vault.
contract ExternalFeeAccumulatorForkTest is Test {
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant V2_ROUTER = 0x89e5DB8B5aA49aA85AC63f691524311AEB649eba;
    address constant WOBL = 0x76F80333B1d0abF3ff1636cdFb4efcE0FE747777;
    address constant WOBL_POOL = 0x4AB8Abf127043779968e3Ef3B8c9A393DA4b1733;

    StockRouteRegistry stockRegistry;
    UniswapV4RouterAdapter stockAdapter;
    ExternalTradeRewardVault vault;
    ExternalFeeStockAccumulator accumulator;

    FlapDexAdapterRegistry flapRegistry;
    FlapV2DexAdapter v2Adapter;
    StockDotFunExternalTradeGateway gateway;

    address admin = address(this);
    address alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.envOr("RHC_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")));

        // Verified stock-conversion stack + TSLA route (proven params).
        stockRegistry = new StockRouteRegistry(admin);
        stockAdapter = new UniswapV4RouterAdapter(POOL_MANAGER, address(stockRegistry));
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
        stockRegistry.setRoute(TSLA, r);
        stockRegistry.markValidated(TSLA);

        vault = new ExternalTradeRewardVault(admin);
        accumulator = new ExternalFeeStockAccumulator(WETH, address(stockAdapter), address(vault), admin);

        // Flap trading stack, fee routed to the accumulator, rewards active (1%).
        flapRegistry = new FlapDexAdapterRegistry(admin);
        v2Adapter = new FlapV2DexAdapter(V2_ROUTER);
        flapRegistry.approveAdapter(address(v2Adapter));
        flapRegistry.listToken(WOBL, WOBL_POOL, v2Adapter.DEX_ID(), 0, 0);
        gateway = new StockDotFunExternalTradeGateway(address(flapRegistry), address(accumulator), admin);
        gateway.setRewardConfig(address(0), true, 100); // 1% reward fee -> accumulator

        vm.deal(alice, 10 ether);
    }

    function test_accumulate_convertsEthFeesToStockIntoVault() public {
        vm.deal(address(accumulator), 1 ether); // simulate accumulated fees
        assertEq(accumulator.pendingEth(), 1 ether);

        uint256 stockOut = accumulator.accumulate(TSLA, 0.4 ether, 1, block.timestamp + 600);
        assertGt(stockOut, 0, "no TSLA converted");
        assertEq(IERC20(TSLA).balanceOf(address(vault)), stockOut, "TSLA not delivered to vault");
        assertGt(vault.available(TSLA), 0, "vault inventory did not grow");
        assertEq(accumulator.pendingEth(), 0.6 ether, "wrong ETH consumed");
    }

    function test_fullLoop_realTradeFeeBecomesStockInventory() public {
        // Real WOBL buy through the gateway -> 1% reward fee to the accumulator.
        vm.prank(alice);
        gateway.buy{value: 1 ether}(WOBL, 1, block.timestamp + 600);
        assertEq(address(accumulator).balance, 0.01 ether, "reward fee not routed to accumulator");

        // Keeper converts the accumulated fee into real TSLA for the reward vault.
        uint256 stockOut = accumulator.accumulate(TSLA, 0.01 ether, 1, block.timestamp + 600);
        assertGt(stockOut, 0, "fee did not convert to stock");
        assertEq(IERC20(TSLA).balanceOf(address(vault)), stockOut, "reward inventory not funded from trading fees");
        assertEq(address(accumulator).balance, 0, "accumulator should be drained");
    }

    function test_onlyKeeperCanAccumulate() public {
        vm.deal(address(accumulator), 1 ether);
        vm.prank(alice);
        vm.expectRevert();
        accumulator.accumulate(TSLA, 0.1 ether, 1, block.timestamp + 600);
    }

    function test_rejectsOverBalance() public {
        vm.deal(address(accumulator), 0.1 ether);
        vm.expectRevert(ExternalFeeStockAccumulator.InsufficientBalance.selector);
        accumulator.accumulate(TSLA, 1 ether, 1, block.timestamp + 600);
    }
}
