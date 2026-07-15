// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IRewardRandomnessProvider
/// @notice Pluggable randomness source for reward epochs. One finalized seed per
///         epoch. Implementations must NOT let anyone choose the seed after
///         trades/users are known (no block.timestamp, no same-block blockhash,
///         no admin-picked number). Preferred: a verified VRF; fallback: a
///         publicly-verifiable commit-reveal (see CommitRevealRandomnessProvider).
interface IRewardRandomnessProvider {
    /// @param epochId the reward epoch
    /// @return finalized whether the seed is finalized and safe to use
    /// @return seed the finalized random seed (bytes32(0) when not finalized)
    function epochSeed(uint256 epochId) external view returns (bool finalized, bytes32 seed);
}
