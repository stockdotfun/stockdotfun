// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IRouterAdapter
/// @notice Configurable interface for converting fee assets (e.g. WETH) into
///         supported stock-token assets. Implementations wrap whatever DEX or
///         routing infrastructure exists on Robinhood Chain — no specific DEX
///         is assumed. Callers MUST treat failures as non-fatal and fall back
///         to accruing the input asset.
interface IRouterAdapter {
    /// @notice Swap `amountIn` of `tokenIn` into `tokenOut`, sending output to `recipient`.
    /// @dev MUST revert if the route is unavailable; callers wrap in try/catch.
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}
