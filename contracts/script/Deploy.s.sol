// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StockAssetRegistry} from "../src/StockAssetRegistry.sol";
import {StockDotFunFactory} from "../src/StockDotFunFactory.sol";
import {BondingCurvePool} from "../src/BondingCurvePool.sol";

/// @notice Deployment script for the StockDotFun foundation.
///
/// NEVER run against mainnet without review + audit. Usage (testnet/local):
///
///   export DEPLOYER_PRIVATE_KEY=0x...
///   export RHC_RPC_URL=https://...
///   export WETH_ADDRESS=0x...   # quote/reward asset (wrapped ETH)
///   export PROTOCOL_TREASURY=0x...
///   forge script script/Deploy.s.sol --rpc-url $RHC_RPC_URL --broadcast
///
/// After deployment, copy the printed addresses into the frontend .env:
///   NEXT_PUBLIC_STOCKDOTFUN_FACTORY_ADDRESS / _REGISTRY_ADDRESS, etc.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address weth = vm.envAddress("WETH_ADDRESS");
        address treasury = vm.envAddress("PROTOCOL_TREASURY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        StockAssetRegistry registry = new StockAssetRegistry(deployer);

        StockDotFunFactory factory = new StockDotFunFactory(
            address(registry),
            weth,
            treasury,
            address(0), // router adapter: configure post-deploy when available
            BondingCurvePool.FeeConfig({
                totalFeeBps: 100, // 1%
                holderShareBps: 4000,
                creatorShareBps: 3000,
                protocolShareBps: 3000
            }),
            // WETH is 18 decimals. These are PLACEHOLDER curve params — tune the
            // starting price/depth and graduation target for real ETH economics.
            5e18, // virtual quote reserve (5 WETH)
            1_073_000_000e18, // virtual token reserve
            10e18 // graduation target (10 WETH raised)
        );

        // Register supported stock-token assets post-deploy, e.g.:
        // registry.addAsset(TSLA_TOKEN, "TSLA", TSLA_FEED, "");

        vm.stopBroadcast();

        console.log("StockAssetRegistry:", address(registry));
        console.log("StockDotFunFactory:", address(factory));
        console.log("CreatorRewardVault:", address(factory.creatorVault()));
    }
}
