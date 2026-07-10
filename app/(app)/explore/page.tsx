"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, LayoutGrid, Rows3, Telescope } from "lucide-react";
import TokenCard from "@/components/platform/TokenCard";
import TokenTable from "@/components/platform/TokenTable";
import Tabs from "@/components/ui/Tabs";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { useExploreTokens } from "@/hooks/useExploreTokens";
import { useSupportedAssets } from "@/hooks/useSupportedAssets";
import type { ExploreQuery } from "@/lib/indexer/types";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "trending", label: "Trending" },
  { value: "rewards", label: "Highest rewards" },
];

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "volume", label: "Volume" },
  { value: "marketCap", label: "Market cap" },
  { value: "rewards", label: "Reward pool" },
  { value: "holders", label: "Holders" },
];

function ExploreContent() {
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>(params.get("filter") ?? "all");
  const [sort, setSort] = useState<string>(params.get("sort") ?? "newest");
  const [stockSymbol, setStockSymbol] = useState<string>("");
  const [view, setView] = useState<"cards" | "table">("cards");

  const { enabledAssets } = useSupportedAssets();
  const query: ExploreQuery = {
    search: search || undefined,
    filter: filter as ExploreQuery["filter"],
    sort: sort as ExploreQuery["sort"],
    stockSymbol: stockSymbol || undefined,
  };
  const { tokens, isLoading, source } = useExploreTokens(query);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-foreground">
            Explore{" "}
            <span className="font-serif italic text-primary">
              market-native memes
            </span>
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Every coin here is paired with a supported tokenized stock asset.
          </p>
        </div>
        {source === "demo" && (
          <Badge variant="demo" dot>
            Demo preview data
          </Badge>
        )}
      </div>

      {/* Controls */}
      <div className="mt-7 flex flex-col gap-3.5">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            placeholder="Search by name, ticker, or stock pair…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-4 text-[13.5px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs items={FILTERS} value={filter} onChange={setFilter} />
          <div className="ml-auto flex items-center gap-2.5">
            <Select
              aria-label="Filter by stock pair"
              options={[
                { value: "", label: "All pairs" },
                ...enabledAssets.map((a) => ({
                  value: a.symbol,
                  label: a.symbol,
                })),
              ]}
              value={stockSymbol}
              onChange={(e) => setStockSymbol(e.target.value)}
              className="!mt-0 h-9 !py-1.5 text-[12.5px]"
            />
            <Select
              aria-label="Sort"
              options={SORTS}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="!mt-0 h-9 !py-1.5 text-[12.5px]"
            />
            <div className="flex rounded-full border border-border p-0.5">
              <button
                type="button"
                aria-label="Card view"
                onClick={() => setView("cards")}
                className={`rounded-full p-1.5 transition-colors ${view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                aria-label="Table view"
                onClick={() => setView("table")}
                className={`rounded-full p-1.5 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                <Rows3 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-7">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <EmptyState
            icon={Telescope}
            title="No launches yet"
            description={
              source === "none"
                ? "Live launch data appears here once contracts and the indexer are connected."
                : "Nothing matches your filters. Try widening the search."
            }
            action={
              <Button onClick={() => (window.location.href = "/create")}>
                Launch the first coin
              </Button>
            }
          />
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tokens.map((t) => (
              <TokenCard key={t.address} token={t} />
            ))}
          </div>
        ) : (
          <TokenTable tokens={tokens} />
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreContent />
    </Suspense>
  );
}
