// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IFlapDexAdapter} from "./IFlapDexAdapter.sol";

/// @title FlapDexAdapterRegistry
/// @notice On-chain allowlist of approved DEX adapters and per-token pool
///         listings for graduated Flap tokens. The gateway trades ONLY tokens
///         listed + enabled here, routed through an approved adapter — so users
///         and the frontend can never point a trade at an arbitrary pool,
///         router, or target. Listings are written by a LISTER (the verified
///         auto-listing keeper) after on-chain graduation proof; ADMIN can
///         pause, block, or override.
contract FlapDexAdapterRegistry is AccessControl {
    bytes32 public constant LISTER_ROLE = keccak256("LISTER_ROLE");

    struct TokenListing {
        address pool; // verified migrated DEX pool
        bytes32 dexId; // which approved adapter family
        bool enabled; // tradable
        uint16 buyTaxBps; // informational (from Portal getTokenV7)
        uint16 sellTaxBps;
    }

    /// @notice dexId => approved adapter (address(0) = not approved).
    mapping(bytes32 => address) public adapterOf;
    /// @notice token => listing.
    mapping(address => TokenListing) public listings;
    /// @notice hard block for malicious tokens/pools (overrides enabled).
    mapping(address => bool) public blocked;

    event AdapterApproved(bytes32 indexed dexId, address adapter);
    event AdapterRevoked(bytes32 indexed dexId);
    event TokenListed(address indexed token, address pool, bytes32 dexId, uint16 buyTaxBps, uint16 sellTaxBps);
    event TokenEnabledSet(address indexed token, bool enabled);
    event Blocked(address indexed target, bool blocked);

    error NotApprovedAdapter();
    error DexIdMismatch();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(LISTER_ROLE, admin);
    }

    // ---- adapter approvals (ADMIN) ----

    function approveAdapter(address adapter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 id = IFlapDexAdapter(adapter).dexId();
        adapterOf[id] = adapter;
        emit AdapterApproved(id, adapter);
    }

    function revokeAdapter(bytes32 dexId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        delete adapterOf[dexId];
        emit AdapterRevoked(dexId);
    }

    // ---- listings (LISTER = verified auto-listing keeper) ----

    function listToken(address token, address pool, bytes32 dexId, uint16 buyTaxBps, uint16 sellTaxBps)
        external
        onlyRole(LISTER_ROLE)
    {
        if (adapterOf[dexId] == address(0)) revert NotApprovedAdapter();
        listings[token] =
            TokenListing({pool: pool, dexId: dexId, enabled: true, buyTaxBps: buyTaxBps, sellTaxBps: sellTaxBps});
        emit TokenListed(token, pool, dexId, buyTaxBps, sellTaxBps);
    }

    // ---- pause / block (ADMIN) — never deletes history ----

    function setTokenEnabled(address token, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        listings[token].enabled = enabled;
        emit TokenEnabledSet(token, enabled);
    }

    function setBlocked(address target, bool isBlocked) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blocked[target] = isBlocked;
        emit Blocked(target, isBlocked);
    }

    // ---- resolution (view) ----

    /// @notice Resolve a token to its adapter + pool. Reverts if not tradable so
    ///         the gateway fails closed. Returns the concrete adapter to call.
    function resolve(address token)
        external
        view
        returns (address adapter, address pool, uint16 buyTaxBps, uint16 sellTaxBps)
    {
        TokenListing memory l = listings[token];
        require(l.pool != address(0) && l.enabled, "token not tradable");
        require(!blocked[token] && !blocked[l.pool], "blocked");
        adapter = adapterOf[l.dexId];
        require(adapter != address(0), "adapter revoked");
        return (adapter, l.pool, l.buyTaxBps, l.sellTaxBps);
    }

    function isTradable(address token) external view returns (bool) {
        TokenListing memory l = listings[token];
        return
            l.pool != address(0) && l.enabled && !blocked[token] && !blocked[l.pool] && adapterOf[l.dexId] != address(0);
    }
}
