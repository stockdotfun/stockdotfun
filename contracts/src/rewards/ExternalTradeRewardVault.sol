// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ExternalTradeRewardVault
/// @notice Inventory-backed reward vault holding SUPPORTED tokenized-stock
///         assets (from StockDotFun's verified stock registry). Rewards are only
///         ever paid in tokens actually held here — the manager checks
///         `available()` before finalizing a payout, so the UI never promises an
///         unfunded asset. Only the reward manager (MANAGER_ROLE) can pay out.
contract ExternalTradeRewardVault is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct AssetConfig {
        bool enabled;
        uint16 weightBps; // selection weight (relative)
        uint256 lotSize; // payout per credit
        uint256 minInventory; // floor below which the asset is skipped
        uint256 reserved; // inventory reserved (not payable)
    }

    mapping(address => AssetConfig) public assetConfig;
    address[] public assets; // all ever-configured assets (never deleted)
    mapping(address => bool) private _known;

    event AssetConfigured(address indexed asset, bool enabled, uint16 weightBps, uint256 lotSize);
    event Funded(address indexed asset, address indexed from, uint256 amount);
    event PaidOut(address indexed asset, address indexed to, uint256 amount);
    event Withdrawn(address indexed asset, address indexed to, uint256 amount);

    error InsufficientInventory();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---- config (ADMIN) ----

    /// @notice Configure a reward asset. Caller must pass a VERIFIED stock-token
    ///         address from StockDotFun's registry (enforced off-chain by admin).
    function configureAsset(
        address asset,
        bool enabled,
        uint16 weightBps,
        uint256 lotSize,
        uint256 minInventory,
        uint256 reserved
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        assetConfig[asset] = AssetConfig({
            enabled: enabled, weightBps: weightBps, lotSize: lotSize, minInventory: minInventory, reserved: reserved
        });
        if (!_known[asset]) {
            _known[asset] = true;
            assets.push(asset);
        }
        emit AssetConfigured(asset, enabled, weightBps, lotSize);
    }

    // ---- funding ----

    function fund(address asset, uint256 amount) external {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(asset, msg.sender, amount);
    }

    /// @notice ADMIN can pull unallocated inventory back out (e.g. wind-down).
    function withdraw(address asset, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(asset).safeTransfer(to, amount);
        emit Withdrawn(asset, to, amount);
    }

    // ---- payout (MANAGER only) ----

    function payout(address asset, address to, uint256 amount) external onlyRole(MANAGER_ROLE) {
        if (amount == 0 || amount > available(asset)) revert InsufficientInventory();
        IERC20(asset).safeTransfer(to, amount);
        emit PaidOut(asset, to, amount);
    }

    // ---- views ----

    /// @notice Payable inventory = balance minus reserved.
    function available(address asset) public view returns (uint256) {
        uint256 bal = IERC20(asset).balanceOf(address(this));
        uint256 r = assetConfig[asset].reserved;
        return bal > r ? bal - r : 0;
    }

    /// @notice True when the asset is enabled AND funded above its minimum.
    function isPayable(address asset) external view returns (bool) {
        AssetConfig memory c = assetConfig[asset];
        return c.enabled && available(asset) >= c.minInventory && c.lotSize > 0;
    }

    function assetCount() external view returns (uint256) {
        return assets.length;
    }
}
