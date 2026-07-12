// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StockRouteRegistry} from "../../src/v2/StockRouteRegistry.sol";
import {UniswapV4RouterAdapter} from "../../src/v2/UniswapV4RouterAdapter.sol";
import {CreatorRewardVaultV2} from "../../src/v2/CreatorRewardVaultV2.sol";
import {StockRewardTreasury} from "../../src/v2/StockRewardTreasury.sol";
import {BondingCurvePoolV2} from "../../src/v2/BondingCurvePoolV2.sol";
import {StockDotFunFactoryV2} from "../../src/v2/StockDotFunFactoryV2.sol";
import {V4LiquidityLocker} from "../../src/v2/graduation/V4LiquidityLocker.sol";
import {UniswapV4GraduationAdapter} from "../../src/v2/graduation/UniswapV4GraduationAdapter.sol";
import {GraduationManager} from "../../src/v2/graduation/GraduationManager.sol";

interface IStateViewLite {
    function getLiquidity(bytes32 poolId) external view returns (uint128);
}

/// @notice Proves StockDotFunFactoryV2.createToken assembles + wires a full
///         launch and that the launch trades and graduates on a mainnet fork.
contract FactoryV2ForkTest is Test {
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant STATE_VIEW = 0xF3334192D15450CdD385c8B70e03f9A6bD9E673b;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant AMZN = 0x12f190a9F9d7D37a250758b26824B97CE941bF54;

    StockRouteRegistry registry;
    StockRewardTreasury treasury;
    CreatorRewardVaultV2 creatorVault;
    StockDotFunFactoryV2 factory;
    GraduationManager gradManager;
    UniswapV4GraduationAdapter gradAdapter;
    V4LiquidityLocker locker;

    address creator;
    address alice;

    function setUp() public {
        vm.createSelectFork(vm.envOr("RHC_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")));
        creator = makeAddr("creator");
        alice = makeAddr("alice");

        registry = new StockRouteRegistry(address(this));
        _seedTsla();

        UniswapV4RouterAdapter stockAdapter = new UniswapV4RouterAdapter(POOL_MANAGER, address(registry));

        StockDotFunFactoryV2.CurveConfig memory cc = StockDotFunFactoryV2.CurveConfig({
            totalFeeBps: 100,
            holderShareBps: 4000,
            creatorShareBps: 3000,
            protocolShareBps: 3000,
            virtualQuote: 1 ether,
            virtualToken: 200_000_000 ether,
            graduationTarget: 0.5 ether,
            gradFee: 10000,
            gradTickSpacing: 200
        });
        factory = new StockDotFunFactoryV2(address(this), address(registry), cc);
        creatorVault = new CreatorRewardVaultV2(address(factory), address(this));
        treasury = new StockRewardTreasury(
            address(this),
            address(stockAdapter),
            address(registry),
            address(creatorVault),
            address(factory),
            makeAddr("protocol")
        );
        creatorVault.setNotifier(address(treasury));
        locker = new V4LiquidityLocker(address(this), POOL_MANAGER, makeAddr("feeRecipient"));
        gradAdapter = new UniswapV4GraduationAdapter(address(locker));
        locker.setGraduator(address(gradAdapter));
        gradManager = new GraduationManager(address(this));
        gradManager.setFactory(address(factory));

        factory.wire(address(treasury), address(gradManager), address(gradAdapter));
    }

    function _seedTsla() internal {
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
    }

    function testCreateTokenRejectsUnverifiedStockAndEmptyMetadata() public {
        vm.expectRevert(StockDotFunFactoryV2.StockNotVerified.selector);
        factory.createToken("X", "X", "ipfs://x", AMZN); // not verified

        vm.expectRevert(StockDotFunFactoryV2.EmptyMetadata.selector);
        factory.createToken("X", "X", "", TSLA); // blank metadata
    }

    function testCreateTradeGraduateThroughFactory() public {
        vm.prank(creator);
        (address token, address poolAddr) = factory.createToken("FactoryMeme", "FMEME", "ipfs://cid", TSLA);
        BondingCurvePoolV2 pool = BondingCurvePoolV2(poolAddr);

        assertEq(factory.allTokensLength(), 1);
        assertEq(factory.poolOf(token), poolAddr);
        assertEq(IERC20(token).balanceOf(poolAddr), 1_000_000_000 ether, "curve not funded");

        // buy across the graduation threshold in one go
        deal(WETH, alice, 1 ether);
        vm.prank(alice);
        IERC20(WETH).approve(poolAddr, 1 ether);
        vm.prank(alice);
        pool.buy(1 ether, 1);

        assertGt(IERC20(token).balanceOf(alice), 0, "alice got no tokens");
        (uint256 h,,,) = treasury.pendingOf(poolAddr);
        assertGt(h, 0, "no fees routed to treasury");
        assertEq(uint8(pool.state()), uint8(BondingCurvePoolV2.PoolLifecycle.READY_TO_GRADUATE), "not ready");

        // graduate
        (bytes32 poolId, uint128 liq) = gradManager.finalize(poolAddr);
        assertEq(uint8(pool.state()), uint8(BondingCurvePoolV2.PoolLifecycle.GRADUATED), "not graduated");
        assertGt(liq, 0);
        assertEq(IStateViewLite(STATE_VIEW).getLiquidity(poolId), liq, "no on-chain liquidity");
        assertEq(IERC20(token).balanceOf(poolAddr), 0, "excess not burned");
        emit log_named_uint("factory graduation liquidity", liq);
    }
}
