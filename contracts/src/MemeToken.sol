// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {RewardVault} from "./RewardVault.sol";

/// @title MemeToken
/// @notice Simple ERC20 meme token launched through StockDotFunFactory.
///         Fixed supply, minted once to the factory (which seeds the pool).
///         Transfers checkpoint the reward vault so holder reward accounting
///         stays exact. Plain wallet-to-wallet transfers carry NO tax — fees
///         apply only inside the launchpad pool's buy/sell functions.
contract MemeToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;

    address public immutable factory;
    address public immutable stockAsset;
    address public immutable creator;
    string public metadataURI;

    RewardVault public rewardVault;

    error OnlyFactory();
    error VaultAlreadySet();

    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataURI_,
        address stockAsset_,
        address creator_
    ) ERC20(name_, symbol_) {
        factory = msg.sender;
        stockAsset = stockAsset_;
        creator = creator_;
        metadataURI = metadataURI_;
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    /// @notice One-time vault wiring, performed by the factory during launch.
    function setRewardVault(RewardVault vault) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (address(rewardVault) != address(0)) revert VaultAlreadySet();
        rewardVault = vault;
    }

    /// @dev Checkpoint reward accounting before balances change.
    function _update(address from, address to, uint256 value) internal override {
        RewardVault vault = rewardVault;
        if (address(vault) != address(0)) {
            vault.checkpoint(from, to, value);
        }
        super._update(from, to, value);
    }
}
