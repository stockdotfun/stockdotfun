// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ExternalTradeRouter, IWETH, IV3SwapRouter} from "../src/v2/ExternalTradeRouter.sol";
import {IStockConversionAdapter} from "../src/v2/interfaces/IStockConversion.sol";

/// @title DeployExternalTradeRouter
/// @notice Deploys the ExternalTradeRouter (trade live Robinhood Chain coins
///         through StockDotFun, earn a tokenized stock reward) and seeds the
///         initial coin allowlist (CashCat + Juggernaut, both 1% V3/WETH pools).
///
/// Chain gate: refuses to broadcast unless chainid == 4663.
///
/// Env:
///   STOCK_ADAPTER  live UniswapV4RouterAdapter (stock conversion). Defaults to
///                  the current mainnet deployment; override to be explicit.
///   FEE_BPS        platform fee in bps (default 100 = 1%).
///
/// Dry run:
///   forge script script/DeployExternalTradeRouter.s.sol --rpc-url $RHC_RPC_URL
/// Broadcast (operator):
///   forge script script/DeployExternalTradeRouter.s.sol --rpc-url $RHC_RPC_URL \
///     --broadcast --private-key $DEPLOYER_PRIVATE_KEY
contract DeployExternalTradeRouter is Script {
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant V3_ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2; // Uniswap V3 SwapRouter02

    // Verified canonical coins (real, sellable, high-volume) — 1% V3/WETH pools.
    address constant CASHCAT = 0x020bfC650A365f8BB26819deAAbF3E21291018b4;
    address constant JUGGERNAUT = 0xD7321801CAae694090694Ff55A9323139F043B88;
    uint24 constant POOL_FEE = 10000;

    function run() external {
        require(block.chainid == 4663, "wrong chain: expected Robinhood Chain (4663)");

        address adapter = vm.envOr("STOCK_ADAPTER", address(0xEE348959309506e9c9Ec302fa449b25b767Ff51b));
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(100)));

        vm.startBroadcast();
        ExternalTradeRouter router = new ExternalTradeRouter(
            IWETH(WETH), IV3SwapRouter(V3_ROUTER), IStockConversionAdapter(adapter), feeBps, msg.sender
        );
        // Seed the initial allowlist. Only add coins verified as standard,
        // sellable ERC20s on a real V3 pool.
        router.setListing(CASHCAT, true, POOL_FEE);
        router.setListing(JUGGERNAUT, true, POOL_FEE);
        vm.stopBroadcast();

        console.log("ExternalTradeRouter deployed:", address(router));
        console.log("  fee bps:", feeBps);
        console.log("  listed: CashCat + Juggernaut");
        console.log("Set NEXT_PUBLIC_EXTERNAL_ROUTER_ADDRESS to this address in Vercel + .env.local");
    }
}
