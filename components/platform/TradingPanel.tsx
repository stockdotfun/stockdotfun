"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { Settings2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import TransactionStatus from "@/components/platform/TransactionStatus";
import { useWalletNetwork } from "@/lib/web3/hooks";
import { areContractsConfigured } from "@/lib/config";
import { DEFAULT_FEE_SPLIT } from "@/lib/data/fees";
import { erc20Abi } from "@/lib/contracts/abis";
import { useTrade, type TradeQuote } from "@/hooks/useTrade";
import { useEthPrice } from "@/hooks/useEthPrice";
import type { LaunchedToken, TradeSide } from "@/types/token";

/** Compact USD label for trade amounts. */
function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format an 18-decimal balance for a compact display label. */
function fmtBalance(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (n === 0) return "0";
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

const SELL_PERCENTS = [10, 25, 50, 100] as const;
const BUY_USD_PRESETS = [10, 50, 100, 500] as const;

/** Format an 18-decimal wei amount for display, scaling precision to size. */
function fmtAmount(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 0.0001) return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return n.toExponential(2);
}

/**
 * Buy/Sell panel. Buy wraps ETH → WETH → approves → pool.buy; sell approves →
 * pool.sell → unwraps WETH → ETH (all in useTrade). Executes only when
 * contracts are configured; otherwise every action is disabled with a reason.
 */
export default function TradingPanel({ token }: { token: LaunchedToken }) {
  const [side, setSide] = useState<TradeSide>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1.0");
  const [showSlippage, setShowSlippage] = useState(false);
  const { isConnected, wrongNetwork, connectWallet, switchToRobinhoodChain } =
    useWalletNetwork();
  const { address } = useAccount();
  const trade = useTrade(token);
  const { quote: fetchQuote } = trade;
  const ethUsd = useEthPrice();

  // Connected wallet's balance of this meme token (for sell % quick-select).
  const { data: tokenBalance } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !token.isDemo && areContractsConfigured },
  });
  const balance = (tokenBalance as bigint | undefined) ?? 0n;

  const setSellPercent = (pct: number) => {
    if (balance <= 0n) return;
    const wei = pct >= 100 ? balance : (balance * BigInt(pct)) / 100n;
    setAmount(formatEther(wei));
  };

  // Buy quick-amounts are denominated in USD (pump.fun-style) and converted to
  // the ETH the input expects via the live ETH price.
  const setBuyUsd = (usd: number) => {
    if (!ethUsd) return;
    setAmount((usd / ethUsd).toFixed(6));
  };

  const feePct = DEFAULT_FEE_SPLIT.totalBps / 100;
  const parsed = parseFloat(amount);
  const validAmount = !Number.isNaN(parsed) && parsed > 0;

  // Live on-chain estimate (debounced). null = no quote yet / unavailable.
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    if (!validAmount || !areContractsConfigured || token.isDemo) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const timer = setTimeout(async () => {
      const q = await fetchQuote(amount, side);
      if (cancelled) return;
      setQuote(q);
      setQuoting(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amount, side, validAmount, token.isDemo, fetchQuote]);

  const disabledReason = !areContractsConfigured
    ? "Trading contracts are not configured yet."
    : !isConnected
      ? "Connect your wallet to trade."
      : wrongNetwork
        ? "Switch to Robinhood Chain to trade."
        : !validAmount
          ? "Enter an amount."
          : null;

  const onConfirm = () => {
    if (!validAmount) return;
    if (side === "buy") trade.buy(amount, slippage);
    else trade.sell(amount, slippage);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex rounded-full border border-border bg-muted/60 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`flex-1 rounded-full py-2 text-[13px] font-semibold capitalize transition-colors ${
              side === s
                ? s === "buy"
                  ? "bg-primary text-primary-foreground"
                  : "bg-destructive/80 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {side === "buy" ? "You pay (ETH)" : `You sell ($${token.symbol})`}
          </span>
          <button
            type="button"
            onClick={() => setShowSlippage((v) => !v)}
            aria-label="Slippage settings"
            className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings2 size={11} />
            {slippage}%
          </button>
        </div>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-3 font-mono text-[18px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary"
        />
        {side === "buy" && ethUsd !== undefined && validAmount && (
          <div className="mt-1 text-right font-mono text-[10.5px] text-muted-foreground">
            ≈ {fmtUsd(parsed * ethUsd)}
          </div>
        )}
        {side === "buy" && !token.isDemo && ethUsd !== undefined && (
          <div className="mt-2 flex gap-1.5">
            {BUY_USD_PRESETS.map((usd) => (
              <button
                key={usd}
                type="button"
                onClick={() => setBuyUsd(usd)}
                className="flex-1 rounded-lg border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                ${usd}
              </button>
            ))}
          </div>
        )}
        {side === "sell" && isConnected && !token.isDemo && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {SELL_PERCENTS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  disabled={balance <= 0n}
                  onClick={() => setSellPercent(pct)}
                  className="rounded-lg border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pct === 100 ? "MAX" : `${pct}%`}
                </button>
              ))}
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              Balance: {fmtBalance(balance)} ${token.symbol}
            </span>
          </div>
        )}
        {showSlippage && (
          <div className="mt-2 flex items-center gap-2">
            {["0.5", "1.0", "2.0"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlippage(s)}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  slippage === s
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}%
              </button>
            ))}
            <span className="font-mono text-[10px] text-muted-foreground">
              max slippage
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1.5 rounded-xl border border-border-soft bg-muted/40 px-3.5 py-3 font-mono text-[11.5px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {side === "buy" ? "You receive (est.)" : "You receive (ETH, est.)"}
          </span>
          <span className="text-foreground">
            {!areContractsConfigured
              ? "n/a"
              : !validAmount
                ? "—"
                : quoting
                  ? "…"
                  : quote
                    ? side === "buy"
                      ? `${fmtAmount(quote.out)} $${token.symbol}`
                      : `${fmtAmount(quote.out)} ETH${ethUsd !== undefined ? ` · ${fmtUsd(Number(formatEther(quote.out)) * ethUsd)}` : ""}`
                    : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fee ({feePct}%)</span>
          <span className="text-foreground">
            {quote
              ? `${fmtAmount(quote.fee)} ETH${ethUsd !== undefined ? ` · ${fmtUsd(Number(formatEther(quote.fee)) * ethUsd)}` : ""}`
              : validAmount
                ? `${((parsed * feePct) / 100).toFixed(4)} ETH`
                : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Reward route</span>
          <span className="text-success">→ {token.stockSymbol} vault</span>
        </div>
      </div>

      <div className="mt-4">
        {!areContractsConfigured ? (
          <div className="space-y-2.5">
            <Button disabled className="w-full" size="lg">
              {side === "buy" ? "Buy" : "Sell"} — unavailable
            </Button>
            <p className="text-center font-mono text-[10.5px] uppercase tracking-wider text-warning">
              Trading contracts are not configured yet
            </p>
          </div>
        ) : !isConnected ? (
          <Button onClick={connectWallet} className="w-full" size="lg">
            Connect wallet
          </Button>
        ) : wrongNetwork ? (
          <Button onClick={switchToRobinhoodChain} className="w-full" size="lg" variant="secondary">
            Switch to Robinhood Chain
          </Button>
        ) : (
          <Button
            onClick={onConfirm}
            disabled={!!disabledReason || trade.isBusy}
            loading={trade.isBusy}
            className="w-full"
            size="lg"
          >
            {trade.isBusy
              ? trade.stepLabel
              : side === "buy"
                ? `Buy $${token.symbol}`
                : `Sell $${token.symbol}`}
          </Button>
        )}
      </div>

      {(trade.isBusy || trade.error || trade.step === "done") && (
        <div className="mt-3">
          <TransactionStatus
            isConfirming={trade.isBusy}
            isSuccess={trade.step === "done"}
            error={trade.error}
            txUrl={trade.txUrl}
          />
        </div>
      )}

      {token.isDemo && (
        <div className="mt-3 flex justify-center">
          <Badge variant="demo">Demo token — trading disabled</Badge>
        </div>
      )}
    </div>
  );
}
