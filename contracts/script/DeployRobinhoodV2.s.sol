// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StockRouteRegistry} from "../src/v2/StockRouteRegistry.sol";
import {UniswapV4RouterAdapter} from "../src/v2/UniswapV4RouterAdapter.sol";
import {CreatorRewardVaultV2} from "../src/v2/CreatorRewardVaultV2.sol";
import {StockRewardTreasury} from "../src/v2/StockRewardTreasury.sol";
import {StockDotFunFactoryV2} from "../src/v2/StockDotFunFactoryV2.sol";
import {V4LiquidityLocker} from "../src/v2/graduation/V4LiquidityLocker.sol";
import {UniswapV4GraduationAdapter} from "../src/v2/graduation/UniswapV4GraduationAdapter.sol";
import {GraduationManager} from "../src/v2/graduation/GraduationManager.sol";
import {VersionRegistry} from "../src/versioning/VersionRegistry.sol";

/// @title DeployRobinhoodV2
/// @notice Deploys and wires the full StockDotFun V2 stack on Robinhood Chain.
///         V1 (immutable) is left running and recorded as deprecated in the
///         VersionRegistry. Dry-run by default; broadcast requires --broadcast
///         and DEPLOY_CHECKLIST_ACK.
///
/// Env: DEPLOYER_PRIVATE_KEY, PROTOCOL_TREASURY, NEW_OWNER (multisig), KEEPER,
///      DEPLOY_CHECKLIST_ACK.
contract DeployRobinhoodV2 is Script {
    // Verified Part 1 Uniswap V4 address on Robinhood Chain 4663.
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    // Immutable V1 factory (recorded as deprecated).
    address constant V1_FACTORY = 0x7029f7289DCB3EA60C52ec89EA77089D420233D5;

    uint256 constant MAINNET = 4663;
    uint256 constant TESTNET = 46630;

    error WrongChain(uint256 got);
    error TreasuryMissing();
    error DeployerUnfunded();

    function run() external {
        uint256 cid = block.chainid;
        if (cid != MAINNET && cid != TESTNET) revert WrongChain(cid);

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address treasuryEOA = vm.envOr("PROTOCOL_TREASURY", address(0));
        address newOwner = vm.envOr("NEW_OWNER", address(0));
        address keeper = vm.envOr("KEEPER", deployer);
        if (treasuryEOA == address(0)) revert TreasuryMissing();

        StockDotFunFactoryV2.CurveConfig memory cc = StockDotFunFactoryV2.CurveConfig({
            totalFeeBps: 100,
            holderShareBps: 4000,
            creatorShareBps: 3000,
            protocolShareBps: 3000,
            virtualQuote: 3e18,
            virtualToken: 73_000_000e18,
            graduationTarget: 4.4e18,
            gradFee: 10000,
            gradTickSpacing: 200
        });

        console.log("=== StockDotFun V2 deployment plan ===");
        console.log("chain      :", cid);
        console.log("deployer   :", deployer);
        console.log("bal        :", deployer.balance);
        console.log("protocol   :", treasuryEOA);
        console.log("new owner  :", newOwner);
        console.log("keeper     :", keeper);
        if (deployer.balance == 0) revert DeployerUnfunded();

        string memory ack = vm.envOr("DEPLOY_CHECKLIST_ACK", string(""));
        bool ok = keccak256(bytes(ack)) == keccak256(bytes("I_HAVE_READ_DEPLOYMENT_CHECKLIST_AND_ACCEPT_MAINNET_RISK"));
        if (!ok) {
            console.log(">>> DRY RUN - set DEPLOY_CHECKLIST_ACK + --broadcast to deploy. Nothing sent.");
            return;
        }

        vm.startBroadcast(pk);

        // 1. registries
        VersionRegistry versionRegistry = new VersionRegistry(deployer);
        StockRouteRegistry routeRegistry = new StockRouteRegistry(deployer);

        // 2. conversion + graduation infra
        UniswapV4RouterAdapter stockAdapter = new UniswapV4RouterAdapter(POOL_MANAGER, address(routeRegistry));
        V4LiquidityLocker locker = new V4LiquidityLocker(deployer, POOL_MANAGER, treasuryEOA);
        UniswapV4GraduationAdapter gradAdapter = new UniswapV4GraduationAdapter(address(locker));
        GraduationManager gradManager = new GraduationManager(deployer);

        // 3. factory + vaults + treasury
        StockDotFunFactoryV2 factory = new StockDotFunFactoryV2(deployer, address(routeRegistry), cc);
        CreatorRewardVaultV2 creatorVault = new CreatorRewardVaultV2(address(factory), deployer);
        StockRewardTreasury treasury = new StockRewardTreasury(
            deployer,
            address(stockAdapter),
            address(routeRegistry),
            address(creatorVault),
            address(factory),
            treasuryEOA
        );

        // 4. wire
        creatorVault.setNotifier(address(treasury));
        locker.setGraduator(address(gradAdapter));
        gradManager.setFactory(address(factory));
        factory.wire(address(treasury), address(gradManager), address(gradAdapter));
        treasury.setKeeper(keeper, true);

        // 5. version registry
        versionRegistry.setDeployment(
            VersionRegistry.Deployment({
                version: 1,
                active: false,
                factory: V1_FACTORY,
                treasury: address(0),
                graduationManager: address(0),
                stockRouteRegistry: address(0),
                label: "StockDotFun V1 (deprecated)"
            })
        );
        versionRegistry.setDeployment(
            VersionRegistry.Deployment({
                version: 2,
                active: true,
                factory: address(factory),
                treasury: address(treasury),
                graduationManager: address(gradManager),
                stockRouteRegistry: address(routeRegistry),
                label: "StockDotFun V2"
            })
        );

        // NOTE: ownership is intentionally NOT transferred here. Routes must be
        // seeded (SeedStockRoutes) while the deployer still owns the registry,
        // THEN ownership of all 7 Ownable2Step contracts is handed to `newOwner`
        // (see report runbook). This preserves the required order: verify routes
        // before relinquishing control.
        newOwner; // silence unused warning; consumed by the post-seed transfer step

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYED V2 - copy into frontend env / deployments json ===");
        console.log("NEXT_PUBLIC_V2_FACTORY_ADDRESS=", address(factory));
        console.log("NEXT_PUBLIC_V2_STOCK_ROUTE_REGISTRY=", address(routeRegistry));
        console.log("NEXT_PUBLIC_V2_STOCK_REWARD_TREASURY=", address(treasury));
        console.log("NEXT_PUBLIC_V2_CREATOR_VAULT=", address(creatorVault));
        console.log("NEXT_PUBLIC_V2_GRADUATION_MANAGER=", address(gradManager));
        console.log("NEXT_PUBLIC_V2_GRADUATION_ADAPTER=", address(gradAdapter));
        console.log("NEXT_PUBLIC_V2_LIQUIDITY_LOCKER=", address(locker));
        console.log("NEXT_PUBLIC_V2_STOCK_CONVERSION_ADAPTER=", address(stockAdapter));
        console.log("NEXT_PUBLIC_VERSION_REGISTRY=", address(versionRegistry));
        console.log("");
        console.log(">>> Next: run SeedStockRoutes to enable ONLY verified stock routes,");
        console.log(">>> then acceptOwnership from the multisig on all 7 contracts.");
    }
}
