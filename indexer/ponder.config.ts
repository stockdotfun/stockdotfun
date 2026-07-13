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

// RPC strategy for Robinhood Chain (~10 blocks/sec):
// - A dedicated low-latency RPC (PONDER_RPC_URL_4663, e.g. Alchemy) is used
//   DIRECTLY as a single connection (or a comma-separated list as-is). It's
//   fast on its own, and fanning one endpoint out to many connections just
//   overruns provider rate limits and can hang the sync.
// - Only the slow public fallback is fanned out into parallel connections to
//   squeeze a bit more throughput.
// maxRequestsPerSecond is kept conservative for the dedicated RPC so we stay
// within a typical free-tier compute-unit budget.
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";
// The dedicated RPC is OPT-IN via PONDER_USE_DEDICATED=true. Alchemy's Robinhood
// Chain endpoint hangs Ponder's sync after the initial backfill (it stops
// fetching new data), so we default to the public RPC, which is slower but
// reliable and never hangs. Set the flag only with a provider proven to sync
// cleanly (e.g. QuickNode).
const DEDICATED =
  process.env.PONDER_USE_DEDICATED === "true" ? process.env.PONDER_RPC_URL_4663 : undefined;
const RPC_LIST = DEDICATED
  ? DEDICATED.split(",").map((s) => s.trim()).filter(Boolean)
  : Array.from({ length: 6 }, () => PUBLIC_RPC);

export default createConfig({
  chains: {
    robinhood: {
      id: 4663,
      rpc: RPC_LIST.length === 1 ? RPC_LIST[0] : RPC_LIST,
      maxRequestsPerSecond: DEDICATED ? 25 : 60,
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
