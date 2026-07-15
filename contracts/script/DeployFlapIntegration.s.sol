// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {FlapV2DexAdapter} from "../src/integrations/flap/FlapV2DexAdapter.sol";
import {FlapDexAdapterRegistry} from "../src/integrations/flap/FlapDexAdapterRegistry.sol";
import {StockDotFunExternalTradeGateway} from "../src/integrations/StockDotFunExternalTradeGateway.sol";
import {ExternalTradeRewardVault} from "../src/rewards/ExternalTradeRewardVault.sol";
import {ExternalTradeRewardManager} from "../src/rewards/ExternalTradeRewardManager.sol";
import {CommitRevealRandomnessProvider} from "../src/rewards/CommitRevealRandomnessProvider.sol";
import {ExternalFeeStockAccumulator} from "../src/rewards/ExternalFeeStockAccumulator.sol";

/// @title DeployFlapIntegration
/// @notice Deploys the full Flap trading + reward stack on Robinhood Chain and
///         wires it, leaving the reward campaign DISABLED (no fee charged, no
///         credits) until inventory is funded and randomness is committed.
///
/// Chain gate: refuses to broadcast unless chainid == 4663.
///
/// Env: FEE_RECIPIENT (reward-program treasury). Owner = broadcaster.
///
/// After deploy the operator must, separately:
///   - approve the V2 adapter (done here) and list verified graduates (keeper);
///   - fund ExternalTradeRewardVault with real tokenized stock;
///   - configure reward assets + a randomness commitment per epoch;
///   - call gateway.setRewardConfig(manager, true, feeBps) to activate.
contract DeployFlapIntegration is Script {
    // Verified Uniswap V2-fork router on RHC (Flap migration target).
    address constant V2_ROUTER = 0x89e5DB8B5aA49aA85AC63f691524311AEB649eba;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    function run() external {
        require(block.chainid == 4663, "wrong chain: expected Robinhood Chain (4663)");
        address owner = msg.sender;
        // Live, verified WETH->USDG->stock conversion adapter (self-funds rewards).
        address stockAdapter = vm.envOr("STOCK_ADAPTER", address(0xEE348959309506e9c9Ec302fa449b25b767Ff51b));

        vm.startBroadcast();

        // Reward vault + self-funding accumulator: gateway reward fees (ETH) land
        // in the accumulator; a keeper converts them to tokenized stock straight
        // into the vault.
        ExternalTradeRewardVault vault = new ExternalTradeRewardVault(owner);
        ExternalFeeStockAccumulator accumulator =
            new ExternalFeeStockAccumulator(WETH, stockAdapter, address(vault), owner);

        // Trading stack — reward fee is routed to the accumulator.
        FlapDexAdapterRegistry registry = new FlapDexAdapterRegistry(owner);
        FlapV2DexAdapter v2Adapter = new FlapV2DexAdapter(V2_ROUTER);
        registry.approveAdapter(address(v2Adapter));
        StockDotFunExternalTradeGateway gateway =
            new StockDotFunExternalTradeGateway(address(registry), address(accumulator), owner);

        // Reward manager + randomness (inactive until funded + seed committed).
        CommitRevealRandomnessProvider rng = new CommitRevealRandomnessProvider(owner);
        ExternalTradeRewardManager manager = new ExternalTradeRewardManager(address(vault), owner);
        vault.grantRole(vault.MANAGER_ROLE(), address(manager));
        manager.setRandomness(address(rng));
        manager.setGateway(address(gateway));
        // NOTE: gateway.setRewardConfig(...) intentionally NOT called — rewards
        // (and the reward fee) stay OFF until the operator funds/accumulates
        // inventory, configures reward assets + a randomness commitment.

        vm.stopBroadcast();

        console.log("RewardVault:           ", address(vault));
        console.log("FeeStockAccumulator:   ", address(accumulator));
        console.log("FlapDexAdapterRegistry:", address(registry));
        console.log("FlapV2DexAdapter:      ", address(v2Adapter));
        console.log("ExternalTradeGateway:  ", address(gateway));
        console.log("RandomnessProvider:    ", address(rng));
        console.log("RewardManager:         ", address(manager));
        console.log("Fee flow: gateway -> accumulator -> (keeper convert) -> stock in vault");
    }
}
