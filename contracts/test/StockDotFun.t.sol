// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StockDotFunFactory} from "../src/StockDotFunFactory.sol";
import {StockAssetRegistry} from "../src/StockAssetRegistry.sol";
import {MemeToken} from "../src/MemeToken.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {CreatorRewardVault} from "../src/CreatorRewardVault.sol";
import {BondingCurvePool} from "../src/BondingCurvePool.sol";
import {IRouterAdapter} from "../src/interfaces/IRouterAdapter.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _decimals = d;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Swaps quote -> stock 1:1 by minting stock to the recipient.
contract MockRouter is IRouterAdapter {
    MockERC20 public immutable stock;

    constructor(MockERC20 stock_) {
        stock = stock_;
    }

    function swapExactInput(address tokenIn, address, uint256 amountIn, uint256, address recipient)
        external
        returns (uint256)
    {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        stock.mint(recipient, amountIn);
        return amountIn;
    }
}

contract StockDotFunTest is Test {
    StockAssetRegistry registry;
    StockDotFunFactory factory;
    MockERC20 weth;
    MockERC20 tsla;
    MockRouter router;

    address admin = makeAddr("admin");
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address treasury = makeAddr("treasury");

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        tsla = new MockERC20("Tesla Stock Token", "tTSLA", 18);
        router = new MockRouter(tsla);

        vm.startPrank(admin);
        registry = new StockAssetRegistry(admin);
        registry.addAsset(address(tsla), "TSLA", address(0), "");
        factory = new StockDotFunFactory(
            address(registry),
            address(weth),
            treasury,
            address(0), // no router by default: fail-safe path
            BondingCurvePool.FeeConfig({
                totalFeeBps: 100, // 1%
                holderShareBps: 4000,
                creatorShareBps: 3000,
                protocolShareBps: 3000
            }),
            10_000e18, // virtual quote
            1_073_000_000e18, // virtual token
            69_000e18 // graduation target
        );
        vm.stopPrank();

        weth.mint(alice, 1_000_000e18);
        weth.mint(bob, 1_000_000e18);
    }

    function _createToken() internal returns (MemeToken meme, BondingCurvePool pool, RewardVault vault) {
        vm.prank(creator);
        (address t, address p) = factory.createToken("Rocket", "ROCKET", "ipfs://meta", address(tsla), 0);
        meme = MemeToken(t);
        pool = BondingCurvePool(p);
        vault = RewardVault(factory.vaultOf(t));
    }

    // ---- Creation ----

    function test_CreateToken() public {
        (MemeToken meme, BondingCurvePool pool,) = _createToken();
        assertEq(meme.creator(), creator);
        assertEq(meme.stockAsset(), address(tsla));
        assertEq(meme.balanceOf(address(pool)), meme.TOTAL_SUPPLY());
        assertEq(factory.allTokensLength(), 1);
        assertEq(factory.poolOf(address(meme)), address(pool));
    }

    function test_RejectUnsupportedStockAsset() public {
        MockERC20 fake = new MockERC20("Fake", "FAKE", 18);
        vm.prank(creator);
        vm.expectRevert(StockDotFunFactory.UnsupportedStockAsset.selector);
        factory.createToken("Bad", "BAD", "", address(fake), 0);
    }

    function test_RejectDisabledAsset() public {
        vm.prank(admin);
        registry.setEnabled(address(tsla), false);
        vm.prank(creator);
        vm.expectRevert(StockDotFunFactory.UnsupportedStockAsset.selector);
        factory.createToken("Bad", "BAD", "", address(tsla), 0);
    }

    // ---- Trading ----

    function test_BuyToken() public {
        (MemeToken meme, BondingCurvePool pool,) = _createToken();
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        uint256 out = pool.buy(1_000e18, 1);
        vm.stopPrank();
        assertGt(out, 0);
        assertEq(meme.balanceOf(alice), out);
    }

    function test_SellToken() public {
        (MemeToken meme, BondingCurvePool pool,) = _createToken();
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        uint256 bought = pool.buy(1_000e18, 1);
        meme.approve(address(pool), bought);
        uint256 balBefore = weth.balanceOf(alice);
        uint256 quoteOut = pool.sell(bought, 1);
        vm.stopPrank();
        assertGt(quoteOut, 0);
        assertEq(weth.balanceOf(alice), balBefore + quoteOut);
    }

    function test_SlippageProtection() public {
        (, BondingCurvePool pool,) = _createToken();
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        (uint256 expected,) = pool.quoteBuy(1_000e18);
        vm.expectRevert(BondingCurvePool.SlippageExceeded.selector);
        pool.buy(1_000e18, expected + 1);
        vm.stopPrank();
    }

    // ---- Fee split ----

    function test_FeeSplitRouting() public {
        (, BondingCurvePool pool, RewardVault vault) = _createToken();
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        pool.buy(1_000e18, 1);
        vm.stopPrank();

        uint256 fee = (1_000e18 * 100) / 10_000; // 1% = 10e18
        assertEq(weth.balanceOf(treasury), (fee * 3000) / 10_000);
        assertEq(weth.balanceOf(address(vault)), (fee * 4000) / 10_000);
        // creator share sits in the creator vault
        assertEq(factory.creatorVault().claimable(creator, address(weth)), (fee * 3000) / 10_000);
    }

    // ---- Holder rewards ----

    function test_HolderRewardAccrualAndClaim() public {
        (MemeToken meme, BondingCurvePool pool, RewardVault vault) = _createToken();

        // Alice buys and becomes the only eligible holder.
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        pool.buy(100e18, 1);
        vm.stopPrank();

        // Bob trades, generating fees that accrue to Alice.
        vm.startPrank(bob);
        weth.approve(address(pool), type(uint256).max);
        pool.buy(50e18, 1);
        vm.stopPrank();

        uint256 claimableAmt = vault.claimable(alice, address(weth));
        assertGt(claimableAmt, 0);

        vm.prank(alice);
        uint256 claimed = vault.claim(address(weth));
        assertEq(claimed, claimableAmt);
        assertEq(weth.balanceOf(alice), 1_000_000e18 - 100e18 + claimed);

        // Transfers keep accounting exact (checkpoint runs on _update).
        // Read the balance before pranking — an inline balanceOf() call would
        // otherwise consume the vm.prank and run transfer as the test contract.
        uint256 half = meme.balanceOf(alice) / 2;
        vm.prank(alice);
        meme.transfer(bob, half);
    }

    // ---- Creator rewards ----

    function test_CreatorRewardClaim() public {
        (, BondingCurvePool pool,) = _createToken();
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        pool.buy(1_000e18, 1);
        vm.stopPrank();

        // Resolve the vault first — vm.prank only affects the next external
        // call, so calling factory.creatorVault() inline would consume it.
        CreatorRewardVault cvault = factory.creatorVault();
        uint256 claimableAmt = cvault.claimable(creator, address(weth));
        assertGt(claimableAmt, 0);
        vm.prank(creator);
        uint256 claimed = cvault.claim(address(weth));
        assertEq(claimed, claimableAmt);
        assertEq(weth.balanceOf(creator), claimed);
    }

    // ---- Router conversion path ----

    function test_RouterConvertsHolderShareToStock() public {
        vm.prank(admin);
        factory.setRouterAdapter(address(router));

        (, BondingCurvePool pool, RewardVault vault) = _createToken();
        vm.startPrank(alice);
        weth.approve(address(pool), type(uint256).max);
        pool.buy(100e18, 1);
        // second buy generates rewards for alice (now an eligible holder)
        pool.buy(50e18, 1);
        vm.stopPrank();

        assertGt(tsla.balanceOf(address(vault)), 0);
        assertGt(vault.claimable(alice, address(tsla)), 0);
    }

    // ---- Admin ----

    function test_AdminUpdatesSupportedAsset() public {
        vm.prank(admin);
        registry.setEnabled(address(tsla), false);
        assertFalse(registry.isSupported(address(tsla)));
        vm.prank(admin);
        registry.setEnabled(address(tsla), true);
        assertTrue(registry.isSupported(address(tsla)));
    }

    function test_NonAdminCannotUpdateRegistry() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.setEnabled(address(tsla), false);
    }

    function test_FeeCapEnforced() public {
        vm.prank(admin);
        vm.expectRevert(StockDotFunFactory.FeeTooHigh.selector);
        factory.setFeeConfig(
            BondingCurvePool.FeeConfig({
                totalFeeBps: 1_001, holderShareBps: 4000, creatorShareBps: 3000, protocolShareBps: 3000
            })
        );
    }
}
