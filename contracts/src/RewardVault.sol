// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPlatformControls} from "./interfaces/IPlatformControls.sol";

/// @title RewardVault
/// @notice Per-token holder reward vault using an accumulated-reward-per-share
///         model. Holds up to two reward assets: the quote asset (fees that
///         could not be converted yet) and the paired stock-token asset.
///         Eligible supply excludes protocol addresses (pool, factory, vault).
/// @dev Rewards are funded exclusively by pool fees; nothing is guaranteed.
contract RewardVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant ACC_PRECISION = 1e18;

    address public immutable memeToken;
    address public immutable factory;
    address public pool;

    /// reward asset => accumulated reward per eligible share
    mapping(address => uint256) public accPerShare;
    /// reward asset => rewards received while eligible supply was zero
    mapping(address => uint256) public unallocated;
    /// account => reward asset => acc value already settled
    mapping(address => mapping(address => uint256)) public accPaid;
    /// account => reward asset => settled, claimable amount
    mapping(address => mapping(address => uint256)) public accrued;
    /// addresses excluded from rewards (pool, factory, vault itself)
    mapping(address => bool) public excluded;

    address[] public rewardAssets;
    mapping(address => bool) public isRewardAsset;

    uint256 public eligibleSupply;

    event RewardNotified(address indexed asset, uint256 amount);
    event RewardClaimed(address indexed account, address indexed asset, uint256 amount);

    error OnlyFactory();
    error OnlyPool();
    error OnlyMemeToken();
    error PoolAlreadySet();
    error ZeroAddress();
    error ClaimsArePaused();

    constructor(address memeToken_) {
        if (memeToken_ == address(0)) revert ZeroAddress();
        memeToken = memeToken_;
        factory = msg.sender;
        excluded[address(this)] = true;
        excluded[msg.sender] = true;
    }

    /// @notice One-time pool wiring by the factory; registers reward assets.
    function initialize(address pool_, address quoteAsset, address stockAsset) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (pool != address(0)) revert PoolAlreadySet();
        if (pool_ == address(0) || quoteAsset == address(0) || stockAsset == address(0)) {
            revert ZeroAddress();
        }
        pool = pool_;
        excluded[pool_] = true;
        _addRewardAsset(quoteAsset);
        _addRewardAsset(stockAsset);
    }

    function _addRewardAsset(address asset) internal {
        if (!isRewardAsset[asset]) {
            isRewardAsset[asset] = true;
            rewardAssets.push(asset);
        }
    }

    /// @notice Called by the meme token before every balance change.
    function checkpoint(address from, address to, uint256 value) external {
        if (msg.sender != memeToken) revert OnlyMemeToken();
        if (from != address(0)) _settle(from);
        if (to != address(0) && to != from) _settle(to);

        // Track eligible supply across mints, burns, and exclusion boundaries.
        if (from == address(0)) {
            if (!excluded[to]) eligibleSupply += value;
        } else if (to == address(0)) {
            if (!excluded[from]) eligibleSupply -= value;
        } else {
            if (excluded[from] && !excluded[to]) eligibleSupply += value;
            else if (!excluded[from] && excluded[to]) eligibleSupply -= value;
        }
    }

    function _settle(address account) internal {
        uint256 bal = IERC20(memeToken).balanceOf(account);
        uint256 assetsLen = rewardAssets.length;
        for (uint256 i; i < assetsLen; ++i) {
            address asset = rewardAssets[i];
            uint256 acc = accPerShare[asset];
            uint256 paid = accPaid[account][asset];
            if (!excluded[account] && acc > paid && bal > 0) {
                accrued[account][asset] += (bal * (acc - paid)) / ACC_PRECISION;
            }
            accPaid[account][asset] = acc;
        }
    }

    /// @notice Pool deposits fee rewards. Caller must have approved `amount`.
    function notifyReward(address asset, uint256 amount) external nonReentrant {
        if (msg.sender != pool) revert OnlyPool();
        if (!isRewardAsset[asset]) revert ZeroAddress();
        if (amount == 0) return;
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        uint256 supply = eligibleSupply;
        if (supply == 0) {
            unallocated[asset] += amount;
        } else {
            uint256 total = amount + unallocated[asset];
            unallocated[asset] = 0;
            accPerShare[asset] += (total * ACC_PRECISION) / supply;
        }
        emit RewardNotified(asset, amount);
    }

    /// @notice Claimable amount for `account` in `asset` (view).
    function claimable(address account, address asset) external view returns (uint256) {
        uint256 pending = accrued[account][asset];
        if (!excluded[account]) {
            uint256 bal = IERC20(memeToken).balanceOf(account);
            uint256 acc = accPerShare[asset];
            uint256 paid = accPaid[account][asset];
            if (acc > paid && bal > 0) {
                pending += (bal * (acc - paid)) / ACC_PRECISION;
            }
        }
        return pending;
    }

    /// @notice Claim settled rewards in `asset`. Blocked while the factory's
    ///         claims pause is active (emergency control, trading unaffected).
    function claim(address asset) external nonReentrant returns (uint256 amount) {
        if (IPlatformControls(factory).claimsPaused()) revert ClaimsArePaused();
        _settle(msg.sender);
        amount = accrued[msg.sender][asset];
        if (amount > 0) {
            accrued[msg.sender][asset] = 0;
            IERC20(asset).safeTransfer(msg.sender, amount);
            emit RewardClaimed(msg.sender, asset, amount);
        }
    }
}
