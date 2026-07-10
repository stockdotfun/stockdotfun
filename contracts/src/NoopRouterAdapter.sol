// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IRouterAdapter} from "./interfaces/IRouterAdapter.sol";

/// @title NoopRouterAdapter
/// @notice Explicit "routing disabled" adapter. Deploy this (or use
///         address(0)) when no verified DEX route exists on Robinhood Chain.
///         Every swap reverts, so pools fall back to accruing fees in the
///         quote asset (WETH) — funds are never sent into an unknown router.
contract NoopRouterAdapter is IRouterAdapter {
    error RoutingDisabled();

    function swapExactInput(address, address, uint256, uint256, address) external pure returns (uint256) {
        revert RoutingDisabled();
    }
}
