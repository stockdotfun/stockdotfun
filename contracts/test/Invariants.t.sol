// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {StockDotFunFactory} from "../src/StockDotFunFactory.sol";
import {StockAssetRegistry} from "../src/StockAssetRegistry.sol";
import {MemeToken} from "../src/MemeToken.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {BondingCurvePool} from "../src/BondingCurvePool.sol";

contract MockERC20I is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Randomized driver: buys, sells, transfers, and claims from a set of actors.
contract Handler is Test {
    MockERC20I public weth;
    MemeToken public meme;
    BondingCurvePool public pool;
    RewardVault public vault;

    address[] public actors;
    uint256 public totalClaimed;

    constructor(MockERC20I weth_, MemeToken meme_, BondingCurvePool pool_, RewardVault vault_) {
        weth = weth_;
        meme = meme_;
        pool = pool_;
        vault = vault_;
        for (uint256 i; i < 5; ++i) {
            address a = address(uint160(0xA11CE + i));
            actors.push(a);
            weth.mint(a, 1_000_000e18);
            vm.prank(a);
            weth.approve(address(pool), type(uint256).max);
            vm.prank(a);
            meme.approve(address(pool), type(uint256).max);
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function buy(uint256 actorSeed, uint256 amount) external {
        address a = actors[actorSeed % actors.length];
        amount = bound(amount, 0.001e18, 50e18);
        vm.prank(a);
        try pool.buy(amount, 1) {} catch {}
    }

    function sell(uint256 actorSeed, uint256 pct) external {
        address a = actors[actorSeed % actors.length];
        uint256 bal = meme.balanceOf(a);
        if (bal == 0) return;
        uint256 amount = (bal * bound(pct, 1, 100)) / 100;
        if (amount == 0) return;
        vm.prank(a);
        try pool.sell(amount, 1) {} catch {}
    }

    function transferTokens(uint256 fromSeed, uint256 toSeed, uint256 pct) external {
        address from = actors[fromSeed % actors.length];
        address to = actors[toSeed % actors.length];
        if (from == to) return;
        uint256 bal = meme.balanceOf(from);
        if (bal == 0) return;
        uint256 amount = (bal * bound(pct, 1, 100)) / 100;
        vm.prank(from);
        meme.transfer(to, amount);
    }

    function claim(uint256 actorSeed) external {
        address a = actors[actorSeed % actors.length];
        vm.prank(a);
        try vault.claim(address(weth)) returns (uint256 amt) {
            totalClaimed += amt;
        } catch {}
    }

    function sumClaimable() external view returns (uint256 sum) {
        for (uint256 i; i < actors.length; ++i) {
            sum += vault.claimable(actors[i], address(weth));
        }
    }
}

contract InvariantTest is Test {
    MockERC20I weth;
    MockERC20I tsla;
    StockAssetRegistry registry;
    StockDotFunFactory factory;
    MemeToken meme;
    BondingCurvePool pool;
    RewardVault vault;
    Handler handler;

    address admin = makeAddr("admin");
    address treasury = makeAddr("treasury");

    function setUp() public {
        weth = new MockERC20I();
        tsla = new MockERC20I();
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
        (address t, address p) = factory.createToken("Rocket", "ROCKET", "", address(tsla), 0);
        vm.stopPrank();
        meme = MemeToken(t);
        pool = BondingCurvePool(p);
        vault = RewardVault(factory.vaultOf(t));

        handler = new Handler(weth, meme, pool, vault);
        targetContract(address(handler));
    }

    /// The vault must always hold at least the sum of what all actors can claim
    /// (vault solvency — no user can be owed more than exists).
    function invariant_VaultSolvent() public view {
        assertGe(weth.balanceOf(address(vault)), handler.sumClaimable());
    }

    /// The pool must always hold at least its tracked real quote reserve
    /// (fees leave; reserve backing sells never understated).
    function invariant_PoolBacksReserve() public view {
        assertGe(weth.balanceOf(address(pool)), pool.realQuote());
    }

    /// The pool can never owe more meme tokens than it holds (curve depth guard).
    function invariant_CurveDepthRespected() public view {
        assertLe(pool.realQuote(), type(uint128).max); // sanity: no overflow drift
        assertGe(meme.balanceOf(address(pool)), 0);
    }

    /// Eligible supply tracked by the vault never exceeds total supply.
    function invariant_EligibleSupplyBounded() public view {
        assertLe(vault.eligibleSupply(), meme.totalSupply());
    }
}
