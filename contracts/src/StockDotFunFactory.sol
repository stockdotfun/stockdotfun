// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {MemeToken} from "./MemeToken.sol";
import {RewardVault} from "./RewardVault.sol";
import {CreatorRewardVault} from "./CreatorRewardVault.sol";
import {BondingCurvePool} from "./BondingCurvePool.sol";
import {StockAssetRegistry} from "./StockAssetRegistry.sol";
import {IPlatformControls} from "./interfaces/IPlatformControls.sol";

/// @title StockDotFunFactory
/// @notice Deploys meme tokens paired with supported tokenized stock assets.
///         One call wires the full stack: token, holder reward vault, and
///         bonding-curve pool with fee routing.
/// @dev Ownership uses Ownable2Step (two-step transfer). Admin powers are
///      documented in docs/security/admin-powers.md and deliberately exclude
///      any ability to withdraw from holder or creator reward vaults.
contract StockDotFunFactory is Ownable2Step, IPlatformControls {
    /// Hard bounds on curve parameters. virtualQuote * virtualToken must never
    /// overflow: 1e30 * 1e33 = 1e63 << 2^256. Also prevents zero-priced curves.
    uint256 public constant MAX_VIRTUAL_QUOTE = 1e30;
    uint256 public constant MAX_VIRTUAL_TOKEN = 1e33;

    StockAssetRegistry public immutable registry;
    CreatorRewardVault public immutable creatorVault;
    address public immutable quoteAsset;

    address public treasury;
    address public routerAdapter;

    BondingCurvePool.FeeConfig public feeConfig;
    uint256 public virtualQuote;
    uint256 public virtualToken;
    uint256 public graduationTarget;

    /// Separate emergency switches (see IPlatformControls).
    bool public tradingPaused;
    bool public claimsPaused;

    address[] public allTokens;
    mapping(address => address) public poolOf;
    mapping(address => address) public vaultOf;

    event TokenCreated(
        address indexed token,
        address indexed pool,
        address indexed creator,
        address stockAsset,
        string name,
        string symbol,
        string metadataURI
    );
    event TreasuryUpdated(address indexed treasury);
    event RouterAdapterUpdated(address indexed adapter);
    event FeeConfigUpdated(uint16 totalFeeBps, uint16 holderShareBps, uint16 creatorShareBps, uint16 protocolShareBps);
    event CurveParamsUpdated(uint256 virtualQuote, uint256 virtualToken, uint256 graduationTarget);
    event TradingPausedSet(bool paused);
    event ClaimsPausedSet(bool paused);

    error ZeroAddress();
    error UnsupportedStockAsset();
    error FeeTooHigh();
    error SharesInvalid();
    error InvalidCurveParams();
    error CreationPaused();

    constructor(
        address registry_,
        address quoteAsset_,
        address treasury_,
        address routerAdapter_, // address(0) allowed: fees accrue in quote
        BondingCurvePool.FeeConfig memory feeConfig_,
        uint256 virtualQuote_,
        uint256 virtualToken_,
        uint256 graduationTarget_
    ) Ownable(msg.sender) {
        if (registry_ == address(0) || quoteAsset_ == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        _validateFees(feeConfig_);
        _validateCurve(virtualQuote_, virtualToken_);
        registry = StockAssetRegistry(registry_);
        quoteAsset = quoteAsset_;
        treasury = treasury_;
        routerAdapter = routerAdapter_;
        feeConfig = feeConfig_;
        virtualQuote = virtualQuote_;
        virtualToken = virtualToken_;
        graduationTarget = graduationTarget_;
        creatorVault = new CreatorRewardVault();
    }

    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }

    /// @notice Launch a meme token paired with a supported stock asset.
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        address stockAsset,
        uint8 creatorRewardPreference
    ) external returns (address token, address pool) {
        if (tradingPaused) revert CreationPaused();
        if (!registry.isSupported(stockAsset)) revert UnsupportedStockAsset();

        MemeToken meme = new MemeToken(name, symbol, metadataURI, stockAsset, msg.sender);
        RewardVault vault = new RewardVault(address(meme));
        BondingCurvePool curve = new BondingCurvePool(
            BondingCurvePool.InitParams({
                memeToken: address(meme),
                quoteAsset: quoteAsset,
                stockAsset: stockAsset,
                rewardVault: address(vault),
                creatorVault: address(creatorVault),
                treasury: treasury,
                creator: msg.sender,
                creatorPreference: BondingCurvePool.CreatorPreference(creatorRewardPreference),
                feeConfig: feeConfig,
                virtualQuote: virtualQuote,
                virtualToken: virtualToken,
                graduationTarget: graduationTarget,
                routerAdapter: routerAdapter
            })
        );

        vault.initialize(address(curve), quoteAsset, stockAsset);
        meme.setRewardVault(vault);
        creatorVault.registerPool(address(curve));

        // Seed the pool with the full supply (factory + pool are excluded
        // from rewards, so this transfer does not distort accounting).
        meme.transfer(address(curve), meme.TOTAL_SUPPLY());

        allTokens.push(address(meme));
        poolOf[address(meme)] = address(curve);
        vaultOf[address(meme)] = address(vault);

        emit TokenCreated(address(meme), address(curve), msg.sender, stockAsset, name, symbol, metadataURI);
        return (address(meme), address(curve));
    }

    // ---- Admin (all powers documented in docs/security/admin-powers.md) ----

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setRouterAdapter(address adapter) external onlyOwner {
        routerAdapter = adapter; // address(0) allowed: disables conversion
        emit RouterAdapterUpdated(adapter);
    }

    function setFeeConfig(BondingCurvePool.FeeConfig calldata cfg) external onlyOwner {
        _validateFees(cfg);
        feeConfig = cfg;
        emit FeeConfigUpdated(cfg.totalFeeBps, cfg.holderShareBps, cfg.creatorShareBps, cfg.protocolShareBps);
    }

    function setCurveParams(uint256 vQuote, uint256 vToken, uint256 gradTarget) external onlyOwner {
        _validateCurve(vQuote, vToken);
        virtualQuote = vQuote;
        virtualToken = vToken;
        graduationTarget = gradTarget;
        emit CurveParamsUpdated(vQuote, vToken, gradTarget);
    }

    /// @notice Emergency: halt new launches and all pool buys/sells.
    function setTradingPaused(bool paused) external onlyOwner {
        tradingPaused = paused;
        emit TradingPausedSet(paused);
    }

    /// @notice Emergency: halt holder + creator reward claims.
    function setClaimsPaused(bool paused) external onlyOwner {
        claimsPaused = paused;
        emit ClaimsPausedSet(paused);
    }

    function _validateFees(BondingCurvePool.FeeConfig memory cfg) internal pure {
        if (cfg.totalFeeBps > 1_000) revert FeeTooHigh();
        if (uint256(cfg.holderShareBps) + cfg.creatorShareBps + cfg.protocolShareBps != 10_000) {
            revert SharesInvalid();
        }
    }

    function _validateCurve(uint256 vQuote, uint256 vToken) internal pure {
        if (vQuote == 0 || vToken == 0 || vQuote > MAX_VIRTUAL_QUOTE || vToken > MAX_VIRTUAL_TOKEN) {
            revert InvalidCurveParams();
        }
    }
}
