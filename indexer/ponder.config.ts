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

// Robinhood Chain produces ~10 blocks/sec. Ponder's realtime sync fetches
// blocks ~one round-trip each, so on the public RPC it tops out ~5-6 blocks/sec
// and slowly drifts behind the head (batched historical backfill is fast — a
// fresh deploy re-syncs to the head in minutes, then drifts again). The real
// fix is a low-latency dedicated RPC: set PONDER_RPC_URL_4663 to one URL (fanned
// out below) or a comma-separated list of distinct endpoints. Parallel
// connections to the SAME public endpoint don't lift the per-block latency
// ceiling, so this stays a stopgap until a dedicated RPC is configured.
const RAW_RPC =
  process.env.PONDER_RPC_URL_4663 ?? "https://rpc.mainnet.chain.robinhood.com";
const RPC_LIST = RAW_RPC.includes(",")
  ? RAW_RPC.split(",").map((s) => s.trim()).filter(Boolean)
  : Array.from({ length: 6 }, () => RAW_RPC);

export default createConfig({
  chains: {
    robinhood: {
      id: 4663,
      rpc: RPC_LIST,
      maxRequestsPerSecond: 60,
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
