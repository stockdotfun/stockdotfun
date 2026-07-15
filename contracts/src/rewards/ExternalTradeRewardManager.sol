// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {RewardEpochManager} from "./RewardEpochManager.sol";
import {ExternalTradeRewardVault} from "./ExternalTradeRewardVault.sol";
import {IRewardRandomnessProvider} from "./IRewardRandomnessProvider.sol";

/// @title ExternalTradeRewardManager
/// @notice Records reward credits for StockDotFun-attributed trades and settles
///         epoch-based random tokenized-stock rewards from the vault.
///
///         Credits are granted only by the gateway, only for eligible trades
///         (min notional, per-wallet-per-epoch cap, cooldown), and only while
///         the campaign + epoch are active. At claim time (after the epoch ends
///         and the epoch seed is finalized) the user's asset is deterministically
///         selected from the FROZEN basket via
///         keccak256(seed, epochId, user, nonce), and the REAL tokenized stock is
///         paid from the vault. Double-claim and inventory shortfall are handled
///         explicitly — never a silent substitution.
contract ExternalTradeRewardManager is RewardEpochManager, Ownable2Step, ReentrancyGuard {
    ExternalTradeRewardVault public immutable vault;
    IRewardRandomnessProvider public randomness;
    address public gateway;

    // Campaign rules (config; frozen per-epoch behaviour comes from the basket).
    bool public campaignActive;
    uint256 public minEligibleValue; // wei notional floor for a credit
    uint256 public maxCreditsPerWalletPerEpoch;
    uint64 public cooldown; // seconds between credited trades per wallet

    mapping(uint256 => mapping(address => uint256)) public creditsOf; // epoch => user => credits
    mapping(uint256 => mapping(address => uint64)) public lastCreditAt; // epoch => user => ts
    mapping(uint256 => mapping(address => bool)) public claimedOf; // epoch => user => claimed

    event GatewaySet(address gateway);
    event RandomnessSet(address randomness);
    event CampaignConfig(bool active, uint256 minEligibleValue, uint256 maxCreditsPerWalletPerEpoch, uint64 cooldown);
    event CreditRecorded(uint256 indexed epochId, address indexed trader, uint256 credits);
    event RewardClaimed(
        uint256 indexed epochId, address indexed user, address indexed asset, uint256 amount, uint256 credits
    );
    event InventoryShortfall(
        uint256 indexed epochId, address indexed user, address indexed asset, uint256 needed, uint256 available
    );

    error OnlyGateway();
    error EpochNotEnded();
    error AlreadyClaimed();
    error NoCredits();
    error SeedNotFinalized();
    error NoEligibleAsset();
    error Shortfall();

    constructor(address vault_, address owner_) Ownable(owner_) {
        vault = ExternalTradeRewardVault(vault_);
    }

    // ---- admin ----

    function setGateway(address g) external onlyOwner {
        gateway = g;
        emit GatewaySet(g);
    }

    function setRandomness(address r) external onlyOwner {
        randomness = IRewardRandomnessProvider(r);
        emit RandomnessSet(r);
    }

    function setCampaign(bool active, uint256 minEligible, uint256 maxCredits, uint64 cd) external onlyOwner {
        campaignActive = active;
        minEligibleValue = minEligible;
        maxCreditsPerWalletPerEpoch = maxCredits;
        cooldown = cd;
        emit CampaignConfig(active, minEligible, maxCredits, cd);
    }

    /// @notice Freeze the current vault basket (enabled assets + weights + lots)
    ///         into a new epoch. Reverts if the previous epoch is still active.
    function startEpoch(uint64 duration) external onlyOwner returns (uint256 id) {
        uint256 n = vault.assetCount();
        address[] memory a = new address[](n);
        uint256[] memory w = new uint256[](n);
        uint256[] memory lots = new uint256[](n);
        uint256 c;
        for (uint256 i; i < n; i++) {
            address asset = vault.assets(i);
            (bool enabled, uint16 weightBps, uint256 lotSize,,) = vault.assetConfig(asset);
            if (!enabled || weightBps == 0 || lotSize == 0) continue;
            a[c] = asset;
            w[c] = weightBps;
            lots[c] = lotSize;
            c++;
        }
        // shrink to the enabled subset
        assembly {
            mstore(a, c)
            mstore(w, c)
            mstore(lots, c)
        }
        id = _startEpoch(duration, a, w, lots);
    }

    // ---- attribution hook (gateway only) ----

    function recordTrade(address trader, uint256 quoteValueWei) external returns (uint256) {
        if (msg.sender != gateway) revert OnlyGateway();
        if (!campaignActive) return 0;
        uint256 id = currentEpochId;
        if (!epochActive(id)) return 0;
        if (quoteValueWei < minEligibleValue) return 0;
        if (creditsOf[id][trader] >= maxCreditsPerWalletPerEpoch) return 0;
        if (block.timestamp < uint256(lastCreditAt[id][trader]) + cooldown) return 0;

        creditsOf[id][trader] += 1;
        lastCreditAt[id][trader] = uint64(block.timestamp);
        emit CreditRecorded(id, trader, 1);
        return 1;
    }

    // ---- claim ----

    function claim(uint256 epochId) external nonReentrant returns (address asset, uint256 amount) {
        if (!epochEnded(epochId)) revert EpochNotEnded();
        if (claimedOf[epochId][msg.sender]) revert AlreadyClaimed();
        uint256 credits = creditsOf[epochId][msg.sender];
        if (credits == 0) revert NoCredits();
        (bool finalized, bytes32 seed) = randomness.epochSeed(epochId);
        if (!finalized) revert SeedNotFinalized();

        uint256 lot;
        (asset, lot) = _select(epochId, msg.sender, seed);
        if (asset == address(0)) revert NoEligibleAsset();
        amount = lot * credits;

        // Inventory shortfall: do NOT substitute; preserve credits; explicit signal.
        if (vault.available(asset) < amount) {
            emit InventoryShortfall(epochId, msg.sender, asset, amount, vault.available(asset));
            revert Shortfall();
        }

        claimedOf[epochId][msg.sender] = true; // effects before interaction
        vault.payout(asset, msg.sender, amount);
        emit RewardClaimed(epochId, msg.sender, asset, amount, credits);
    }

    /// @notice Deterministic, publicly-verifiable selection from the FROZEN basket.
    function _select(uint256 epochId, address user, bytes32 seed) internal view returns (address, uint256) {
        address[] storage a = _epochAssets[epochId];
        uint256[] storage w = _epochWeights[epochId];
        uint256[] storage lots = _epochLots[epochId];
        uint256 total;
        for (uint256 i; i < w.length; i++) {
            total += w[i];
        }
        if (total == 0) return (address(0), 0);
        uint256 pick = uint256(keccak256(abi.encode(seed, epochId, user, uint256(0)))) % total;
        uint256 acc;
        for (uint256 i; i < a.length; i++) {
            acc += w[i];
            if (pick < acc) return (a[i], lots[i]);
        }
        return (address(0), 0);
    }

    /// @notice Preview a user's would-be reward for a finalized epoch (UI helper).
    function previewReward(uint256 epochId, address user)
        external
        view
        returns (address asset, uint256 amount, bool ready)
    {
        (bool finalized, bytes32 seed) = randomness.epochSeed(epochId);
        if (!finalized || !epochEnded(epochId)) return (address(0), 0, false);
        uint256 credits = creditsOf[epochId][user];
        if (credits == 0) return (address(0), 0, false);
        uint256 lot;
        (asset, lot) = _select(epochId, user, seed);
        return (asset, lot * credits, asset != address(0));
    }
}
