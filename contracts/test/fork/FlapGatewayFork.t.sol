// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FlapV2DexAdapter} from "../../src/integrations/flap/FlapV2DexAdapter.sol";
import {FlapDexAdapterRegistry} from "../../src/integrations/flap/FlapDexAdapterRegistry.sol";
import {StockDotFunExternalTradeGateway} from "../../src/integrations/StockDotFunExternalTradeGateway.sol";

/// @notice Proves trading a REAL graduated Flap token (WOBL) through the
///         StockDotFun gateway on a Robinhood Chain mainnet fork: buy, sell,
///         on-chain attribution, delta verification, reward fee, and the safety
///         rejections. WOBL migrated to a Uniswap V2-fork pool (verified in
///         docs/integrations/flap-robinhood-verification.md).
contract FlapGatewayForkTest is Test {
    address constant V2_ROUTER = 0x89e5DB8B5aA49aA85AC63f691524311AEB649eba;
    address constant WOBL = 0x76F80333B1d0abF3ff1636cdFb4efcE0FE747777;
    address constant WOBL_POOL = 0x4AB8Abf127043779968e3Ef3B8c9A393DA4b1733;

    FlapDexAdapterRegistry registry;
    FlapV2DexAdapter adapter;
    StockDotFunExternalTradeGateway gateway;

    address admin = address(this);
    address feeRecipient = makeAddr("feeRecipient");
    address alice;

    // Mirror of the gateway's event for expectEmit.
    event ExternalTradeExecuted(
        address indexed trader,
        address indexed token,
        address indexed pool,
        address inputToken,
        address outputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 rewardFeePaid,
        uint256 rewardCredits,
        bytes32 source
    );

    function setUp() public {
        vm.createSelectFork(vm.envOr("RHC_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")));
        registry = new FlapDexAdapterRegistry(admin);
        adapter = new FlapV2DexAdapter(V2_ROUTER);
        registry.approveAdapter(address(adapter));
        registry.listToken(WOBL, WOBL_POOL, adapter.DEX_ID(), 0, 0);
        gateway = new StockDotFunExternalTradeGateway(address(registry), feeRecipient, admin);

        alice = makeAddr("alice");
        vm.deal(alice, 10 ether);
    }

    function test_buyWOBL_throughGateway() public {
        vm.prank(alice);
        uint256 out = gateway.buy{value: 0.1 ether}(WOBL, 1, block.timestamp + 600);
        assertGt(out, 0, "no WOBL received");
        assertEq(IERC20(WOBL).balanceOf(alice), out, "WOBL not delivered to trader");
        assertEq(alice.balance, 10 ether - 0.1 ether, "spent exactly 0.1 ETH (no fee while campaign inactive)");
        assertEq(feeRecipient.balance, 0, "no fee should be charged while inactive");
        _assertGatewayEmpty();
    }

    function test_sellWOBL_throughGateway() public {
        vm.startPrank(alice);
        uint256 bought = gateway.buy{value: 0.1 ether}(WOBL, 1, block.timestamp + 600);
        uint256 ethBefore = alice.balance;
        IERC20(WOBL).approve(address(gateway), bought);
        uint256 ethOut = gateway.sell(WOBL, bought, 1, block.timestamp + 600);
        vm.stopPrank();

        assertGt(ethOut, 0, "no ETH from sell");
        assertEq(alice.balance, ethBefore + ethOut, "ETH not returned to trader");
        assertEq(IERC20(WOBL).balanceOf(alice), 0, "WOBL not fully sold");
        _assertGatewayEmpty();
    }

    function test_emitsFlapAttribution() public {
        vm.recordLogs();
        vm.prank(alice);
        gateway.buy{value: 0.05 ether}(WOBL, 1, block.timestamp + 600);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sig = keccak256(
            "ExternalTradeExecuted(address,address,address,address,address,uint256,uint256,uint256,uint256,bytes32)"
        );
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == sig) {
                found = true;
                assertEq(address(uint160(uint256(logs[i].topics[1]))), alice, "trader mismatch");
                assertEq(address(uint160(uint256(logs[i].topics[2]))), WOBL, "token mismatch");
                (,,,,,, bytes32 source) =
                    abi.decode(logs[i].data, (address, address, uint256, uint256, uint256, uint256, bytes32));
                assertEq(source, keccak256("FLAP"), "source not FLAP");
            }
        }
        assertTrue(found, "ExternalTradeExecuted not emitted");
    }

    function test_rewardFeeChargedWhenActive() public {
        gateway.setRewardConfig(address(0), true, 100); // 1% reward fee, no manager
        vm.prank(alice);
        gateway.buy{value: 1 ether}(WOBL, 1, block.timestamp + 600);
        assertEq(feeRecipient.balance, 0.01 ether, "1% reward fee not routed to recipient");
        _assertGatewayEmpty();
    }

    function test_rejectsUnlistedToken() public {
        address random = makeAddr("randomToken");
        vm.prank(alice);
        vm.expectRevert(bytes("token not tradable"));
        gateway.buy{value: 0.1 ether}(random, 1, block.timestamp + 600);
    }

    function test_rejectsExpired() public {
        vm.prank(alice);
        vm.expectRevert(StockDotFunExternalTradeGateway.Expired.selector);
        gateway.buy{value: 0.1 ether}(WOBL, 1, block.timestamp - 1);
    }

    function test_enforcesMinOut() public {
        vm.prank(alice);
        vm.expectRevert(); // adapter's router reverts on INSUFFICIENT_OUTPUT
        gateway.buy{value: 0.1 ether}(WOBL, type(uint256).max, block.timestamp + 600);
    }

    function test_pausedBlocksTrading() public {
        gateway.pause();
        vm.prank(alice);
        vm.expectRevert();
        gateway.buy{value: 0.1 ether}(WOBL, 1, block.timestamp + 600);
    }

    function test_blockedTokenRejected() public {
        registry.setBlocked(WOBL, true);
        vm.prank(alice);
        vm.expectRevert(bytes("blocked"));
        gateway.buy{value: 0.1 ether}(WOBL, 1, block.timestamp + 600);
    }

    function _assertGatewayEmpty() internal view {
        assertEq(address(gateway).balance, 0, "ETH stuck in gateway");
        assertEq(IERC20(WOBL).balanceOf(address(gateway)), 0, "WOBL stuck in gateway");
        assertEq(IERC20(WOBL).balanceOf(address(adapter)), 0, "WOBL stuck in adapter");
        assertEq(address(adapter).balance, 0, "ETH stuck in adapter");
    }
}
