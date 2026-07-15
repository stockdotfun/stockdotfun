// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ExternalTradeRewardVault} from "../src/rewards/ExternalTradeRewardVault.sol";
import {ExternalTradeRewardManager} from "../src/rewards/ExternalTradeRewardManager.sol";
import {CommitRevealRandomnessProvider} from "../src/rewards/CommitRevealRandomnessProvider.sol";

contract MockStock is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// @notice Unit + invariant coverage for the inventory-backed, epoch-based,
///         commit-reveal random stock-reward system. No mainnet funds required.
contract RewardSystemTest is Test {
    ExternalTradeRewardVault vault;
    ExternalTradeRewardManager manager;
    CommitRevealRandomnessProvider rng;
    MockStock aapl;
    MockStock nvda;

    address admin = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    bytes32 constant SECRET = keccak256("epoch-1-secret");

    function setUp() public {
        vault = new ExternalTradeRewardVault(admin);
        manager = new ExternalTradeRewardManager(address(vault), admin);
        rng = new CommitRevealRandomnessProvider(admin);
        vault.grantRole(vault.MANAGER_ROLE(), address(manager));
        manager.setRandomness(address(rng));
        manager.setGateway(address(this)); // this test acts as the gateway

        aapl = new MockStock("Apple", "AAPL");
        nvda = new MockStock("Nvidia", "NVDA");
        aapl.mint(address(this), 1_000_000e18);
        nvda.mint(address(this), 1_000_000e18);

        // lot 10 tokens per credit; equal weights.
        vault.configureAsset(address(aapl), true, 5000, 10e18, 1e18, 0);
        vault.configureAsset(address(nvda), true, 5000, 10e18, 1e18, 0);
        IERC20(aapl).approve(address(vault), type(uint256).max);
        IERC20(nvda).approve(address(vault), type(uint256).max);
        vault.fund(address(aapl), 1000e18);
        vault.fund(address(nvda), 1000e18);

        manager.setCampaign(true, 0.01 ether, 5, 0);
    }

    function _openEpoch(uint64 duration) internal returns (uint256 id) {
        rng.commit(1, keccak256(abi.encodePacked(SECRET))); // commit BEFORE epoch
        id = manager.startEpoch(duration);
    }

    function test_fullLifecycle_creditThenClaimRealStock() public {
        uint256 id = _openEpoch(1 days);
        // alice makes 3 eligible trades
        for (uint256 i; i < 3; i++) {
            manager.recordTrade(alice, 1 ether);
        }
        assertEq(manager.creditsOf(id, alice), 3, "credits not recorded");

        vm.warp(block.timestamp + 1 days + 1); // epoch ends
        rng.reveal(1, SECRET); // finalize seed

        (address preAsset, uint256 preAmt, bool ready) = manager.previewReward(id, alice);
        assertTrue(ready, "preview not ready");
        assertEq(preAmt, 30e18, "expected 3 credits * 10 lot");

        vm.prank(alice);
        (address asset, uint256 amount) = manager.claim(id);
        assertEq(asset, preAsset, "claim asset != preview");
        assertEq(amount, 30e18, "wrong payout amount");
        assertEq(IERC20(asset).balanceOf(alice), 30e18, "alice did not receive real stock");
        // one of the two funded assets
        assertTrue(asset == address(aapl) || asset == address(nvda), "unexpected asset");
    }

    function test_noDoubleClaim() public {
        uint256 id = _openEpoch(1 days);
        manager.recordTrade(alice, 1 ether);
        vm.warp(block.timestamp + 1 days + 1);
        rng.reveal(1, SECRET);
        vm.prank(alice);
        manager.claim(id);
        vm.prank(alice);
        vm.expectRevert(ExternalTradeRewardManager.AlreadyClaimed.selector);
        manager.claim(id);
    }

    function test_claimBeforeSeedRevertsButAfterSucceeds() public {
        uint256 id = _openEpoch(1 days);
        manager.recordTrade(alice, 1 ether);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(alice);
        vm.expectRevert(ExternalTradeRewardManager.SeedNotFinalized.selector);
        manager.claim(id);
        rng.reveal(1, SECRET);
        vm.prank(alice);
        manager.claim(id); // now works
    }

    function test_eligibilityRules() public {
        _openEpoch(1 days);
        // below min notional -> no credit
        assertEq(manager.recordTrade(alice, 0.001 ether), 0, "sub-min should not credit");
        // eligible
        assertEq(manager.recordTrade(alice, 1 ether), 1, "eligible should credit");
    }

    function test_perWalletEpochCap() public {
        uint256 id = _openEpoch(1 days);
        for (uint256 i; i < 10; i++) {
            manager.recordTrade(alice, 1 ether);
        }
        assertEq(manager.creditsOf(id, alice), 5, "cap of 5 not enforced");
    }

    function test_inventoryShortfall_preservesCredits() public {
        // lot huge so payout exceeds inventory
        vault.configureAsset(address(aapl), true, 10000, 100_000e18, 1e18, 0);
        vault.configureAsset(address(nvda), false, 0, 0, 0, 0); // only AAPL
        uint256 id = _openEpoch(1 days);
        manager.recordTrade(alice, 1 ether);
        vm.warp(block.timestamp + 1 days + 1);
        rng.reveal(1, SECRET);
        vm.prank(alice);
        vm.expectRevert(ExternalTradeRewardManager.Shortfall.selector);
        manager.claim(id);
        // credits preserved, not claimed
        assertEq(manager.creditsOf(id, alice), 1, "credits must be preserved");
        assertFalse(manager.claimedOf(id, alice), "must not be marked claimed");
    }

    function test_deterministicSelection_sameSeedSameAsset() public {
        uint256 id = _openEpoch(1 days);
        manager.recordTrade(alice, 1 ether);
        vm.warp(block.timestamp + 1 days + 1);
        rng.reveal(1, SECRET);
        (address a1,,) = manager.previewReward(id, alice);
        (address a2,,) = manager.previewReward(id, alice);
        assertEq(a1, a2, "selection must be deterministic");
    }

    function test_campaignPaused_noCredits() public {
        _openEpoch(1 days);
        manager.setCampaign(false, 0.01 ether, 5, 0);
        assertEq(manager.recordTrade(alice, 1 ether), 0, "paused campaign must not credit");
    }

    function test_onlyGatewayCanRecord() public {
        _openEpoch(1 days);
        vm.prank(bob);
        vm.expectRevert(ExternalTradeRewardManager.OnlyGateway.selector);
        manager.recordTrade(alice, 1 ether);
    }

    function test_badRevealRejected() public {
        rng.commit(1, keccak256(abi.encodePacked(SECRET)));
        vm.expectRevert(CommitRevealRandomnessProvider.BadReveal.selector);
        rng.reveal(1, keccak256("wrong"));
    }
}
