"use client";

import { useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import Button from "@/components/ui/Button";
import TransactionStatus from "@/components/platform/TransactionStatus";
import { useWalletNetwork } from "@/lib/web3/hooks";
import { contractAddresses } from "@/lib/contracts/addresses";
import { erc20Abi } from "@/lib/contracts/abis";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useFlapTrade, type FlapQuote } from "@/hooks/useFlapTrade";
import type { TradeSide } from "@/types/token";

const registryAbi = [
  { type: "function", name: "isTradable", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
] as const;
const gatewayRewardsAbi = [
  { type: "function", name: "rewardsActive", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "rewardFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
] as const;

function fmt(n: number, max = 4) {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 0.0001) return n.toLocaleString("en-US", { maximumFractionDigits: max });
  return n.toExponential(2);
}

export default function FlapTradePanel({ token, symbol }: { token: string; symbol: string }) {
  const [side, setSide] = useState<TradeSide>("buy");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<FlapQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const { isConnected, wrongNetwork, connectWallet, switchToRobinhoodChain } = useWalletNetwork();
  const { address } = useAccount();
  const ethUsd = useEthPrice();
  const trade = useFlapTrade(token);

  const gateway = contractAddresses.externalTradeGateway;
  const registry = contractAddresses.flapDexRegistry;

  const { data: tradable } = useReadContract({
    address: registry ?? undefined,
    abi: registryAbi,
    functionName: "isTradable",
    args: [token as `0x${string}`],
    query: { enabled: !!registry },
  });
  const { data: rewardsActive } = useReadContract({
    address: gateway ?? undefined,
    abi: gatewayRewardsAbi,
    functionName: "rewardsActive",
    query: { enabled: !!gateway },
  });
  const { data: rewardFeeBps } = useReadContract({
    address: gateway ?? undefined,
    abi: gatewayRewardsAbi,
    functionName: "rewardFeeBps",
    query: { enabled: !!gateway },
  });
  const { data: tokenBalance } = useReadContract({
    address: token as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const balance = (tokenBalance as bigint | undefined) ?? 0n;

  const parsed = parseFloat(amount);
  const validAmount = !Number.isNaN(parsed) && parsed > 0;

  // Debounced quote.
  useEffect(() => {
    if (!validAmount) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(async () => {
      const q = await trade.quote(amount, side);
      if (!cancelled) {
        setQuote(q);
        setQuoting(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, side, validAmount]);

  const onConfirm = () => {
    if (!validAmount || !quote) return;
    if (side === "buy") trade.buy(amount, quote.minOut);
    else trade.sell(parseEther(amount), quote.minOut);
  };

  const notConfigured = !gateway;
  const notTradable = registry && tradable === false;
  const feeBps = Number(rewardFeeBps ?? 0);
  const rewardsOn = !!rewardsActive;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex rounded-full border border-border bg-muted/60 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSide(s);
              setAmount("");
              trade.reset();
            }}
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
            {side === "buy" ? "You pay (ETH)" : `You sell ($${symbol})`}
          </span>
          {side === "sell" && isConnected && (
            <button
              type="button"
              onClick={() => setAmount(formatEther(balance))}
              className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Balance: {fmt(Number(formatEther(balance)))} — MAX
            </button>
          )}
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
        {side === "buy" && ethUsd && validAmount && (
          <div className="mt-1 text-right font-mono text-[10.5px] text-muted-foreground">
            ≈ ${(parsed * ethUsd).toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1.5 rounded-xl border border-border-soft bg-muted/40 px-3.5 py-3 font-mono text-[11.5px]">
        <Row label={side === "buy" ? "You receive (est.)" : "You receive (ETH, est.)"}>
          {!validAmount
            ? "—"
            : quoting
              ? "…"
              : quote
                ? side === "buy"
                  ? `${fmt(Number(formatEther(quote.amountOut)))} ${symbol}`
                  : `${fmt(Number(formatEther(quote.amountOut)))} ETH`
                : "—"}
        </Row>
        <Row label="Min received">
          {quote ? `${fmt(Number(formatEther(quote.minOut)))} ${side === "buy" ? symbol : "ETH"}` : "—"}
        </Row>
        <Row label="Price impact">
          {quote ? `${(quote.priceImpactBps / 100).toFixed(2)}%` : "—"}
        </Row>
        <Row label="Token tax">
          {quote ? `${((side === "buy" ? quote.buyTaxBps : quote.sellTaxBps) / 100).toFixed(1)}%` : "—"}
        </Row>
        <Row label="Reward-program fee">
          <span className={rewardsOn ? "text-foreground" : "text-muted-foreground"}>
            {rewardsOn ? `${(feeBps / 100).toFixed(2)}%` : "Paused"}
          </span>
        </Row>
        <Row label="Route">
          <span className="text-success">→ Flap DEX (Uniswap V2)</span>
        </Row>
      </div>

      <div className="mt-4">
        {notConfigured ? (
          <Button disabled className="w-full" size="lg">
            Trading not configured
          </Button>
        ) : notTradable ? (
          <div className="space-y-2">
            <Button disabled className="w-full" size="lg">
              DEX routing not yet enabled
            </Button>
            <p className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Graduated on Flap — StockDotFun trading pending listing
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
            disabled={!validAmount || !quote || trade.isBusy}
            loading={trade.isBusy}
            className="w-full"
            size="lg"
          >
            {trade.isBusy
              ? trade.step === "approving"
                ? "Approving…"
                : "Confirming…"
              : side === "buy"
                ? `Buy $${symbol}`
                : `Sell $${symbol}`}
          </Button>
        )}
      </div>

      {(trade.isBusy || trade.error || trade.step === "done") && (
        <div className="mt-3">
          <TransactionStatus
            isConfirming={trade.isBusy}
            isSuccess={trade.step === "done"}
            error={trade.error}
            txUrl={trade.txHash ? `https://robinhoodchain.blockscout.com/tx/${trade.txHash}` : undefined}
          />
        </div>
      )}

      {!rewardsOn && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Stock-reward campaign is paused — no reward fee is charged.
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}
