// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPlatformControls} from "../src/interfaces/IPlatformControls.sol";
import {MemeTokenV2} from "../src/v2/MemeTokenV2.sol";
import {BondingCurvePoolV2} from "../src/v2/BondingCurvePoolV2.sol";

contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// @dev Minimal treasury that pulls the exact fee total, tracking accrual.
contract MockTreasury {
    using SafeERC20 for IERC20;

    address public weth;
    uint256 public totalHolder;
    uint256 public totalCreator;
    uint256 public totalProtocol;

    constructor(address weth_) {
        weth = weth_;
    }

    function recordFees(address pool, uint256 h, uint256 c, uint256 p) external {
        IERC20(weth).safeTransferFrom(pool, address(this), h + c + p);
        totalHolder += h;
        totalCreator += c;
        totalProtocol += p;
    }
}

/// @notice Non-fork property tests for the V2 bonding curve + supply model.
contract PropertiesV2Test is Test, IPlatformControls {
    function tradingPaused() external pure returns (bool) {
        return false;
    }

    function claimsPaused() external pure returns (bool) {
        return false;
    }

    MockWETH weth;
    MockTreasury treasury;
    MemeTokenV2 meme;
    BondingCurvePoolV2 pool;

    uint256 constant TARGET = 5 ether;

    function setUp() public {
        weth = new MockWETH();
        treasury = new MockTreasury(address(weth));
        meme = new MemeTokenV2("Prop", "PROP", "ipfs://x");

        BondingCurvePoolV2.InitParams memory ip = BondingCurvePoolV2.InitParams({
            memeToken: address(meme),
            weth: address(weth),
            treasury: address(treasury),
            creator: address(0xC0FFEE),
            graduationManager: address(0xBEEF),
            graduationAdapter: address(0xCAFE),
            gradFee: 10000,
            gradTickSpacing: 200,
            feeConfig: BondingCurvePoolV2.FeeConfig({
                totalFeeBps: 100, holderShareBps: 4000, creatorShareBps: 3000, protocolShareBps: 3000
            }),
            virtualQuote: 2 ether,
            virtualToken: 73_000_000 ether,
            graduationTarget: TARGET
        });
        pool = new BondingCurvePoolV2(ip);
        meme.setPool(address(pool));
        meme.transfer(address(pool), meme.TOTAL_SUPPLY());
    }

    function _buy(address who, uint256 amt) internal returns (uint256 out) {
        weth.mint(who, amt);
        vm.prank(who);
        weth.approve(address(pool), amt);
        vm.prank(who);
        out = pool.buy(amt, 1);
    }

    /// A buy-then-sell round trip must never return more WETH than put in.
    function testFuzz_RoundTripNeverProfitable(uint96 amountRaw) public {
        uint256 amount = bound(uint256(amountRaw), 1e12, 3 ether); // stays below target
        address trader = makeAddr("trader");
        uint256 got = _buy(trader, amount);
        assertGt(got, 0);

        vm.prank(trader);
        meme.approve(address(pool), got);
        vm.prank(trader);
        uint256 wethOut = pool.sell(got, 1);

        assertLe(wethOut, amount, "round trip returned a profit");
    }

    /// The pool must always hold at least its `realQuote` principal in WETH.
    function testFuzz_PoolSolvent(uint96 a1, uint96 a2) public {
        _buy(makeAddr("t1"), bound(uint256(a1), 1e12, 2 ether));
        _buy(makeAddr("t2"), bound(uint256(a2), 1e12, 2 ether));
        assertGe(weth.balanceOf(address(pool)), pool.realQuote(), "pool insolvent vs principal");
    }

    /// Fees routed to the treasury exactly match the configured split.
    function testFuzz_FeeAccountingExact(uint96 amountRaw) public {
        uint256 amount = bound(uint256(amountRaw), 1e14, 2 ether);
        _buy(makeAddr("trader"), amount);
        uint256 expectedFee = (amount * 100) / 10000; // 1%
        uint256 routed = treasury.totalHolder() + treasury.totalCreator() + treasury.totalProtocol();
        assertApproxEqAbs(routed, expectedFee, 2, "fee routed != expected");
        // holder 40% / creator 30% / protocol 30%
        assertApproxEqAbs(treasury.totalHolder(), (expectedFee * 4000) / 10000, 2);
    }

    /// Total supply is fixed: trading never mints; it stays at TOTAL_SUPPLY.
    function test_SupplyFixedThroughTrading() public {
        assertEq(meme.totalSupply(), meme.TOTAL_SUPPLY());
        _buy(makeAddr("t1"), 1 ether);
        _buy(makeAddr("t2"), 1 ether);
        assertEq(meme.totalSupply(), meme.TOTAL_SUPPLY(), "supply changed during trading");
    }

    /// Once the target is reached, the curve halts (no trading after threshold).
    function test_NoTradeAfterThreshold() public {
        _buy(makeAddr("whale"), 10 ether); // well past 5 ETH target -> READY
        assertEq(uint8(pool.state()), uint8(BondingCurvePoolV2.PoolLifecycle.READY_TO_GRADUATE));

        weth.mint(makeAddr("late"), 1 ether);
        vm.prank(makeAddr("late"));
        weth.approve(address(pool), 1 ether);
        vm.prank(makeAddr("late"));
        vm.expectRevert(BondingCurvePoolV2.NotActive.selector);
        pool.buy(1 ether, 1);
    }

    /// The crossing buy caps principal at exactly the target and refunds excess.
    function test_CrossingBuyCapsAtTarget() public {
        address whale = makeAddr("whale");
        weth.mint(whale, 10 ether);
        vm.prank(whale);
        weth.approve(address(pool), 10 ether);
        vm.prank(whale);
        pool.buy(10 ether, 1);
        // principal at target (within fee rounding), excess refunded
        assertApproxEqAbs(pool.realQuote(), TARGET, 1e15);
        assertGt(weth.balanceOf(whale), 0, "no refund");
    }
}
