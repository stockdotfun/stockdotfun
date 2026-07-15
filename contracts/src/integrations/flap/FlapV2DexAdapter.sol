// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IFlapDexAdapter} from "./IFlapDexAdapter.sol";

interface IUniV2Router {
    function WETH() external view returns (address);
    function factory() external view returns (address);
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

/// @title FlapV2DexAdapter
/// @notice DEX adapter for Flap graduates that migrated to a Uniswap V2-fork
///         (the case on Robinhood Chain). Stateless; routes only through the one
///         immutable, allowlisted router. Uses fee-on-transfer-safe swaps so tax
///         tokens settle correctly, and measures its own balance deltas.
contract FlapV2DexAdapter is IFlapDexAdapter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DEX_ID = keccak256("UNI_V2");

    IUniV2Router public immutable v2Router;
    address public immutable weth;

    error ZeroAmount();
    error EthTransferFailed();
    error OnlyWeth();

    constructor(address router_) {
        v2Router = IUniV2Router(router_);
        weth = IUniV2Router(router_).WETH();
    }

    function dexId() external pure returns (bytes32) {
        return DEX_ID;
    }

    function router() external view returns (address) {
        return address(v2Router);
    }

    function quote(address token, uint256 amountIn, bool isBuy) external view returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        address[] memory path = new address[](2);
        if (isBuy) {
            path[0] = weth;
            path[1] = token;
        } else {
            path[0] = token;
            path[1] = weth;
        }
        try v2Router.getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    function buyWithETH(address token, uint256 minOut, address recipient, uint256 deadline)
        external
        payable
        nonReentrant
        returns (uint256)
    {
        if (msg.value == 0) revert ZeroAmount();
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = token;
        uint256 before = IERC20(token).balanceOf(recipient);
        v2Router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: msg.value}(minOut, path, recipient, deadline);
        return IERC20(token).balanceOf(recipient) - before;
    }

    function sellForETH(address token, uint256 minOut, address recipient, uint256 deadline)
        external
        nonReentrant
        returns (uint256)
    {
        uint256 amountIn = IERC20(token).balanceOf(address(this));
        if (amountIn == 0) revert ZeroAmount();
        IERC20(token).forceApprove(address(v2Router), amountIn);
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = weth;
        uint256 before = recipient.balance;
        v2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(amountIn, minOut, path, recipient, deadline);
        // Clear any residual approval (defensive; fee-on-transfer may leave dust).
        IERC20(token).forceApprove(address(v2Router), 0);
        return recipient.balance - before;
    }

    /// @dev Only the router refunds native ETH here (V2 swaps send ETH straight
    ///      to `recipient`; this is a safety net).
    receive() external payable {}
}
