// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CurveZap, IWETH, IFactoryLite, ICurvePoolLite} from "../../src/v2/CurveZap.sol";

interface IPoolQuote {
    function quoteBuy(uint256 quoteIn) external view returns (uint256 tokensOut, uint256 fee);
    function quoteSell(uint256 tokensIn) external view returns (uint256 quoteOut, uint256 fee);
}

/// @notice Proves CurveZap gives 1-transaction ETH buys and sells against the
///         LIVE StockDotFun V2 deployment on a Robinhood Chain mainnet fork,
///         using the real $TEST pool.
contract CurveZapForkTest is Test {
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address constant LIVE_FACTORY = 0x470acA74d71269833de8cF65640DFB558393569E;
    address constant TEST_TOKEN = 0xc8a5345bFD37f5EdD92684CCFEbF8a9f35249957;
    address constant TEST_POOL = 0x63760D1926205706C614500617380d51ef6B7F25;

    CurveZap zap;
    address alice;

    function setUp() public {
        vm.createSelectFork(vm.envOr("RHC_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")));
        zap = new CurveZap(IWETH(WETH), IFactoryLite(LIVE_FACTORY));
        alice = makeAddr("alice");
        vm.deal(alice, 1 ether);
    }

    function test_buyWithETH_singleTransaction() public {
        (uint256 expectedOut,) = IPoolQuote(TEST_POOL).quoteBuy(0.01 ether);

        vm.prank(alice);
        uint256 tokensOut = zap.buyWithETH{value: 0.01 ether}(TEST_POOL, (expectedOut * 99) / 100);

        assertEq(IERC20(TEST_TOKEN).balanceOf(alice), tokensOut, "tokens forwarded to buyer");
        assertGt(tokensOut, 0, "bought tokens");
        assertEq(alice.balance, 1 ether - 0.01 ether, "spent exactly the ETH sent");
        // Zap holds nothing.
        assertEq(IERC20(WETH).balanceOf(address(zap)), 0, "no WETH stuck in zap");
        assertEq(IERC20(TEST_TOKEN).balanceOf(address(zap)), 0, "no tokens stuck in zap");
        assertEq(address(zap).balance, 0, "no ETH stuck in zap");
    }

    function test_sellForETH_singleTransactionAfterApproval() public {
        vm.startPrank(alice);
        uint256 tokensOut = zap.buyWithETH{value: 0.01 ether}(TEST_POOL, 1);

        IERC20(TEST_TOKEN).approve(address(zap), type(uint256).max); // one-time
        (uint256 expectedQuote,) = IPoolQuote(TEST_POOL).quoteSell(tokensOut);
        uint256 balBefore = alice.balance;
        uint256 quoteOut = zap.sellForETH(TEST_POOL, tokensOut, (expectedQuote * 99) / 100);
        vm.stopPrank();

        assertEq(alice.balance, balBefore + quoteOut, "received native ETH");
        assertEq(IERC20(TEST_TOKEN).balanceOf(alice), 0, "tokens sold");
        assertEq(IERC20(WETH).balanceOf(address(zap)), 0, "no WETH stuck in zap");
        assertEq(address(zap).balance, 0, "no ETH stuck in zap");
    }

    function test_rejectsPoolNotFromFactory() public {
        FakePool fake = new FakePool(TEST_TOKEN);
        vm.prank(alice);
        vm.expectRevert(CurveZap.NotAFactoryPool.selector);
        zap.buyWithETH{value: 0.01 ether}(address(fake), 1);
    }

    function test_slippageBoundEnforced() public {
        (uint256 expectedOut,) = IPoolQuote(TEST_POOL).quoteBuy(0.01 ether);
        vm.prank(alice);
        vm.expectRevert(); // pool reverts SlippageExceeded
        zap.buyWithETH{value: 0.01 ether}(TEST_POOL, expectedOut * 2);
    }
}

contract FakePool {
    IERC20 public immutable memeToken;

    constructor(address meme) {
        memeToken = IERC20(meme);
    }

    function buy(uint256, uint256) external pure returns (uint256) {
        return 0;
    }
}
