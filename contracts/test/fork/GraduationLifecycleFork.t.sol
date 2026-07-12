// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPlatformControls} from "../../src/interfaces/IPlatformControls.sol";
import {StockRouteRegistry} from "../../src/v2/StockRouteRegistry.sol";
import {UniswapV4RouterAdapter} from "../../src/v2/UniswapV4RouterAdapter.sol";
import {CreatorRewardVaultV2} from "../../src/v2/CreatorRewardVaultV2.sol";
import {RewardVaultV2} from "../../src/v2/RewardVaultV2.sol";
import {StockRewardTreasury} from "../../src/v2/StockRewardTreasury.sol";
import {MemeTokenV2} from "../../src/v2/MemeTokenV2.sol";
import {BondingCurvePoolV2} from "../../src/v2/BondingCurvePoolV2.sol";
import {V4LiquidityLocker} from "../../src/v2/graduation/V4LiquidityLocker.sol";
import {UniswapV4GraduationAdapter} from "../../src/v2/graduation/UniswapV4GraduationAdapter.sol";
import {GraduationManager} from "../../src/v2/graduation/GraduationManager.sol";

interface IStateViewLite {
    function getLiquidity(bytes32 poolId) external view returns (uint128);
}

/// @notice Full V2 lifecycle on a Robinhood Chain fork: curve trading -> cross
///         threshold (excess refunded, curve halts) -> graduate to a REAL locked
///         Uniswap V4 pool -> post-graduation curve trading disabled.
contract GraduationLifecycleForkTest is Test, IPlatformControls {
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant STATE_VIEW = 0xF3334192D15450CdD385c8B70e03f9A6bD9E673b;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;

    function tradingPaused() external pure returns (bool) {
        return false;
    }

    function claimsPaused() external pure returns (bool) {
        return false;
    }

    StockRouteRegistry registry;
    CreatorRewardVaultV2 creatorVault;
    RewardVaultV2 holderVault;
    StockRewardTreasury treasury;
    MemeTokenV2 meme;
    BondingCurvePoolV2 pool;
    V4LiquidityLocker locker;
    UniswapV4GraduationAdapter gradAdapter;
    GraduationManager gradManager;

    address creator;
    address alice;
    address bob;

    uint24 constant GRAD_FEE = 10000;
    int24 constant GRAD_TS = 200;

    function setUp() public {
        vm.createSelectFork(vm.envOr("RHC_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")));
        creator = makeAddr("creator");
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        registry = new StockRouteRegistry(address(this));
        UniswapV4RouterAdapter stockAdapter = new UniswapV4RouterAdapter(POOL_MANAGER, address(registry));
        creatorVault = new CreatorRewardVaultV2(address(this), address(this));
        locker = new V4LiquidityLocker(address(this), POOL_MANAGER, makeAddr("feeRecipient"));
        gradAdapter = new UniswapV4GraduationAdapter(address(locker));
        locker.setGraduator(address(gradAdapter));
        gradManager = new GraduationManager(address(this));

        meme = new MemeTokenV2("Grad", "GRAD", "ipfs://x");
        holderVault = new RewardVaultV2(address(meme), address(this));
        treasury = new StockRewardTreasury(
            address(this),
            address(stockAdapter),
            address(registry),
            address(creatorVault),
            address(this),
            makeAddr("protocol")
        );
        creatorVault.setNotifier(address(treasury));

        BondingCurvePoolV2.InitParams memory ip = BondingCurvePoolV2.InitParams({
            memeToken: address(meme),
            weth: WETH,
            treasury: address(treasury),
            creator: creator,
            graduationManager: address(gradManager),
            graduationAdapter: address(gradAdapter),
            gradFee: GRAD_FEE,
            gradTickSpacing: GRAD_TS,
            feeConfig: BondingCurvePoolV2.FeeConfig({
                totalFeeBps: 100, holderShareBps: 4000, creatorShareBps: 3000, protocolShareBps: 3000
            }),
            virtualQuote: 1 ether,
            virtualToken: 200_000_000 ether,
            graduationTarget: 0.5 ether
        });
        pool = new BondingCurvePoolV2(ip);

        meme.setPool(address(pool));
        meme.setRewardVault(address(holderVault));
        holderVault.initialize(address(pool), address(treasury), TSLA, WETH);
        meme.transfer(address(pool), meme.TOTAL_SUPPLY()); // fund the curve

        treasury.registerPool(address(pool), TSLA, address(holderVault), creator);
        gradManager.setFactory(address(this));
        gradManager.registerPool(address(pool));
    }

    function _buy(address who, uint256 amount) internal returns (uint256 out) {
        deal(WETH, who, amount);
        vm.prank(who);
        IERC20(WETH).approve(address(pool), amount);
        vm.prank(who);
        out = pool.buy(amount, 1);
    }

    function testFullLifecycle() public {
        // 1) normal curve buys accrue fees to the treasury
        _buy(alice, 0.3 ether);
        assertEq(uint8(pool.state()), uint8(BondingCurvePoolV2.PoolLifecycle.ACTIVE));
        (uint256 h,, uint256 p,) = treasury.pendingOf(address(pool));
        assertGt(h, 0, "no holder fee accrued");
        assertGt(p, 0, "no protocol fee accrued");
        assertGt(meme.balanceOf(alice), 0, "alice got no tokens");
        assertGt(holderVault.eligibleSupply(), 0, "eligible supply not tracked");

        // 2) crossing buy: excess refunded + curve halts
        uint256 bobWethBefore = 0.5 ether;
        deal(WETH, bob, bobWethBefore);
        vm.prank(bob);
        IERC20(WETH).approve(address(pool), bobWethBefore);
        vm.prank(bob);
        pool.buy(bobWethBefore, 1);

        assertEq(uint8(pool.state()), uint8(BondingCurvePoolV2.PoolLifecycle.READY_TO_GRADUATE), "not ready");
        assertGt(IERC20(WETH).balanceOf(bob), 0, "no refund of excess");
        assertApproxEqAbs(pool.realQuote(), 0.5 ether, 1e15, "principal not at target");

        // 3) curve trading is now disabled
        deal(WETH, alice, 0.1 ether);
        vm.prank(alice);
        IERC20(WETH).approve(address(pool), 0.1 ether);
        vm.prank(alice);
        vm.expectRevert(BondingCurvePoolV2.NotActive.selector);
        pool.buy(0.1 ether, 1);

        // 4) graduate -> real locked Uniswap pool
        (bytes32 poolId, uint128 liq) = gradManager.finalize(address(pool));
        assertEq(uint8(pool.state()), uint8(BondingCurvePoolV2.PoolLifecycle.GRADUATED), "not graduated");
        assertGt(liq, 0, "no liquidity");
        assertEq(IStateViewLite(STATE_VIEW).getLiquidity(poolId), liq, "liquidity not on-chain");
        (bool exists,,,,) = locker.positions(poolId);
        assertTrue(exists, "position not locked");

        // principal drained, unsold curve tokens burned
        assertEq(pool.realQuote(), 0, "principal not migrated");
        assertEq(meme.balanceOf(address(pool)), 0, "curve tokens not burned");

        emit log_named_uint("graduation liquidity", liq);
        emit log_named_bytes32("graduated poolId", poolId);
    }

    function testCannotGraduateWhileActive() public {
        _buy(alice, 0.1 ether); // below target -> still ACTIVE
        vm.expectRevert(); // pool.finalizeGraduation reverts NotReady inside
        gradManager.finalize(address(pool));
    }
}
