// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IFlapDexAdapter
/// @notice Uniform interface for swapping ETH<->a graduated Flap token on the
///         token's migrated DEX pool. Adapters are STATELESS pure swap
///         executors, approved in the FlapDexAdapterRegistry and driven only by
///         the StockDotFunExternalTradeGateway. Callers verify balance deltas
///         themselves — adapter return values are advisory, never trusted for
///         accounting or slippage on the gateway side.
interface IFlapDexAdapter {
    /// @notice Identifier of the DEX family this adapter serves (e.g. keccak("UNI_V2")).
    function dexId() external view returns (bytes32);

    /// @notice Router this adapter routes through (allowlisted, immutable).
    function router() external view returns (address);

    /// @notice View quote. isBuy: amountIn is ETH -> token out; else token in -> ETH out.
    function quote(address token, uint256 amountIn, bool isBuy) external view returns (uint256 amountOut);

    /// @notice Buy `token` with exactly msg.value ETH; output sent to `recipient`.
    ///         Uses fee-on-transfer-safe swaps so tax tokens settle correctly.
    /// @return amountOut router-reported output (advisory; caller re-measures).
    function buyWithETH(address token, uint256 minOut, address recipient, uint256 deadline)
        external
        payable
        returns (uint256 amountOut);

    /// @notice Sell `token` for ETH; the tokens to sell must ALREADY be held by
    ///         this adapter (the gateway transfers them here in one hop to avoid
    ///         double-taxing). Swaps the adapter's full balance of `token`; ETH
    ///         is sent to `recipient`.
    /// @return amountOut router-reported ETH output (advisory; caller re-measures).
    function sellForETH(address token, uint256 minOut, address recipient, uint256 deadline)
        external
        returns (uint256 amountOut);
}
