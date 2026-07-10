// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BondingCurvePool} from "../../src/BondingCurvePool.sol";

/// @title RobinhoodConfig
/// @notice Single source of truth for verified Robinhood Chain network values
///         and the recommended launch parameters (from docs/economics/).
///         Verified 2026-07-10 — see docs/mainnet-verification/.
library RobinhoodConfig {
    uint256 internal constant MAINNET_CHAIN_ID = 4663;
    uint256 internal constant TESTNET_CHAIN_ID = 46630;

    /// Verified base assets (official Robinhood Chain contracts).
    address internal constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    // ---- Recommended curve params (docs/economics/default-parameters.md) ----
    uint256 internal constant VIRTUAL_QUOTE = 3e18;
    uint256 internal constant VIRTUAL_TOKEN = 73_000_000e18;
    uint256 internal constant GRADUATION_TARGET = 4.4e18;

    function defaultFeeConfig() internal pure returns (BondingCurvePool.FeeConfig memory) {
        return BondingCurvePool.FeeConfig({
            totalFeeBps: 100, // 1%
            holderShareBps: 4000, // 40%
            creatorShareBps: 3000, // 30%
            protocolShareBps: 3000 // 30%
        });
    }

    /// The 20 verified stock tokens + 5 ETFs. Only STANDARD-liquidity assets are
    /// seeded enabled at deploy; low-liquidity/private assets are added but
    /// disabled (mirrors lib/assets/robinhoodAssets.ts). Returned as parallel
    /// arrays to keep the deploy script simple.
    function seedAssets()
        internal
        pure
        returns (address[] memory tokens, string[] memory symbols, bool[] memory enabled)
    {
        tokens = new address[](25);
        symbols = new string[](25);
        enabled = new bool[](25);

        // stocks
        (tokens[0], symbols[0], enabled[0]) = (0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9, "AAPL", true);
        (tokens[1], symbols[1], enabled[1]) = (0x86923f96303D656E4aa86D9d42D1e57ad2023fdC, "AMD", true);
        (tokens[2], symbols[2], enabled[2]) = (0x12f190a9F9d7D37a250758b26824B97CE941bF54, "AMZN", true);
        (tokens[3], symbols[3], enabled[3]) = (0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4, "BABA", false);
        (tokens[4], symbols[4], enabled[4]) = (0x822CC93fFD030293E9842c30BBD678F530701867, "BE", true);
        (tokens[5], symbols[5], enabled[5]) = (0x6330D8C3178a418788dF01a47479c0ce7CCF450b, "COIN", true);
        (tokens[6], symbols[6], enabled[6]) = (0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5, "CRCL", false);
        (tokens[7], symbols[7], enabled[7]) = (0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3, "CRWV", true);
        (tokens[8], symbols[8], enabled[8]) = (0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3, "GOOGL", true);
        (tokens[9], symbols[9], enabled[9]) = (0xc72b96e0E48ecd4DC75E1e45396e26300BC39681, "INTC", true);
        (tokens[10], symbols[10], enabled[10]) = (0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35, "META", true);
        (tokens[11], symbols[11], enabled[11]) = (0xe93237C50D904957Cf27E7B1133b510C669c2e74, "MSFT", true);
        (tokens[12], symbols[12], enabled[12]) = (0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD, "MU", true);
        (tokens[13], symbols[13], enabled[13]) = (0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC, "NVDA", true);
        (tokens[14], symbols[14], enabled[14]) = (0xb0992820E760d836549ba69BC7598b4af75dEE03, "ORCL", true);
        (tokens[15], symbols[15], enabled[15]) = (0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A, "PLTR", true);
        (tokens[16], symbols[16], enabled[16]) = (0xB90A19fF0Af67f7779afF50A882A9CfF42446400, "SNDK", true);
        (tokens[17], symbols[17], enabled[17]) = (0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa, "SPCX", true);
        (tokens[18], symbols[18], enabled[18]) = (0x322F0929c4625eD5bAd873c95208D54E1c003b2d, "TSLA", true);
        (tokens[19], symbols[19], enabled[19]) = (0xd917B029C761D264c6A312BBbcDA868658eF86a6, "USAR", true);
        // etfs
        (tokens[20], symbols[20], enabled[20]) = (0xD5f3879160bc7c32ebb4dC785F8a4F505888de68, "QQQ", false);
        (tokens[21], symbols[21], enabled[21]) = (0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5, "SGOV", false);
        (tokens[22], symbols[22], enabled[22]) = (0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f, "SLV", false);
        (tokens[23], symbols[23], enabled[23]) = (0x117cc2133c37B721F49dE2A7a74833232B3B4C0C, "SPY", true);
        (tokens[24], symbols[24], enabled[24]) = (0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344, "USO", false);
    }
}
