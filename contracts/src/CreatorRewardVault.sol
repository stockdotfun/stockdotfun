// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPlatformControls} from "./interfaces/IPlatformControls.sol";

/// @title CreatorRewardVault
/// @notice Global vault tracking creator rewards across all launched tokens.
///         Pools deposit fee shares here; creators claim in whichever assets
///         accrued (WETH/ETH and/or stock tokens, per their launch preference).
contract CreatorRewardVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable factory;

    mapping(address => bool) public isPool;
    /// creator => asset => claimable amount
    mapping(address => mapping(address => uint256)) public claimable;

    event PoolRegistered(address indexed pool);
    event CreatorRewardNotified(address indexed creator, address indexed asset, uint256 amount);
    event CreatorRewardClaimed(address indexed creator, address indexed asset, uint256 amount);

    error OnlyFactory();
    error OnlyPool();
    error ZeroAddress();
    error ClaimsArePaused();

    constructor() {
        factory = msg.sender;
    }

    function registerPool(address pool) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (pool == address(0)) revert ZeroAddress();
        isPool[pool] = true;
        emit PoolRegistered(pool);
    }

    /// @notice Pool deposits a creator's fee share. Caller must have approved.
    function notify(address creator, address asset, uint256 amount) external nonReentrant {
        if (!isPool[msg.sender]) revert OnlyPool();
        if (creator == address(0) || asset == address(0)) revert ZeroAddress();
        if (amount == 0) return;
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        claimable[creator][asset] += amount;
        emit CreatorRewardNotified(creator, asset, amount);
    }

    function claim(address asset) external nonReentrant returns (uint256 amount) {
        if (IPlatformControls(factory).claimsPaused()) revert ClaimsArePaused();
        amount = claimable[msg.sender][asset];
        if (amount > 0) {
            claimable[msg.sender][asset] = 0;
            IERC20(asset).safeTransfer(msg.sender, amount);
            emit CreatorRewardClaimed(msg.sender, asset, amount);
        }
    }
}
