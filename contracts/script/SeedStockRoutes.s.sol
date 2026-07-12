// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StockRouteRegistry} from "../src/v2/StockRouteRegistry.sol";

/// @title SeedStockRoutes
/// @notice Seeds ONLY the VERIFIED stock routes (from Part 2 liquidity
///         discovery, docs/integrations/stock-liquidity-report.md) into the
///         StockRouteRegistry. Run by the registry owner AFTER deployment and
///         BEFORE transferring ownership. Assets not listed here stay DISABLED.
///
/// Env: DEPLOYER_PRIVATE_KEY, ROUTE_REGISTRY (deployed StockRouteRegistry).
contract SeedStockRoutes is Script {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    struct V {
        address stock;
        uint24 fee;
        int24 ts;
        uint128 maxWeth;
    }

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        StockRouteRegistry reg = StockRouteRegistry(vm.envAddress("ROUTE_REGISTRY"));

        // 8 VERIFIED assets with their best USDG pool (fee/tickSpacing) and the
        // max clean size measured live in Part 2.
        V[8] memory vs = [
            V(0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9, 10000, 200, 0.5 ether), // AAPL
            V(0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3, 10000, 200, 0.5 ether), // GOOGL
            V(0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35, 10000, 200, 0.5 ether), // META
            V(0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD, 10000, 200, 0.5 ether), // MU
            V(0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC, 3000, 60, 0.5 ether), // NVDA
            V(0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa, 10000, 200, 0.5 ether), // SPCX
            V(0x322F0929c4625eD5bAd873c95208D54E1c003b2d, 3000, 60, 0.5 ether), // TSLA
            V(0x117cc2133c37B721F49dE2A7a74833232B3B4C0C, 50000, 1000, 0.1 ether) // SPY
        ];

        vm.startBroadcast(pk);
        for (uint256 i; i < vs.length; ++i) {
            (address c0, address c1) = USDG < vs[i].stock ? (USDG, vs[i].stock) : (vs[i].stock, USDG);
            StockRouteRegistry.StockRoute memory r = StockRouteRegistry.StockRoute({
                status: StockRouteRegistry.StockRouteStatus.VERIFIED,
                baseInputIsNative: true,
                baseHop: StockRouteRegistry.V4Pool({
                    currency0: address(0), currency1: USDG, fee: 460, tickSpacing: 9, hooks: address(0)
                }),
                stockHop: StockRouteRegistry.V4Pool({
                    currency0: c0, currency1: c1, fee: vs[i].fee, tickSpacing: vs[i].ts, hooks: address(0)
                }),
                maxWethPerConversion: vs[i].maxWeth,
                maxSlippageBps: 300,
                maxRouteAge: 7 days,
                lastValidatedAt: 0
            });
            reg.setRoute(vs[i].stock, r);
            reg.markValidated(vs[i].stock);
            console.log("seeded VERIFIED route:", vs[i].stock);
        }
        vm.stopBroadcast();
        console.log("Seeded", vs.length, "verified routes. All other stocks remain DISABLED.");
    }
}
