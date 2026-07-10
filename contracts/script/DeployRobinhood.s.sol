// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {RobinhoodConfig} from "./config/RobinhoodConfig.sol";
import {StockAssetRegistry} from "../src/StockAssetRegistry.sol";
import {StockDotFunFactory} from "../src/StockDotFunFactory.sol";
import {NoopRouterAdapter} from "../src/NoopRouterAdapter.sol";
import {BondingCurvePool} from "../src/BondingCurvePool.sol";

/// @title DeployRobinhood
/// @notice Deploys the StockDotFun stack to Robinhood Chain (mainnet 4663 or
///         testnet 46630). Refuses to run on any other chain.
///
/// DRY-RUN (default, no broadcast — validates env, chain, balance, prints plan):
///   export RHC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
///   export DEPLOYER_PRIVATE_KEY=0x...
///   export PROTOCOL_TREASURY=0x...
///   forge script script/DeployRobinhood.s.sol --rpc-url $RHC_RPC_URL
///
/// BROADCAST (only with the acknowledgement flag set):
///   export DEPLOY_CHECKLIST_ACK=I_HAVE_READ_DEPLOYMENT_CHECKLIST
///   forge script script/DeployRobinhood.s.sol --rpc-url $RHC_RPC_URL --broadcast
///
/// After deploy: copy printed addresses into the frontend .env, then optionally
/// transfer ownership to a multisig (NEW_OWNER) via the two-step flow.
contract DeployRobinhood is Script {
    error WrongChain(uint256 got);
    error TreasuryMissing();
    error DeployerUnfunded();

    function run() external {
        // --- 1. chain gate ---
        uint256 cid = block.chainid;
        if (cid != RobinhoodConfig.MAINNET_CHAIN_ID && cid != RobinhoodConfig.TESTNET_CHAIN_ID) {
            revert WrongChain(cid);
        }
        bool isMainnet = cid == RobinhoodConfig.MAINNET_CHAIN_ID;

        // --- 2. env validation ---
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address treasury = vm.envOr("PROTOCOL_TREASURY", address(0));
        if (treasury == address(0)) revert TreasuryMissing();

        BondingCurvePool.FeeConfig memory fee = RobinhoodConfig.defaultFeeConfig();

        // --- 3. deployment plan (always printed) ---
        console.log("=== StockDotFun deployment plan ===");
        console.log("network        :", isMainnet ? "Robinhood MAINNET (4663)" : "Robinhood TESTNET (46630)");
        console.log("deployer       :", deployer);
        console.log("deployer bal   :", deployer.balance);
        console.log("treasury       :", treasury);
        console.log("quote (WETH)   :", RobinhoodConfig.WETH);
        console.log("virtualQuote   :", RobinhoodConfig.VIRTUAL_QUOTE);
        console.log("virtualToken   :", RobinhoodConfig.VIRTUAL_TOKEN);
        console.log("graduation     :", RobinhoodConfig.GRADUATION_TARGET);
        console.log("fee bps        :", fee.totalFeeBps);

        if (deployer.balance == 0) revert DeployerUnfunded();

        // --- 4. broadcast gate ---
        // A broadcast run is only allowed with the acknowledgement flag. Without
        // it (or without --broadcast) this is a dry run: nothing is sent.
        string memory ack = vm.envOr("DEPLOY_CHECKLIST_ACK", string(""));
        bool acknowledged = keccak256(bytes(ack))
            == keccak256(bytes("I_HAVE_READ_DEPLOYMENT_CHECKLIST_AND_ACCEPT_MAINNET_RISK"));
        if (!acknowledged) {
            console.log("");
            console.log(">>> DRY RUN - set DEPLOY_CHECKLIST_ACK=I_HAVE_READ_DEPLOYMENT_CHECKLIST_AND_ACCEPT_MAINNET_RISK");
            console.log(">>> and pass --broadcast to deploy. Nothing was sent.");
            return;
        }

        // --- 5. deploy ---
        vm.startBroadcast(pk);

        StockAssetRegistry registry = new StockAssetRegistry(deployer);
        (address[] memory tokens, string[] memory symbols, bool[] memory enabled) =
            RobinhoodConfig.seedAssets();
        for (uint256 i; i < tokens.length; ++i) {
            registry.addAsset(tokens[i], symbols[i], address(0), "");
            if (!enabled[i]) registry.setEnabled(tokens[i], false);
        }

        // Routing disabled at launch (no verified DEX route yet): holder fees
        // accrue safely in WETH. Swap in a verified adapter later via
        // factory.setRouterAdapter(...).
        NoopRouterAdapter noopRouter = new NoopRouterAdapter();

        StockDotFunFactory factory = new StockDotFunFactory(
            address(registry),
            RobinhoodConfig.WETH,
            treasury,
            address(noopRouter),
            fee,
            RobinhoodConfig.VIRTUAL_QUOTE,
            RobinhoodConfig.VIRTUAL_TOKEN,
            RobinhoodConfig.GRADUATION_TARGET
        );

        // Optional: begin two-step ownership handoff to a multisig.
        address newOwner = vm.envOr("NEW_OWNER", address(0));
        if (newOwner != address(0)) {
            registry.transferOwnership(newOwner);
            factory.transferOwnership(newOwner);
            console.log("ownership transfer initiated to:", newOwner, "(must acceptOwnership)");
        }

        vm.stopBroadcast();

        // --- 6. post-deploy read-back verification ---
        require(factory.quoteAsset() == RobinhoodConfig.WETH, "WETH mismatch");
        require(address(factory.registry()) == address(registry), "registry mismatch");
        require(factory.virtualQuote() == RobinhoodConfig.VIRTUAL_QUOTE, "vQuote mismatch");
        require(registry.isSupported(RobinhoodConfig.WETH) == false, "WETH must not be a stock asset");

        console.log("");
        console.log("=== DEPLOYED - copy into frontend .env ===");
        console.log("NEXT_PUBLIC_STOCK_ASSET_REGISTRY_ADDRESS=", address(registry));
        console.log("NEXT_PUBLIC_FACTORY_ADDRESS=", address(factory));
        console.log("NEXT_PUBLIC_CREATOR_REWARD_VAULT_ADDRESS=", address(factory.creatorVault()));
        console.log("NEXT_PUBLIC_ROUTER_ADDRESS=", address(noopRouter));
        console.log("NEXT_PUBLIC_PROTOCOL_TREASURY=", treasury);
    }
}
