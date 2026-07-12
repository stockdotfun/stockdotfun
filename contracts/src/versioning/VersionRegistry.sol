// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title VersionRegistry
/// @notice Canonical, on-chain record of StockDotFun protocol deployments. The
///         frontend and integrators read this to know which factory is the
///         ACTIVE one for new launches and which are DEPRECATED (read/claim
///         only). V1 is immutable and cannot be upgraded, so V2 is a separate
///         deployment recorded here; V1 is marked deprecated, not patched.
contract VersionRegistry is Ownable2Step {
    struct Deployment {
        uint16 version; // e.g. 1, 2
        bool active; // eligible for new launches
        address factory;
        address treasury; // 0 for V1 (fees went straight to treasury EOA)
        address graduationManager; // 0 for V1 (no graduation)
        address stockRouteRegistry; // 0 for V1
        string label; // human label, e.g. "StockDotFun V2"
    }

    uint16[] public versions;
    mapping(uint16 version => Deployment) private _deployments;
    mapping(uint16 version => bool) public known;
    uint16 public activeVersion;

    error UnknownVersion();
    error ZeroFactory();

    event DeploymentSet(uint16 indexed version, address factory, bool active, string label);
    event ActiveVersionSet(uint16 indexed version);
    event DeploymentDeprecated(uint16 indexed version);

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Record or replace a deployment.
    function setDeployment(Deployment calldata d) external onlyOwner {
        if (d.factory == address(0)) revert ZeroFactory();
        if (!known[d.version]) {
            known[d.version] = true;
            versions.push(d.version);
        }
        _deployments[d.version] = d;
        if (d.active) activeVersion = d.version;
        emit DeploymentSet(d.version, d.factory, d.active, d.label);
    }

    /// @notice Set which version is active for new launches; all others are
    ///         implicitly legacy. Emits deprecation for the previous active.
    function setActiveVersion(uint16 version) external onlyOwner {
        if (!known[version]) revert UnknownVersion();
        uint16 prev = activeVersion;
        if (prev != 0 && prev != version) {
            _deployments[prev].active = false;
            emit DeploymentDeprecated(prev);
        }
        _deployments[version].active = true;
        activeVersion = version;
        emit ActiveVersionSet(version);
    }

    function getDeployment(uint16 version) external view returns (Deployment memory) {
        if (!known[version]) revert UnknownVersion();
        return _deployments[version];
    }

    function getActive() external view returns (Deployment memory) {
        if (!known[activeVersion]) revert UnknownVersion();
        return _deployments[activeVersion];
    }

    function versionsLength() external view returns (uint256) {
        return versions.length;
    }
}
