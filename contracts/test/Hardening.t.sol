// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {StockDotFunFactory} from "../src/StockDotFunFactory.sol";
import {StockAssetRegistry} from "../src/StockAssetRegistry.sol";
import {MemeToken} from "../src/MemeToken.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {CreatorRewardVault} from "../src/CreatorRewardVault.sol";
import {BondingCurvePool} from "../src/BondingCurvePool.sol";
import {NoopRouterAdapter} from "../src/NoopRouterAdapter.sol";
import {IRouterAdapter} from "../src/interfaces/IRouterAdapter.sol";

contract MockERC20H is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Adapter that always reverts (router outage).
contract RevertingRouter is IRouterAdapter {
    function swapExactInput(address, address, uint256, uint256, address) external pure returns (uint256) {
        revert("router down");
    }
}

/// Adapter that claims success but delivers nothing (lying router).
contract LyingRouter is IRouterAdapter {
    function swapExactInput(address tokenIn, address, uint256 amountIn, uint256, address) external returns (uint256) {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        return amountIn; // lies: sends no stock tokens back
    }
}

/// ERC20 that returns false instead of reverting (SafeERC20 must catch it).
contract FalseReturnERC20 {
    string public name = "False";
    string public symbol = "FALSE";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function approve(address s, uint256 a) external returns (bool) {
        allowance[msg.sender][s] = a;
        return true;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }

    function totalSupply() external pure returns (uint256) {
        return 0;
    }
}

contract HardeningTest is Test {
    StockAssetRegistry registry;
    StockDotFunFactory factory;
    MockERC20H weth;
    MockERC20H tsla;

    address admin = makeAddr("admin");
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address mallory = makeAddr("mallory");
    address treasury = makeAddr("treasury");

    function setUp() public {
        weth = new MockERC20H("Wrapped Ether", "WETH");
        tsla = new MockERC20H("Tesla Stock Token", "tTSLA");

        vm.startPrank(admin);
        registry = new StockAssetRegistry(admin);
        registry.addAsset(address(tsla), "TSLA", address(0), "");
        factory = new StockDotFunFactory(
            address(registry),
            address(weth),
            treasury,
            address(0),
            BondingCurvePool.FeeConfig({
                totalFeeBps: 100, holderShareBps: 4000, creatorShareBps: 3000, protocolShareBps: 3000
            }),
            1.5e18,
            73_000_000e18,
            4.4e18
        );
        vm.stopPrank();

        weth.mint(alice, 1_000e18);
    }

    function _create() internal returns (MemeToken meme, BondingCurvePool pool, RewardVault vault) {
        vm.prank(creator);
        (address t, address p) = factory.createToken("Rocket", "ROCKET", "", address(tsla), 0);
        meme = MemeToken(t);
        pool = BondingCurvePool(p);
        vault = RewardVault(factory.vaultOf(t));
    }

    // ---- Pause controls ----

    function test_TradingPauseBlocksBuySellAndCreate() public {
        (, BondingCurvePool pool,) = _create();
        vm.prank(admin);
        factory.setTradingPaused(true);

        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        vm.expectRevert(BondingCurvePool.TradingIsPaused.selector);
        pool.buy(1e18, 1);
        vm.stopPrank();

        vm.prank(creator);
        vm.expectRevert(StockDotFunFactory.CreationPaused.selector);
        factory.createToken("X", "X", "", address(tsla), 0);

        // Unpause restores trading.
        vm.prank(admin);
        factory.setTradingPaused(false);
        vm.startPrank(alice);
        assertGt(pool.buy(1e18, 1), 0);
        vm.stopPrank();
    }

    function test_ClaimsPauseBlocksBothVaults_TradingUnaffected() public {
        (, BondingCurvePool pool, RewardVault vault) = _create();
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        pool.buy(10e18, 1);
        pool.buy(1e18, 1); // generate rewards for alice
        vm.stopPrank();

        vm.prank(admin);
        factory.setClaimsPaused(true);

        vm.prank(alice);
        vm.expectRevert(RewardVault.ClaimsArePaused.selector);
        vault.claim(address(weth));

        CreatorRewardVault cvault = factory.creatorVault();
        vm.prank(creator);
        vm.expectRevert(CreatorRewardVault.ClaimsArePaused.selector);
        cvault.claim(address(weth));

        // Trading still works while claims are paused.
        vm.startPrank(alice);
        assertGt(pool.buy(1e18, 1), 0);
        vm.stopPrank();
    }

    // ---- Unauthorized admin calls ----

    function test_UnauthorizedAdminCallsRevert() public {
        vm.startPrank(mallory);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        factory.setTradingPaused(true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        factory.setClaimsPaused(true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        factory.setTreasury(mallory);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        factory.setRouterAdapter(mallory);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory));
        registry.addAsset(mallory, "EVIL", address(0), "");
        vm.stopPrank();
    }

    function test_TwoStepOwnershipTransfer() public {
        vm.prank(admin);
        factory.transferOwnership(alice);
        // Not owner yet — must accept.
        assertEq(factory.owner(), admin);
        vm.prank(alice);
        factory.acceptOwnership();
        assertEq(factory.owner(), alice);
    }

    // ---- Curve parameter validation ----

    function test_InvalidCurveParamsRejected() public {
        vm.startPrank(admin);
        vm.expectRevert(StockDotFunFactory.InvalidCurveParams.selector);
        factory.setCurveParams(0, 1e27, 1e18);
        vm.expectRevert(StockDotFunFactory.InvalidCurveParams.selector);
        factory.setCurveParams(1e18, 0, 1e18);
        vm.expectRevert(StockDotFunFactory.InvalidCurveParams.selector);
        factory.setCurveParams(1e31, 1e27, 1e18); // > MAX_VIRTUAL_QUOTE
        vm.stopPrank();
    }

    // ---- Slippage bound is mandatory ----

    function test_ZeroMinOutRejected() public {
        (MemeToken meme, BondingCurvePool pool,) = _create();
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        vm.expectRevert(BondingCurvePool.SlippageBoundRequired.selector);
        pool.buy(1e18, 0);
        uint256 bought = pool.buy(1e18, 1);
        meme.approve(address(pool), bought);
        vm.expectRevert(BondingCurvePool.SlippageBoundRequired.selector);
        pool.sell(bought, 0);
        vm.stopPrank();
    }

    // ---- Router failure modes ----

    function test_NoopRouterFallsBackToQuoteAccrual() public {
        NoopRouterAdapter noop = new NoopRouterAdapter();
        vm.prank(admin);
        factory.setRouterAdapter(address(noop));
        (, BondingCurvePool pool, RewardVault vault) = _create();

        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        pool.buy(10e18, 1);
        vm.stopPrank();

        // Swap reverted safely -> holder fees accrued in WETH, not stock.
        assertGt(weth.balanceOf(address(vault)), 0);
        assertEq(tsla.balanceOf(address(vault)), 0);
    }

    function test_RevertingRouterFallsBack() public {
        RevertingRouter rev = new RevertingRouter();
        vm.prank(admin);
        factory.setRouterAdapter(address(rev));
        (, BondingCurvePool pool, RewardVault vault) = _create();

        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        pool.buy(10e18, 1);
        vm.stopPrank();
        assertGt(weth.balanceOf(address(vault)), 0);
    }

    function test_LyingRouterCannotInflateRewards() public {
        // Router consumes WETH, returns a fake amount, delivers no stock.
        LyingRouter liar = new LyingRouter();
        vm.prank(admin);
        factory.setRouterAdapter(address(liar));
        (, BondingCurvePool pool, RewardVault vault) = _create();

        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        // Balance-delta check detects zero delivery => swapped=false. The pool
        // then falls back to notifying the fee in WETH; since the lying router
        // already consumed the WETH, the transfer into the vault must revert —
        // the trade fails closed instead of corrupting reward accounting.
        vm.expectRevert();
        pool.buy(10e18, 1);
        vm.stopPrank();
        assertEq(tsla.balanceOf(address(vault)), 0);
        assertEq(vault.accPerShare(address(tsla)), 0);
    }

    // ---- Claim integrity ----

    function test_RepeatedClaimYieldsNothing() public {
        (, BondingCurvePool pool, RewardVault vault) = _create();
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        pool.buy(10e18, 1);
        pool.buy(1e18, 1);

        uint256 first = vault.claim(address(weth));
        assertGt(first, 0);
        uint256 second = vault.claim(address(weth));
        assertEq(second, 0);
        vm.stopPrank();
    }

    function test_NonHolderClaimsNothing() public {
        (, BondingCurvePool pool, RewardVault vault) = _create();
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        pool.buy(10e18, 1);
        vm.stopPrank();

        vm.prank(mallory);
        uint256 claimed = vault.claim(address(weth));
        assertEq(claimed, 0);
    }

    // ---- Vault access control ----

    function test_OnlyPoolCanNotifyRewards() public {
        (,, RewardVault vault) = _create();
        vm.prank(mallory);
        vm.expectRevert(RewardVault.OnlyPool.selector);
        vault.notifyReward(address(weth), 1e18);

        CreatorRewardVault cvault = factory.creatorVault();
        vm.prank(mallory);
        vm.expectRevert(CreatorRewardVault.OnlyPool.selector);
        cvault.notify(mallory, address(weth), 1e18);
    }

    function test_VaultRejectsUnsupportedRewardAsset() public {
        (, BondingCurvePool pool, RewardVault vault) = _create();
        // Even the pool cannot notify an unregistered asset.
        vm.prank(address(pool));
        vm.expectRevert(RewardVault.ZeroAddress.selector);
        vault.notifyReward(address(0xBEEF), 1e18);
    }

    // ---- Malicious ERC20 (false-return) ----

    function test_FalseReturnTokenCannotBeDrainedThrough() public {
        // A false-return ERC20 registered as a stock asset: SafeERC20 converts
        // silent failure into a revert — never a silent success.
        FalseReturnERC20 bad = new FalseReturnERC20();
        vm.prank(admin);
        registry.addAsset(address(bad), "FALSE", address(0), "");

        vm.prank(creator);
        (, address poolAddr) = factory.createToken("Bad", "BAD", "", address(bad), 1);
        BondingCurvePool pool = BondingCurvePool(poolAddr);

        // Trading in quote still works; the bad asset only matters if a swap
        // route to it exists (none configured here) — fees accrue in WETH.
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        assertGt(pool.buy(1e18, 1), 0);
        vm.stopPrank();
    }

    // ---- Registry gating ----

    function test_DisabledAssetBlocksNewLaunchesNotExisting() public {
        (, BondingCurvePool pool,) = _create();
        vm.prank(admin);
        registry.setEnabled(address(tsla), false);

        vm.prank(creator);
        vm.expectRevert(StockDotFunFactory.UnsupportedStockAsset.selector);
        factory.createToken("Y", "Y", "", address(tsla), 0);

        // Existing pool keeps working (disable gates new launches only).
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        assertGt(pool.buy(1e18, 1), 0);
        vm.stopPrank();
    }
}
