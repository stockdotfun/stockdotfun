// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IRewardRandomnessProvider} from "./IRewardRandomnessProvider.sol";

/// @title CommitRevealRandomnessProvider
/// @notice Publicly-verifiable commit-reveal randomness for reward epochs, for
///         chains without a verified VRF (the case on Robinhood Chain today).
///
///         Flow, per epoch:
///           1. Operator COMMITS keccak256(secret) BEFORE the epoch starts
///              (before any trades exist) — so the outcome can't be ground out.
///           2. After the epoch ends, operator REVEALS `secret`; the contract
///              verifies keccak256(secret) == commitment and finalizes
///              seed = keccak256(secret, epochId). Anyone can re-check the
///              preimage, so the operator cannot lie about the seed.
///
///         The operator cannot change a commitment once set, and cannot alter a
///         seed once revealed.
contract CommitRevealRandomnessProvider is IRewardRandomnessProvider, Ownable2Step {
    mapping(uint256 => bytes32) public commitmentOf; // epochId => keccak256(secret)
    mapping(uint256 => bytes32) public seedOf; // epochId => finalized seed
    mapping(uint256 => bool) public finalizedOf;

    event Committed(uint256 indexed epochId, bytes32 commitment);
    event Revealed(uint256 indexed epochId, bytes32 seed);

    error AlreadyCommitted();
    error NoCommitment();
    error AlreadyFinalized();
    error BadReveal();

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Commit keccak256(abi.encodePacked(secret)) BEFORE the epoch starts.
    function commit(uint256 epochId, bytes32 commitment) external onlyOwner {
        if (commitmentOf[epochId] != bytes32(0)) revert AlreadyCommitted();
        commitmentOf[epochId] = commitment;
        emit Committed(epochId, commitment);
    }

    /// @notice Reveal the secret AFTER the epoch ends to finalize the seed.
    function reveal(uint256 epochId, bytes32 secret) external onlyOwner {
        bytes32 c = commitmentOf[epochId];
        if (c == bytes32(0)) revert NoCommitment();
        if (finalizedOf[epochId]) revert AlreadyFinalized();
        if (keccak256(abi.encodePacked(secret)) != c) revert BadReveal();
        bytes32 seed = keccak256(abi.encode(secret, epochId));
        seedOf[epochId] = seed;
        finalizedOf[epochId] = true;
        emit Revealed(epochId, seed);
    }

    function epochSeed(uint256 epochId) external view returns (bool finalized, bytes32 seed) {
        return (finalizedOf[epochId], seedOf[epochId]);
    }
}
