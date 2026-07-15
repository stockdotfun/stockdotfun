// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {FlapV2DexAdapter} from "../src/integrations/flap/FlapV2DexAdapter.sol";
import {FlapDexAdapterRegistry} from "../src/integrations/flap/FlapDexAdapterRegistry.sol";
import {StockDotFunExternalTradeGateway} from "../src/integrations/StockDotFunExternalTradeGateway.sol";
import {ExternalTradeRewardVault} from "../src/rewards/ExternalTradeRewardVault.sol";
import {ExternalTradeRewardManager} from "../src/rewards/ExternalTradeRewardManager.sol";
import {CommitRevealRandomnessProvider} from "../src/rewards/CommitRevealRandomnessProvider.sol";

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

    function run() external {
        require(block.chainid == 4663, "wrong chain: expected Robinhood Chain (4663)");
        address owner = msg.sender;
        address feeRecipient = vm.envOr("FEE_RECIPIENT", owner);

        vm.startBroadcast();

        // Trading stack
        FlapDexAdapterRegistry registry = new FlapDexAdapterRegistry(owner);
        FlapV2DexAdapter v2Adapter = new FlapV2DexAdapter(V2_ROUTER);
        registry.approveAdapter(address(v2Adapter));
        StockDotFunExternalTradeGateway gateway =
            new StockDotFunExternalTradeGateway(address(registry), feeRecipient, owner);

        // Reward stack (inactive until funded + randomness set)
        ExternalTradeRewardVault vault = new ExternalTradeRewardVault(owner);
        CommitRevealRandomnessProvider rng = new CommitRevealRandomnessProvider(owner);
        ExternalTradeRewardManager manager = new ExternalTradeRewardManager(address(vault), owner);
        vault.grantRole(vault.MANAGER_ROLE(), address(manager));
        manager.setRandomness(address(rng));
        manager.setGateway(address(gateway));
        // NOTE: gateway.setRewardConfig(...) intentionally NOT called — rewards
        // stay OFF (no fee) until the operator funds inventory + commits a seed.

        vm.stopBroadcast();

        console.log("FlapDexAdapterRegistry:", address(registry));
        console.log("FlapV2DexAdapter:      ", address(v2Adapter));
        console.log("ExternalTradeGateway:  ", address(gateway));
        console.log("RewardVault:           ", address(vault));
        console.log("RandomnessProvider:    ", address(rng));
        console.log("RewardManager:         ", address(manager));
        console.log("Set NEXT_PUBLIC_EXTERNAL_TRADE_GATEWAY_ADDRESS / _REWARD_MANAGER_ADDRESS / _REWARD_VAULT_ADDRESS");
    }
}
