// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPlatformControls} from "../../src/interfaces/IPlatformControls.sol";
import {StockRouteRegistry} from "../../src/v2/StockRouteRegistry.sol";
import {UniswapV4RouterAdapter} from "../../src/v2/UniswapV4RouterAdapter.sol";
import {RewardVaultV2} from "../../src/v2/RewardVaultV2.sol";
import {CreatorRewardVaultV2} from "../../src/v2/CreatorRewardVaultV2.sol";
import {StockRewardTreasury} from "../../src/v2/StockRewardTreasury.sol";
import {RewardConversionState} from "../../src/v2/interfaces/IStockConversion.sol";

interface IVaultCheckpoint {
    function checkpoint(address, address, uint256) external;
}

/// @dev Minimal meme token that drives the holder vault's eligible-supply hook.
contract MockMeme is ERC20 {
    address public vault;

    constructor() ERC20("Mock", "MOCK") {}

    function setVault(address v) external {
        require(vault == address(0), "set");
        vault = v;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (vault != address(0)) IVaultCheckpoint(vault).checkpoint(from, to, value);
    }
}

/// @notice End-to-end proof on a Robinhood Chain mainnet fork:
///         WETH fee -> treasury pending -> keeper convertPending ->
///         REAL TSLA delivered to the holder vault + creator vault -> claims.
///         Also proves the no-silent-fallback failure path.
contract StockConversionForkTest is Test, IPlatformControls {
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;

    // IPlatformControls (this contract acts as the "factory")
    function tradingPaused() external pure returns (bool) {
        return false;
    }

    function claimsPaused() external pure returns (bool) {
        return false;
    }

    StockRouteRegistry registry;
    UniswapV4RouterAdapter adapter;
    CreatorRewardVaultV2 creatorVault;
    RewardVaultV2 holderVault;
    StockRewardTreasury treasury;
    MockMeme meme;

    address pool;
    address creator;
    address holder;
    address protocolTreasury;

    function setUp() public {
        vm.createSelectFork(vm.envOr("RHC_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")));
        pool = makeAddr("pool");
        creator = makeAddr("creator");
        holder = makeAddr("holder");
        protocolTreasury = makeAddr("protocolTreasury");

        registry = new StockRouteRegistry(address(this));
        adapter = new UniswapV4RouterAdapter(POOL_MANAGER, address(registry));
        creatorVault = new CreatorRewardVaultV2(address(this), address(this));
        meme = new MockMeme();
        holderVault = new RewardVaultV2(address(meme), address(this));
        meme.setVault(address(holderVault));
        treasury = new StockRewardTreasury(
            address(this), address(adapter), address(registry), address(creatorVault), address(this), protocolTreasury
        );

        creatorVault.setNotifier(address(treasury));
        holderVault.initialize(pool, address(treasury), TSLA, WETH);
        treasury.setKeeper(address(this), true);
        treasury.registerPool(pool, TSLA, address(holderVault), creator);

        // Seed the verified TSLA route: base ETH/USDG (fee 460, ts 9),
        // stock TSLA/USDG (fee 3000, ts 60). TSLA sorts below USDG => c0=TSLA.
        StockRouteRegistry.StockRoute memory r = StockRouteRegistry.StockRoute({
            status: StockRouteRegistry.StockRouteStatus.VERIFIED,
            baseInputIsNative: true,
            baseHop: StockRouteRegistry.V4Pool({
                currency0: address(0), currency1: USDG, fee: 460, tickSpacing: 9, hooks: address(0)
            }),
            stockHop: StockRouteRegistry.V4Pool({
                currency0: TSLA, currency1: USDG, fee: 3000, tickSpacing: 60, hooks: address(0)
            }),
            maxWethPerConversion: 0.5 ether,
            maxSlippageBps: 300,
            maxRouteAge: 7 days,
            lastValidatedAt: 0
        });
        registry.setRoute(TSLA, r);
        registry.markValidated(TSLA);

        // Give the holder meme balance => eligible supply > 0.
        meme.mint(holder, 1_000 ether);
    }

    function _recordFees(uint256 holderWeth, uint256 creatorWeth, uint256 protocolWeth) internal {
        uint256 total = holderWeth + creatorWeth + protocolWeth;
        deal(WETH, pool, total);
        vm.prank(pool);
        IERC20(WETH).approve(address(treasury), total);
        vm.prank(pool);
        treasury.recordFees(pool, holderWeth, creatorWeth, protocolWeth);
    }

    function testFullConversionFlow() public {
        _recordFees(0.06 ether, 0.03 ether, 0.01 ether);

        (uint256 h, uint256 c, uint256 p,) = treasury.pendingOf(pool);
        assertEq(h, 0.06 ether);
        assertEq(c, 0.03 ether);
        assertEq(p, 0.01 ether);

        // Keeper converts the 0.09 holder+creator WETH -> real TSLA.
        treasury.convertPending(pool, 1 ether, 0.3 ether, block.timestamp + 600);

        // Vault now holds REAL TSLA.
        uint256 vaultTsla = IERC20(TSLA).balanceOf(address(holderVault));
        uint256 creatorTsla = creatorVault.balanceOfCreator(creator, TSLA);
        emit log_named_uint("holder-vault TSLA", vaultTsla);
        emit log_named_uint("creator TSLA", creatorTsla);
        assertGt(vaultTsla, 0, "no TSLA in holder vault");
        assertGt(creatorTsla, 0, "no TSLA credited to creator");

        // 2:1 holder:creator split (0.06 : 0.03).
        assertApproxEqRel(vaultTsla, creatorTsla * 2, 0.02e18);

        // Holder can claim real TSLA.
        uint256 claimable = holderVault.claimable(holder, TSLA);
        assertGt(claimable, 0, "holder has no claimable TSLA");
        vm.prank(holder);
        holderVault.claim(TSLA);
        assertEq(IERC20(TSLA).balanceOf(holder), claimable, "holder did not receive TSLA");

        // Creator can claim real TSLA.
        vm.prank(creator);
        creatorVault.claim(TSLA);
        assertEq(IERC20(TSLA).balanceOf(creator), creatorTsla, "creator did not receive TSLA");

        // Pending holder+creator now drained; state ACTIVE.
        (uint256 h2, uint256 c2,, RewardConversionState st) = treasury.pendingOf(pool);
        assertEq(h2, 0, "holder pending not cleared");
        assertEq(c2, 0, "creator pending not cleared");
        assertTrue(st == RewardConversionState.ACTIVE, "state not ACTIVE");
    }

    function testNoSilentFallbackOnFailure() public {
        _recordFees(0.06 ether, 0.03 ether, 0);

        // Impossible minStockOut -> adapter reverts -> treasury catches.
        treasury.convertPending(pool, 1 ether, 100000 ether, block.timestamp + 600);

        // No stock fabricated; WETH pending fully retained; state FAILED.
        assertEq(IERC20(TSLA).balanceOf(address(holderVault)), 0, "TSLA should not exist");
        assertEq(holderVault.claimable(holder, TSLA), 0, "must not credit fake rewards");
        (uint256 h, uint256 c,, RewardConversionState st) = treasury.pendingOf(pool);
        assertEq(h, 0.06 ether, "holder WETH must be retained");
        assertEq(c, 0.03 ether, "creator WETH must be retained");
        assertTrue(st == RewardConversionState.FAILED, "state not FAILED");

        // Retry with a sane bound now succeeds.
        treasury.convertPending(pool, 1 ether, 0.3 ether, block.timestamp + 600);
        assertGt(IERC20(TSLA).balanceOf(address(holderVault)), 0, "retry should deliver TSLA");
    }

    function testProtocolWethForwarded() public {
        _recordFees(0.06 ether, 0.03 ether, 0.01 ether);
        treasury.withdrawProtocol(pool);
        assertEq(IERC20(WETH).balanceOf(protocolTreasury), 0.01 ether, "protocol WETH not forwarded");
    }
}
