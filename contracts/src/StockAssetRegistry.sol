// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title StockAssetRegistry
/// @notice Admin-controlled registry of supported tokenized stock assets.
///         The factory refuses launches paired with assets that are not
///         registered and enabled here. Ownership transfer is two-step.
contract StockAssetRegistry is Ownable2Step {
    struct StockAsset {
        address token;
        address priceFeed; // optional, address(0) when unavailable
        bool enabled;
        string symbol;
        string metadataURI; // optional
    }

    mapping(address => StockAsset) public assets;
    address[] public assetList;

    event AssetSupportedUpdated(address indexed token, string symbol, bool enabled);
    event AssetPriceFeedUpdated(address indexed token, address priceFeed);

    error ZeroAddress();
    error AssetNotRegistered();
    error AssetAlreadyRegistered();

    constructor(address initialOwner) Ownable(initialOwner) {}

    function assetCount() external view returns (uint256) {
        return assetList.length;
    }

    function isSupported(address token) public view returns (bool) {
        return assets[token].token != address(0) && assets[token].enabled;
    }

    function addAsset(address token, string calldata symbol, address priceFeed, string calldata metadataURI)
        external
        onlyOwner
    {
        if (token == address(0)) revert ZeroAddress();
        if (assets[token].token != address(0)) revert AssetAlreadyRegistered();
        assets[token] =
            StockAsset({token: token, priceFeed: priceFeed, enabled: true, symbol: symbol, metadataURI: metadataURI});
        assetList.push(token);
        emit AssetSupportedUpdated(token, symbol, true);
    }

    function setEnabled(address token, bool enabled) external onlyOwner {
        if (assets[token].token == address(0)) revert AssetNotRegistered();
        assets[token].enabled = enabled;
        emit AssetSupportedUpdated(token, assets[token].symbol, enabled);
    }

    function setPriceFeed(address token, address priceFeed) external onlyOwner {
        if (assets[token].token == address(0)) revert AssetNotRegistered();
        assets[token].priceFeed = priceFeed;
        emit AssetPriceFeedUpdated(token, priceFeed);
    }
}
