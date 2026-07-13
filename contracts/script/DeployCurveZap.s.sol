// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {CurveZap, IWETH, IFactoryLite} from "../src/v2/CurveZap.sol";

/// @title DeployCurveZap
/// @notice Deploys the stateless CurveZap (1-transaction ETH buys/sells against
///         StockDotFun bonding-curve pools). No ownership, no wiring, no
///         follow-up transactions — deploy and set NEXT_PUBLIC_ZAP_ADDRESS.
///
/// Chain gate: refuses to broadcast unless chainid == 4663 (Robinhood Chain).
///
/// Dry run:
///   forge script script/DeployCurveZap.s.sol --rpc-url $RHC_RPC_URL
/// Broadcast (run by the operator):
///   forge script script/DeployCurveZap.s.sol --rpc-url $RHC_RPC_URL \
///     --broadcast --private-key $DEPLOYER_PRIVATE_KEY
contract DeployCurveZap is Script {
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant FACTORY_V2 = 0x470acA74d71269833de8cF65640DFB558393569E;

    function run() external {
        require(block.chainid == 4663, "wrong chain: expected Robinhood Chain (4663)");

        vm.startBroadcast();
        CurveZap zap = new CurveZap(IWETH(WETH), IFactoryLite(FACTORY_V2));
        vm.stopBroadcast();

        console.log("CurveZap deployed:", address(zap));
        console.log("Set NEXT_PUBLIC_ZAP_ADDRESS to this address in Vercel + .env.local");
    }
}
