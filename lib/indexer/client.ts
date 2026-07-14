import { platformConfig, areContractsConfigured } from "@/lib/config";
import { DEMO_TOKENS, DEMO_TRADES } from "@/lib/data/tokens";
import type { LaunchedToken } from "@/types/token";
import type { ExploreQuery, IndexerClient } from "@/lib/indexer/types";
import { externalClient, indexerApiConfigured } from "@/lib/indexer/apiClient";
import { isHiddenToken } from "@/lib/indexer/hidden";

function applyQuery(tokens: LaunchedToken[], q: ExploreQuery): LaunchedToken[] {
  let out = [...tokens];
  if (q.search) {
    const s = q.search.toLowerCase();
    out = out.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        t.symbol.toLowerCase().includes(s) ||
        t.stockSymbol.toLowerCase().includes(s),
    );
  }
  if (q.stockSymbol) out = out.filter((t) => t.stockSymbol === q.stockSymbol);
  if (q.filter === "new") {
    out.sort((a, b) => b.createdAt - a.createdAt);
  } else if (q.filter === "trending") {
    out.sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
  } else if (q.filter === "rewards") {
    out.sort((a, b) => (b.holderRewardPoolUsd ?? 0) - (a.holderRewardPoolUsd ?? 0));
  }
  switch (q.sort) {
    case "newest":
      out.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "volume":
      out.sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
      break;
    case "marketCap":
      out.sort((a, b) => (b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0));
      break;
    case "rewards":
      out.sort((a, b) => (b.holderRewardPoolUsd ?? 0) - (a.holderRewardPoolUsd ?? 0));
      break;
    case "holders":
      out.sort((a, b) => (b.holderCount ?? 0) - (a.holderCount ?? 0));
      break;
  }
  return out;
}

/** Demo backend — clearly-labeled sample data, demo mode only. */
const demoClient: IndexerClient = {
  source: "demo",
  async getTokens(query) {
    return applyQuery(DEMO_TOKENS, query);
  },
  async getToken(address) {
    return (
      DEMO_TOKENS.find(
        (t) => t.address.toLowerCase() === address.toLowerCase(),
      ) ?? null
    );
  },
  async getTrades() {
    return DEMO_TRADES;
  },
  async getTokensByCreator() {
    // Demo creators are synthetic addresses; a connected wallet owns none.
    return [];
  },
};

/**
 * Onchain backend — direct contract reads for token lists.
 * TODO(indexer): replace with a real event indexer (subgraph/ponder) for
 * volume, holders, and trades — direct reads cannot provide those cheaply.
 */
const onchainClient: IndexerClient = {
  source: "onchain",
  async getTokens() {
    // Requires deployed factory + a browser/public client. Until an indexer
    // exists we return an empty list rather than partial/fake stats.
    return [];
  },
  async getToken() {
    return null;
  },
  async getTrades() {
    return [];
  },
  async getTokensByCreator() {
    return [];
  },
};

const noneClient: IndexerClient = {
  source: "none",
  async getTokens() {
    return [];
  },
  async getToken() {
    return null;
  },
  async getTrades() {
    return [];
  },
  async getTokensByCreator() {
    return [];
  },
};

/**
 * Freshness wrapper: merge direct on-chain reads over the indexer so a
 * just-launched token is visible INSTANTLY (the factory is the source of
 * truth; the indexer backfills stats minutes later). Never throws — on any
 * on-chain read failure the indexer data passes through untouched.
 */
function withOnchainFreshness(base: IndexerClient): IndexerClient {
  return {
    ...base,
    async getTokens(query) {
      const indexed = await base.getTokens(query);
      try {
        const { fetchFreshTokens } = await import("@/lib/indexer/onchainFresh");
        const known = new Set(indexed.map((t) => t.address.toLowerCase()));
        const fresh = (await fetchFreshTokens(indexed.length)).filter(
          (t) => !known.has(t.address.toLowerCase()),
        );
        const merged = fresh.length > 0 ? [...fresh, ...indexed] : indexed;
        // Suppress denylisted (test/spam) tokens from every listing.
        return merged.filter((t) => !isHiddenToken(t.address));
      } catch {
        return indexed.filter((t) => !isHiddenToken(t.address));
      }
    },
    async getToken(address) {
      // Denylisted tokens are treated as non-existent (their page 404s).
      if (isHiddenToken(address)) return null;
      const t = await base.getToken(address);
      if (t) return t;
      try {
        const { fetchTokenOnchain } = await import("@/lib/indexer/onchainFresh");
        return await fetchTokenOnchain(address);
      } catch {
        return null;
      }
    },
    async getTrades(tokenAddress) {
      // Indexer trades (exact timestamps) merged with trades read straight
      // from pool logs (instant, ~3h lookback) — deduped by tx hash so rows
      // upgrade in place as the indexer catches up.
      const [indexed, live] = await Promise.all([
        base.getTrades(tokenAddress),
        import("@/lib/indexer/onchainFresh")
          .then((m) => m.fetchOnchainTrades(tokenAddress))
          .catch(() => []),
      ]);
      const seen = new Set(indexed.map((t) => t.txHash.toLowerCase()));
      const fresh = live.filter((t) => !seen.has(t.txHash.toLowerCase()));
      return [...fresh, ...indexed].sort((a, b) => b.timestamp - a.timestamp);
    },
  };
}

/** Resolve the active data backend. Demo data never leaks into live mode. */
export function getIndexerClient(): IndexerClient {
  // Prefer the real external indexer (Ponder) when its URL is configured,
  // overlaid with instant on-chain freshness for brand-new launches.
  if (indexerApiConfigured) return withOnchainFreshness(externalClient);
  if (areContractsConfigured) return onchainClient;
  if (platformConfig.demoMode) return demoClient;
  return noneClient;
}
