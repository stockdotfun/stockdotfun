// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

interface ICurvePoolLite {
    function buy(uint256 quoteIn, uint256 minTokensOut) external returns (uint256 tokensOut);
    function sell(uint256 tokensIn, uint256 minQuoteOut) external returns (uint256 quoteOut);
    function memeToken() external view returns (IERC20);
}

interface IFactoryLite {
    function poolOf(address token) external view returns (address);
}

/// @notice One-transaction UX for StockDotFun bonding-curve pools. The pools
///         are immutable and trade in WETH, which forces a 3-step wallet flow
///         (wrap -> approve -> buy). This zap collapses it: `buyWithETH` wraps,
///         approves, and buys atomically and forwards the tokens (plus any
///         crossing-buy WETH refund, unwrapped to ETH) to the caller;
///         `sellForETH` sells and returns native ETH.
///
///         Safety: only pools registered in the immutable StockDotFunFactoryV2
///         are callable (poolOf(pool.memeToken()) must equal the pool), so the
///         zap can never be pointed at a hostile contract. The zap is
///         stateless — it holds no balances between transactions and has no
///         owner or admin functions.
contract CurveZap is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IWETH public immutable weth;
    IFactoryLite public immutable factory;

    error NotAFactoryPool();
    error ZeroAmount();
    error EthTransferFailed();
    error OnlyWeth();

    constructor(IWETH weth_, IFactoryLite factory_) {
        weth = weth_;
        factory = factory_;
    }

    /// @notice Buy from a curve pool with native ETH in a single transaction.
    /// @dev Wraps msg.value, approves the pool, buys; tokens and any
    ///      crossing-buy refund (unwrapped to ETH) are forwarded to the caller.
    function buyWithETH(address pool, uint256 minTokensOut)
        external
        payable
        nonReentrant
        returns (uint256 tokensOut)
    {
        if (msg.value == 0) revert ZeroAmount();
        IERC20 meme = _validatePool(pool);

        weth.deposit{value: msg.value}();
        IERC20(address(weth)).forceApprove(pool, msg.value);
        tokensOut = ICurvePoolLite(pool).buy(msg.value, minTokensOut);

        meme.safeTransfer(msg.sender, tokensOut);

        // Crossing buys refund the excess WETH to the buyer (this zap) —
        // unwrap and return it as ETH.
        uint256 wethLeft = IERC20(address(weth)).balanceOf(address(this));
        if (wethLeft > 0) {
            weth.withdraw(wethLeft);
            (bool ok,) = msg.sender.call{value: wethLeft}("");
            if (!ok) revert EthTransferFailed();
        }
    }

    /// @notice Sell curve tokens and receive native ETH in a single
    ///         transaction. Requires a one-time token approval to this zap.
    function sellForETH(address pool, uint256 tokensIn, uint256 minQuoteOut)
        external
        nonReentrant
        returns (uint256 quoteOut)
    {
        if (tokensIn == 0) revert ZeroAmount();
        IERC20 meme = _validatePool(pool);

        meme.safeTransferFrom(msg.sender, address(this), tokensIn);
        meme.forceApprove(pool, tokensIn);
        quoteOut = ICurvePoolLite(pool).sell(tokensIn, minQuoteOut);

        weth.withdraw(quoteOut);
        (bool ok,) = msg.sender.call{value: quoteOut}("");
        if (!ok) revert EthTransferFailed();
    }

    function _validatePool(address pool) internal view returns (IERC20 meme) {
        meme = ICurvePoolLite(pool).memeToken();
        if (factory.poolOf(address(meme)) != pool) revert NotAFactoryPool();
    }

    receive() external payable {
        if (msg.sender != address(weth)) revert OnlyWeth();
    }
}
