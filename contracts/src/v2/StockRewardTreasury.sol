// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    IStockConversionAdapter,
    IRewardVaultV2,
    ICreatorRewardVaultV2,
    RewardConversionState
} from "./interfaces/IStockConversion.sol";
import {StockRouteRegistry} from "./StockRouteRegistry.sol";

/// @title StockRewardTreasury
/// @notice Accrues holder/creator stock-reward fees in WETH per pool and
///         converts them to the paired stock token ASYNCHRONOUSLY in bounded
///         batches (never inside a user trade). Conversion is triggered by a
///         narrowly-scoped keeper: the keeper cannot pick the token (fixed per
///         pool), the recipient (this treasury), the route (registry), or any
///         calldata — only the size (bounded by the route cap) and slippage
///         floor. On failure, WETH is retained as pending and the pool enters
///         FAILED for safe retry; rewards are NEVER silently substituted with
///         WETH or fabricated.
contract StockRewardTreasury is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    IStockConversionAdapter public immutable adapter;
    StockRouteRegistry public immutable registry;
    address public immutable creatorVault; // shared CreatorRewardVaultV2
    address public immutable factory; // registers pools
    address public protocolTreasury; // receives protocol WETH

    struct PoolInfo {
        bool registered;
        address stock;
        address holderVault;
        address creator;
        uint256 pendingHolderWeth;
        uint256 pendingCreatorWeth;
        uint256 pendingProtocolWeth;
        RewardConversionState state;
    }

    mapping(address pool => PoolInfo) public pools;
    mapping(address keeper => bool) public isKeeper;

    error OnlyFactory();
    error OnlyKeeper();
    error NotRegistered();
    error AlreadyRegistered();
    error NothingPending();
    error PoolHalted();
    error NotConvertible();
    error ZeroAddress();

    event PoolRegistered(address indexed pool, address indexed stock, address holderVault, address creator);
    event FeesRecorded(address indexed pool, uint256 holderWeth, uint256 creatorWeth, uint256 protocolWeth);
    event Converted(
        address indexed pool, uint256 wethConverted, uint256 stockOut, uint256 holderStock, uint256 creatorStock
    );
    event StockConversionFailed(address indexed pool, uint256 wethAttempted, bytes reason);
    event ProtocolWithdrawn(address indexed pool, uint256 amount);
    event KeeperSet(address indexed keeper, bool enabled);
    event StateSet(address indexed pool, RewardConversionState state);
    event ProtocolTreasurySet(address treasury);

    constructor(
        address initialOwner,
        address adapter_,
        address registry_,
        address creatorVault_,
        address factory_,
        address protocolTreasury_
    ) Ownable(initialOwner) {
        if (
            adapter_ == address(0) || registry_ == address(0) || creatorVault_ == address(0) || factory_ == address(0)
                || protocolTreasury_ == address(0)
        ) revert ZeroAddress();
        adapter = IStockConversionAdapter(adapter_);
        registry = StockRouteRegistry(registry_);
        creatorVault = creatorVault_;
        factory = factory_;
        protocolTreasury = protocolTreasury_;
    }

    // ------------------------------------------------------------- factory

    function registerPool(address pool, address stock, address holderVault, address creator) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (pools[pool].registered) revert AlreadyRegistered();
        if (pool == address(0) || stock == address(0) || holderVault == address(0) || creator == address(0)) {
            revert ZeroAddress();
        }
        PoolInfo storage p = pools[pool];
        p.registered = true;
        p.stock = stock;
        p.holderVault = holderVault;
        p.creator = creator;
        p.state = RewardConversionState.PENDING;
        emit PoolRegistered(pool, stock, holderVault, creator);
    }

    // --------------------------------------------------------------- fees

    /// @notice Pool records its per-category WETH fees. The treasury PULLS the
    ///         exact total from the pool (which must have approved it), so the
    ///         recorded amounts are always fully backed.
    function recordFees(address pool, uint256 holderWeth, uint256 creatorWeth, uint256 protocolWeth)
        external
        nonReentrant
    {
        if (msg.sender != pool) revert NotRegistered();
        PoolInfo storage p = pools[pool];
        if (!p.registered) revert NotRegistered();
        uint256 total = holderWeth + creatorWeth + protocolWeth;
        if (total == 0) return;
        IERC20(WETH).safeTransferFrom(pool, address(this), total);
        p.pendingHolderWeth += holderWeth;
        p.pendingCreatorWeth += creatorWeth;
        p.pendingProtocolWeth += protocolWeth;
        emit FeesRecorded(pool, holderWeth, creatorWeth, protocolWeth);
    }

    // --------------------------------------------------------- conversion

    /// @notice Convert up to `maxWeth` of a pool's pending holder+creator WETH
    ///         into the paired stock token and distribute it to the vaults.
    ///         Keeper-only; all economic parameters are constrained on-chain.
    function convertPending(address pool, uint256 maxWeth, uint256 minStockOut, uint256 deadline)
        external
        nonReentrant
    {
        if (!isKeeper[msg.sender]) revert OnlyKeeper();
        PoolInfo storage p = pools[pool];
        if (!p.registered) revert NotRegistered();
        if (p.state == RewardConversionState.PAUSED || p.state == RewardConversionState.LOW_LIQUIDITY) {
            revert PoolHalted();
        }
        if (!registry.isConvertible(p.stock)) revert NotConvertible();

        uint256 poolPending = p.pendingHolderWeth + p.pendingCreatorWeth;
        if (poolPending == 0) revert NothingPending();
        uint256 amount = maxWeth < poolPending ? maxWeth : poolPending;
        if (amount == 0) revert NothingPending();

        uint256 holderPart = (amount * p.pendingHolderWeth) / poolPending;
        uint256 creatorPart = amount - holderPart;

        IERC20(WETH).forceApprove(address(adapter), amount);
        try adapter.convert(p.stock, amount, minStockOut, deadline, address(this)) returns (uint256 stockOut) {
            IERC20(WETH).forceApprove(address(adapter), 0);

            // reduce pending by the exact WETH consumed
            p.pendingHolderWeth -= holderPart;
            p.pendingCreatorWeth -= creatorPart;

            uint256 holderStock = (stockOut * holderPart) / amount;
            uint256 creatorStock = stockOut - holderStock;

            if (holderStock > 0) {
                IERC20(p.stock).forceApprove(p.holderVault, holderStock);
                IRewardVaultV2(p.holderVault).notifyReward(p.stock, holderStock);
            }
            if (creatorStock > 0) {
                IERC20(p.stock).forceApprove(creatorVault, creatorStock);
                ICreatorRewardVaultV2(creatorVault).notifyReward(p.creator, p.stock, creatorStock);
            }

            p.state = RewardConversionState.ACTIVE;
            emit Converted(pool, amount, stockOut, holderStock, creatorStock);
        } catch (bytes memory reason) {
            IERC20(WETH).forceApprove(address(adapter), 0);
            // No silent fallback: pending balances are untouched, WETH stays
            // fully backed, pool flagged FAILED for safe retry.
            p.state = RewardConversionState.FAILED;
            emit StockConversionFailed(pool, amount, reason);
        }
    }

    /// @notice Forward a pool's accrued protocol WETH to the protocol treasury.
    ///         Permissionless: destination is fixed.
    function withdrawProtocol(address pool) external nonReentrant {
        PoolInfo storage p = pools[pool];
        uint256 amt = p.pendingProtocolWeth;
        if (amt == 0) return;
        p.pendingProtocolWeth = 0;
        IERC20(WETH).safeTransfer(protocolTreasury, amt);
        emit ProtocolWithdrawn(pool, amt);
    }

    // --------------------------------------------------------------- admin

    function setKeeper(address keeper, bool enabled) external onlyOwner {
        isKeeper[keeper] = enabled;
        emit KeeperSet(keeper, enabled);
    }

    /// @notice Governance state control (PAUSED / LOW_LIQUIDITY / re-ACTIVE).
    function setState(address pool, RewardConversionState state) external onlyOwner {
        if (!pools[pool].registered) revert NotRegistered();
        pools[pool].state = state;
        emit StateSet(pool, state);
    }

    function setProtocolTreasury(address t) external onlyOwner {
        if (t == address(0)) revert ZeroAddress();
        protocolTreasury = t;
        emit ProtocolTreasurySet(t);
    }

    // --------------------------------------------------------------- views

    function pendingOf(address pool)
        external
        view
        returns (uint256 holderWeth, uint256 creatorWeth, uint256 protocolWeth, RewardConversionState state)
    {
        PoolInfo storage p = pools[pool];
        return (p.pendingHolderWeth, p.pendingCreatorWeth, p.pendingProtocolWeth, p.state);
    }
}
