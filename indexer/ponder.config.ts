import { createConfig, factory } from "ponder";
import { getAbiItem } from "viem";
import {
  FactoryAbi,
  PoolAbi,
  TreasuryAbi,
  HolderVaultAbi,
  CreatorVaultAbi,
  MemeTokenAbi,
} from "./abis";

const FACTORY = process.env.FACTORY_ADDRESS as `0x${string}`;
const TREASURY = process.env.TREASURY_ADDRESS as `0x${string}`;
const CREATOR_VAULT = process.env.CREATOR_VAULT_ADDRESS as `0x${string}`;
const START = Number(process.env.FACTORY_START_BLOCK ?? 0);

const tokenCreated = getAbiItem({ abi: FactoryAbi, name: "TokenCreated" });

export default createConfig({
  chains: {
    robinhood: {
      id: 4663,
      rpc: process.env.PONDER_RPC_URL_4663 ?? "https://rpc.mainnet.chain.robinhood.com",
    },
  },
  contracts: {
    Factory: { chain: "robinhood", abi: FactoryAbi, address: FACTORY, startBlock: START },
    Treasury: { chain: "robinhood", abi: TreasuryAbi, address: TREASURY, startBlock: START },
    CreatorVault: { chain: "robinhood", abi: CreatorVaultAbi, address: CREATOR_VAULT, startBlock: START },

    // Dynamically-created per-launch contracts, discovered from TokenCreated.
    Pool: {
      chain: "robinhood",
      abi: PoolAbi,
      address: factory({ address: FACTORY, event: tokenCreated, parameter: "pool" }),
      startBlock: START,
    },
    MemeToken: {
      chain: "robinhood",
      abi: MemeTokenAbi,
      address: factory({ address: FACTORY, event: tokenCreated, parameter: "token" }),
      startBlock: START,
    },
    HolderVault: {
      chain: "robinhood",
      abi: HolderVaultAbi,
      address: factory({ address: FACTORY, event: tokenCreated, parameter: "holderVault" }),
      startBlock: START,
    },
  },
});
