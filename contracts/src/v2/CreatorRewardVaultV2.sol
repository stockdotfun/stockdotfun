// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPlatformControls} from "../interfaces/IPlatformControls.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICreatorRewardVaultV2} from "./interfaces/IStockConversion.sol";

/// @title CreatorRewardVaultV2
/// @notice Shared vault crediting converted STOCK rewards to creators. Balances
///         are held per (creator, asset); creators withdraw their own. The only
///         depositor is the StockRewardTreasury. There is no admin withdrawal
///         path — the owner cannot move creator funds.
contract CreatorRewardVaultV2 is ICreatorRewardVaultV2, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable controls; // IPlatformControls (claimsPaused)
    address public notifier; // StockRewardTreasury
    bool private _notifierSet;

    mapping(address creator => mapping(address asset => uint256)) public balanceOfCreator;

    event RewardNotified(address indexed creator, address indexed asset, uint256 amount);
    event RewardClaimed(address indexed creator, address indexed asset, uint256 amount);
    event NotifierSet(address notifier);

    error OnlyNotifier();
    error NotifierAlreadySet();
    error ZeroAddress();
    error ClaimsArePaused();

    constructor(address controls_, address owner_) Ownable(owner_) {
        if (controls_ == address(0)) revert ZeroAddress();
        controls = controls_;
    }

    /// @notice One-time wiring of the treasury as the sole depositor.
    function setNotifier(address notifier_) external onlyOwner {
        if (_notifierSet) revert NotifierAlreadySet();
        if (notifier_ == address(0)) revert ZeroAddress();
        notifier = notifier_;
        _notifierSet = true;
        emit NotifierSet(notifier_);
    }

    /// @notice Credit `amount` of `asset` to `creator`. Only the treasury.
    ///         Caller must have approved `amount`.
    function notifyReward(address creator, address asset, uint256 amount) external nonReentrant {
        if (msg.sender != notifier) revert OnlyNotifier();
        if (creator == address(0) || asset == address(0)) revert ZeroAddress();
        if (amount == 0) return;
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        balanceOfCreator[creator][asset] += amount;
        emit RewardNotified(creator, asset, amount);
    }

    function claim(address asset) external nonReentrant returns (uint256 amount) {
        if (IPlatformControls(controls).claimsPaused()) revert ClaimsArePaused();
        amount = balanceOfCreator[msg.sender][asset];
        if (amount > 0) {
            balanceOfCreator[msg.sender][asset] = 0;
            IERC20(asset).safeTransfer(msg.sender, amount);
            emit RewardClaimed(msg.sender, asset, amount);
        }
    }
}
