"use client";

import { useCallback, useState } from "react";
import { parseEther, maxUint256 } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { wethAbi, erc20Abi, poolAbi } from "@/lib/contracts/abis";
import { contractAddresses } from "@/lib/contracts/addresses";
import { areContractsConfigured, explorerTxUrl } from "@/lib/config";
import type { LaunchedToken, TradeSide } from "@/types/token";

/** Live quote result. `out` and `fee` are 18-decimal wei amounts. For a buy,
 *  `out` is meme tokens and `fee` is the WETH fee; for a sell, `out` is WETH
 *  received and `fee` is the WETH fee. */
export type TradeQuote = { out: bigint; fee: bigint };

export type TradeStep =
  | "idle"
  | "wrapping"
  | "approving"
  | "buying"
  | "selling"
  | "unwrapping"
  | "done"
  | "error";

const STEP_LABEL: Record<TradeStep, string> = {
  idle: "",
  wrapping: "Wrapping ETH → WETH…",
  approving: "Approving…",
  buying: "Buying…",
  selling: "Selling…",
  unwrapping: "Unwrapping WETH → ETH…",
  done: "Done",
  error: "Failed",
};

function minusSlippage(amount: bigint, slippagePct: string): bigint {
  const bps = BigInt(Math.max(0, Math.round(parseFloat(slippagePct || "1") * 100)));
  return (amount * (10000n - bps)) / 10000n;
}

function readError(e: unknown): string {
  const anyE = e as { shortMessage?: string; message?: string };
  return (
    anyE?.shortMessage ||
    anyE?.message?.split("\n")[0] ||
    "Transaction failed."
  );
}

/**
 * Real buy/sell against the bonding-curve pool, orchestrating the ETH↔WETH
 * wrap/unwrap on the client:
 *   buy:  wrap ETH → WETH → approve pool → pool.buy
 *   sell: approve pool → pool.sell (receives WETH) → unwrap WETH → ETH
 * Min-out is derived from an onchain quote and the user's slippage tolerance.
 * Only runs when contracts are configured; never fakes a trade.
 */
export function useTrade(token: LaunchedToken) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [step, setStep] = useState<TradeStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const weth = contractAddresses.weth;
  const pool = token.pool;
  const canTrade = areContractsConfigured && !!weth && !token.isDemo;

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(null);
  }, []);

  /**
   * Read-only quote for the current input. Returns `null` when the input is
   * invalid, trading is unavailable, or the on-chain read reverts (e.g. the
   * token has graduated off the curve). Never throws — the caller renders "—".
   */
  const quote = useCallback(
    async (amount: string, tradeSide: TradeSide): Promise<TradeQuote | null> => {
      if (!canTrade || !publicClient || !pool) return null;
      const parsedAmt = parseFloat(amount);
      if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) return null;
      let value: bigint;
      try {
        value = parseEther(amount);
      } catch {
        return null;
      }
      if (value <= 0n) return null;
      try {
        const [out, fee] = (await publicClient.readContract({
          address: pool,
          abi: poolAbi,
          functionName: tradeSide === "buy" ? "quoteBuy" : "quoteSell",
          args: [value],
        })) as [bigint, bigint];
        return { out, fee };
      } catch {
        return null;
      }
    },
    [canTrade, publicClient, pool],
  );

  const buy = useCallback(
    async (amountEth: string, slippagePct = "1.0") => {
      setError(null);
      setTxHash(null);
      if (!canTrade || !weth || !address || !publicClient) {
        setError("Trading is not available yet.");
        setStep("error");
        return;
      }
      try {
        const value = parseEther(amountEth);

        // quote → min tokens out
        const [tokensOut] = (await publicClient.readContract({
          address: pool,
          abi: poolAbi,
          functionName: "quoteBuy",
          args: [value],
        })) as [bigint, bigint];
        const minTokensOut = minusSlippage(tokensOut, slippagePct);

        // 1. wrap ETH → WETH
        setStep("wrapping");
        const wrapHash = await writeContractAsync({
          address: weth,
          abi: wethAbi,
          functionName: "deposit",
          value,
        });
        await publicClient.waitForTransactionReceipt({ hash: wrapHash });

        // 2. approve WETH → pool (only if needed)
        const allowance = (await publicClient.readContract({
          address: weth,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, pool],
        })) as bigint;
        if (allowance < value) {
          // Approve max so future buys skip this step (one fewer wallet prompt).
          setStep("approving");
          const apHash = await writeContractAsync({
            address: weth,
            abi: erc20Abi,
            functionName: "approve",
            args: [pool, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: apHash });
        }

        // 3. buy
        setStep("buying");
        const buyHash = await writeContractAsync({
          address: pool,
          abi: poolAbi,
          functionName: "buy",
          args: [value, minTokensOut],
        });
        await publicClient.waitForTransactionReceipt({ hash: buyHash });
        setTxHash(buyHash);
        setStep("done");
      } catch (e) {
        setError(readError(e));
        setStep("error");
      }
    },
    [canTrade, weth, address, publicClient, pool, writeContractAsync],
  );

  const sell = useCallback(
    async (tokenAmount: string, slippagePct = "1.0") => {
      setError(null);
      setTxHash(null);
      if (!canTrade || !weth || !address || !publicClient) {
        setError("Trading is not available yet.");
        setStep("error");
        return;
      }
      try {
        const amount = parseEther(tokenAmount); // meme token is 18 decimals

        // quote → min ETH out
        const [quoteOut] = (await publicClient.readContract({
          address: pool,
          abi: poolAbi,
          functionName: "quoteSell",
          args: [amount],
        })) as [bigint, bigint];
        const minQuoteOut = minusSlippage(quoteOut, slippagePct);

        // 1. approve meme → pool (only if needed)
        const allowance = (await publicClient.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, pool],
        })) as bigint;
        if (allowance < amount) {
          // Approve max so future sells skip this step (one fewer wallet prompt).
          setStep("approving");
          const apHash = await writeContractAsync({
            address: token.address,
            abi: erc20Abi,
            functionName: "approve",
            args: [pool, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: apHash });
        }

        // 2. sell → receive WETH
        setStep("selling");
        const sellHash = await writeContractAsync({
          address: pool,
          abi: poolAbi,
          functionName: "sell",
          args: [amount, minQuoteOut],
        });
        await publicClient.waitForTransactionReceipt({ hash: sellHash });

        // 3. unwrap the WETH just received → native ETH
        const wbal = (await publicClient.readContract({
          address: weth,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        if (wbal > 0n) {
          setStep("unwrapping");
          const unwrapHash = await writeContractAsync({
            address: weth,
            abi: wethAbi,
            functionName: "withdraw",
            args: [wbal],
          });
          await publicClient.waitForTransactionReceipt({ hash: unwrapHash });
        }
        setTxHash(sellHash);
        setStep("done");
      } catch (e) {
        setError(readError(e));
        setStep("error");
      }
    },
    [canTrade, weth, address, publicClient, pool, token.address, writeContractAsync],
  );

  const isBusy = step !== "idle" && step !== "done" && step !== "error";

  return {
    buy,
    sell,
    quote,
    step,
    stepLabel: STEP_LABEL[step],
    isBusy,
    error,
    txHash,
    txUrl: txHash ? explorerTxUrl(txHash) : null,
    canTrade,
    reset,
  };
}
