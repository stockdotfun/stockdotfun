// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title RewardEpochManager
/// @notice Epoch lifecycle + FROZEN reward-basket snapshots. At epoch start the
///         enabled assets, their weights and lot sizes are copied into immutable
///         per-epoch arrays; nothing about a started epoch can be changed
///         afterwards, so an epoch's random outcome can never be re-weighted
///         once trades exist. Inherited by ExternalTradeRewardManager.
abstract contract RewardEpochManager {
    struct Epoch {
        uint64 start;
        uint64 end;
        bool started;
    }

    uint256 public currentEpochId;
    mapping(uint256 => Epoch) public epochs;

    // Frozen basket snapshot per epoch (parallel arrays).
    mapping(uint256 => address[]) internal _epochAssets;
    mapping(uint256 => uint256[]) internal _epochWeights;
    mapping(uint256 => uint256[]) internal _epochLots;

    event EpochStarted(uint256 indexed epochId, uint64 start, uint64 end, uint256 assetCount);

    error DurationZero();
    error PreviousEpochActive();
    error EmptyBasket();

    function _startEpoch(uint64 duration, address[] memory assets_, uint256[] memory weights_, uint256[] memory lots_)
        internal
        returns (uint256 id)
    {
        if (duration == 0) revert DurationZero();
        if (assets_.length == 0) revert EmptyBasket();
        Epoch memory prev = epochs[currentEpochId];
        if (currentEpochId != 0 && block.timestamp <= prev.end) revert PreviousEpochActive();

        id = ++currentEpochId;
        epochs[id] = Epoch({start: uint64(block.timestamp), end: uint64(block.timestamp) + duration, started: true});
        _epochAssets[id] = assets_;
        _epochWeights[id] = weights_;
        _epochLots[id] = lots_;
        emit EpochStarted(id, epochs[id].start, epochs[id].end, assets_.length);
    }

    function epochActive(uint256 id) public view returns (bool) {
        Epoch memory e = epochs[id];
        return e.started && block.timestamp >= e.start && block.timestamp <= e.end;
    }

    function epochEnded(uint256 id) public view returns (bool) {
        Epoch memory e = epochs[id];
        return e.started && block.timestamp > e.end;
    }

    /// @notice The frozen basket for an epoch (assets, weights, lot sizes).
    function epochBasket(uint256 id)
        external
        view
        returns (address[] memory assets_, uint256[] memory weights_, uint256[] memory lots_)
    {
        return (_epochAssets[id], _epochWeights[id], _epochLots[id]);
    }
}
