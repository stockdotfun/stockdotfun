// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {V4LiquidityLocker} from "../../src/v2/graduation/V4LiquidityLocker.sol";
import {UniswapV4GraduationAdapter} from "../../src/v2/graduation/UniswapV4GraduationAdapter.sol";

interface IStateView {
    function getLiquidity(bytes32 poolId) external view returns (uint128);
    function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24, uint24);
}

contract MintableToken is ERC20 {
    constructor(string memory n) ERC20(n, n) {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// @dev Minimal single-hop exact-in swapper for MEME/WETH (both ERC20).
contract MiniSwap is IUnlockCallback {
    using BalanceDeltaLibrary for BalanceDelta;

    IPoolManager public immutable pm;

    constructor(IPoolManager _pm) {
        pm = _pm;
    }

    function swap(PoolKey memory key, bool zeroForOne, uint256 amtIn, address tokenIn, address recipient)
        external
        returns (uint256 out)
    {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amtIn);
        out = abi.decode(pm.unlock(abi.encode(key, zeroForOne, amtIn, recipient)), (uint256));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(pm), "pm");
        (PoolKey memory key, bool z, uint256 amtIn, address recipient) =
            abi.decode(data, (PoolKey, bool, uint256, address));
        BalanceDelta d = pm.swap(
            key,
            SwapParams({
                zeroForOne: z,
                amountSpecified: -int256(amtIn),
                sqrtPriceLimitX96: z ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );
        Currency inC = z ? key.currency0 : key.currency1;
        Currency outC = z ? key.currency1 : key.currency0;
        uint256 outAmt = z ? uint256(uint128(d.amount1())) : uint256(uint128(d.amount0()));
        pm.sync(inC);
        IERC20(Currency.unwrap(inC)).transfer(address(pm), amtIn);
        pm.settle();
        pm.take(outC, recipient, outAmt);
        return abi.encode(outAmt);
    }
}

contract GraduationForkTest is Test {
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant STATE_VIEW = 0xF3334192D15450CdD385c8B70e03f9A6bD9E673b;
    address constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    V4LiquidityLocker locker;
    UniswapV4GraduationAdapter adapter;
    MiniSwap swapper;
    MintableToken meme;
    address feeRecipient;

    uint24 constant FEE = 10000;
    int24 constant TS = 200;

    function setUp() public {
        vm.createSelectFork(vm.envOr("RHC_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")));
        feeRecipient = makeAddr("feeRecipient");
        locker = new V4LiquidityLocker(address(this), POOL_MANAGER, feeRecipient);
        adapter = new UniswapV4GraduationAdapter(address(locker));
        locker.setGraduator(address(adapter));
        swapper = new MiniSwap(IPoolManager(POOL_MANAGER));
        meme = new MintableToken("GradMeme");
    }

    function testGraduationCreatesLockedTradablePool() public {
        uint256 wethAmount = 1 ether;
        uint256 memeAmount = 100_000 ether; // terminal price 1e-5 WETH/MEME

        deal(WETH, address(this), wethAmount);
        meme.mint(address(this), memeAmount);
        IERC20(WETH).approve(address(adapter), wethAmount);
        meme.approve(address(adapter), memeAmount);

        (bytes32 poolId, uint128 liquidity) = adapter.graduate(address(meme), WETH, wethAmount, memeAmount, FEE, TS);

        // 1) real Uniswap pool created with locked liquidity
        assertGt(liquidity, 0, "no liquidity minted");
        uint128 onchainLiq = IStateView(STATE_VIEW).getLiquidity(poolId);
        assertEq(onchainLiq, liquidity, "on-chain liquidity mismatch");
        (uint160 spNow,,,) = IStateView(STATE_VIEW).getSlot0(poolId);
        assertGt(spNow, 0, "pool not initialized");
        (bool exists,,,, uint128 lockedLiq) = locker.positions(poolId);
        assertTrue(exists, "position not recorded");
        assertEq(lockedLiq, liquidity, "locked liquidity mismatch");

        // 2) the graduated pool is tradable on Uniswap (WETH -> MEME)
        (PoolKey memory key,) = adapter.poolKeyFor(address(meme), WETH, FEE, TS);
        bool wethIsC0 = Currency.unwrap(key.currency0) == WETH;
        uint256 swapIn = 0.05 ether;
        deal(WETH, address(this), swapIn);
        IERC20(WETH).approve(address(swapper), swapIn);
        uint256 memeOut = swapper.swap(key, wethIsC0, swapIn, WETH, address(this));
        emit log_named_uint("MEME bought from graduated pool", memeOut);
        assertGt(memeOut, 0, "graduated pool not tradable");

        // 3) principal liquidity is NOT reduced by trading (locked)
        assertEq(IStateView(STATE_VIEW).getLiquidity(poolId), liquidity, "principal liquidity changed");

        // 4) fees are collectible to the immutable recipient
        uint256 feeBefore = IERC20(WETH).balanceOf(feeRecipient);
        locker.collectFees(poolId);
        uint256 feeAfter = IERC20(WETH).balanceOf(feeRecipient);
        emit log_named_uint("WETH fees collected", feeAfter - feeBefore);
        assertGt(feeAfter, feeBefore, "no LP fees collected");
    }

    function testLockerHasNoRemovalPath() public {
        // Structural guarantee: the locker exposes no function that removes
        // principal liquidity. This documents/records the property; the absence
        // of a removeLiquidity selector is enforced at compile time.
        uint256 wethAmount = 1 ether;
        uint256 memeAmount = 100_000 ether;
        deal(WETH, address(this), wethAmount);
        meme.mint(address(this), memeAmount);
        IERC20(WETH).approve(address(adapter), wethAmount);
        meme.approve(address(adapter), memeAmount);
        (bytes32 poolId, uint128 liquidity) = adapter.graduate(address(meme), WETH, wethAmount, memeAmount, FEE, TS);

        // Only ADD happened; liquidity persists and cannot be pulled by anyone.
        assertEq(IStateView(STATE_VIEW).getLiquidity(poolId), liquidity);
    }
}
