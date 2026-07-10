// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {StockAssetRegistry} from "../src/StockAssetRegistry.sol";
import {StockDotFunFactory} from "../src/StockDotFunFactory.sol";
import {BondingCurvePool} from "../src/BondingCurvePool.sol";
import {MemeToken} from "../src/MemeToken.sol";
import {RewardVault} from "../src/RewardVault.sol";
import {CreatorRewardVault} from "../src/CreatorRewardVault.sol";

/// Minimal canonical WETH (deposit/withdraw) for local end-to-end runs.
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) external {
        _burn(msg.sender, wad);
        payable(msg.sender).transfer(wad);
    }

    receive() external payable {
        deposit();
    }
}

contract MockStock is ERC20 {
    constructor() ERC20("Tesla Stock Token", "tTSLA") {}

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}

/// Deploys the full stack to a live node and exercises the whole flow:
/// create token -> wrap ETH -> buy -> sell -> claim holder + creator rewards.
contract LocalE2E is Script {
    error NeverOnMainnet();

    function run() external {
        // Hard guard: this script deploys MOCK assets and must never touch
        // Robinhood Chain mainnet or testnet.
        if (block.chainid == 4663 || block.chainid == 46630) revert NeverOnMainnet();
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address user = vm.addr(pk);

        vm.startBroadcast(pk);

        // --- deploy external assets + platform ---
        MockWETH weth = new MockWETH();
        MockStock tsla = new MockStock();
        StockAssetRegistry registry = new StockAssetRegistry(user);
        registry.addAsset(address(tsla), "TSLA", address(0), "");

        StockDotFunFactory factory = new StockDotFunFactory(
            address(registry),
            address(weth),
            user, // treasury
            address(0), // no router: holder fees accrue in WETH (fail-safe)
            BondingCurvePool.FeeConfig({
                totalFeeBps: 100, holderShareBps: 4000, creatorShareBps: 3000, protocolShareBps: 3000
            }),
            5e18,
            1_073_000_000e18,
            10e18
        );
        console.log("Registry   :", address(registry));
        console.log("Factory    :", address(factory));
        console.log("WETH       :", address(weth));

        // --- create a meme token paired with TSLA, creator reward pref = ETH (0) ---
        (address token, address poolAddr) = factory.createToken("Rocket", "ROCKET", "ipfs://meta", address(tsla), 0);
        BondingCurvePool pool = BondingCurvePool(poolAddr);
        console.log("Token      :", token);
        console.log("Pool       :", poolAddr);

        // --- wrap ETH -> WETH, then buy ---
        weth.deposit{value: 3 ether}();
        weth.approve(poolAddr, type(uint256).max);
        uint256 bought = pool.buy(1 ether, 1);
        console.log("Bought ROCKET (1 ETH):", bought);

        // --- sell half back ---
        MemeToken(token).approve(poolAddr, type(uint256).max);
        uint256 quoteOut = pool.sell(bought / 2, 1);
        console.log("Sold half -> WETH out:", quoteOut);

        // --- holder rewards accrued from the trading fees ---
        RewardVault vault = RewardVault(factory.vaultOf(token));
        uint256 holderClaimable = vault.claimable(user, address(weth));
        console.log("Holder claimable WETH:", holderClaimable);
        if (holderClaimable > 0) vault.claim(address(weth));

        // --- creator rewards ---
        CreatorRewardVault cvault = factory.creatorVault();
        uint256 creatorClaimable = cvault.claimable(user, address(weth));
        console.log("Creator claimable WETH:", creatorClaimable);
        if (creatorClaimable > 0) cvault.claim(address(weth));

        // --- unwrap all WETH back to native ETH (the frontend's sell/claim tail) ---
        uint256 wbal = weth.balanceOf(user);
        if (wbal > 0) weth.withdraw(wbal);
        console.log("Final WETH balance   :", weth.balanceOf(user));

        vm.stopBroadcast();
    }
}
