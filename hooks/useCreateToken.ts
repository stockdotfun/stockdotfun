"use client";

import { useCallback, useState } from "react";
import { parseEther, parseEventLogs, maxUint256 } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { factoryAbi, wethAbi, erc20Abi, poolAbi, curveZapAbi } from "@/lib/contracts/abis";
import { contractAddresses } from "@/lib/contracts/addresses";
import { areContractsConfigured, explorerTxUrl } from "@/lib/config";

export type CreateTokenParams = {
  name: string;
  symbol: string;
  metadataURI: string;
  stockAssetAddress: `0x${string}`;
  /** Optional initial "dev buy" in ETH, executed from the creator's wallet
   *  immediately after the token is created. "" or "0" skips it. */
  initialBuyEth?: string;
  /** Slippage tolerance for the dev buy, percent. Defaults to 3%. */
  slippagePct?: string;
};

export type CreateStep =
  | "idle"
  | "creating"
  | "confirming"
  | "wrapping"
  | "approving"
  | "buying"
  | "done"
  | "error";

const STEP_LABEL: Record<CreateStep, string> = {
  idle: "",
  creating: "Confirm creation in wallet…",
  confirming: "Creating token…",
  wrapping: "Dev buy: wrapping ETH…",
  approving: "Dev buy: approving…",
  buying: "Dev buy: buying…",
  done: "Done",
  error: "Failed",
};

function minusSlippage(amount: bigint, slippagePct: string): bigint {
  const bps = BigInt(Math.max(0, Math.round(parseFloat(slippagePct || "3") * 100)));
  return (amount * (10000n - bps)) / 10000n;
}

function readError(e: unknown): string {
  const anyE = e as { shortMessage?: string; message?: string };
  return anyE?.shortMessage || anyE?.message?.split("\n")[0] || "Transaction failed.";
}

/**
 * Real token creation against StockDotFunFactory, with an optional initial
 * "dev buy" from the creator's own wallet in the same flow:
 *   1. factory.createToken(...) → wait → read the new pool from TokenCreated
 *   2. (optional) wrap ETH → WETH → approve pool → pool.buy  (the same path the
 *      trading panel uses; min-out derived from an onchain quote + slippage)
 * The factory is immutable and has no initial-buy argument, so the dev buy is a
 * genuine second transaction — never faked. If creation succeeds but the dev
 * buy fails, the token still exists and we surface a clear, non-fatal error.
 */
export function useCreateToken() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [step, setStep] = useState<CreateStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [createdToken, setCreatedToken] = useState<`0x${string}` | null>(null);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(null);
    setCreatedToken(null);
  }, []);

  const createToken = useCallback(
    async (params: CreateTokenParams) => {
      setError(null);
      setTxHash(null);
      setCreatedToken(null);
      if (!areContractsConfigured || !contractAddresses.factory || !publicClient) {
        setError("Launch contracts are not configured yet.");
        setStep("error");
        return;
      }

      // --- 1. Create the token ---
      let createHash: `0x${string}`;
      try {
        setStep("creating");
        createHash = await writeContractAsync({
          address: contractAddresses.factory,
          abi: factoryAbi,
          functionName: "createToken",
          args: [params.name, params.symbol, params.metadataURI, params.stockAssetAddress],
        });
        setTxHash(createHash);
      } catch (e) {
        setError(readError(e));
        setStep("error");
        return;
      }

      // Wait for the creation receipt and pull token + pool from TokenCreated.
      let pool: `0x${string}` | undefined;
      try {
        setStep("confirming");
        const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
        const events = parseEventLogs({
          abi: factoryAbi,
          eventName: "TokenCreated",
          logs: receipt.logs,
        });
        const created = events[0]?.args as { token?: `0x${string}`; pool?: `0x${string}` } | undefined;
        if (created?.token) setCreatedToken(created.token);
        pool = created?.pool;
      } catch (e) {
        setError(readError(e));
        setStep("error");
        return;
      }

      // --- 2. Optional dev buy ---
      const buyEth = (params.initialBuyEth ?? "").trim();
      const buyAmount = parseFloat(buyEth);
      const wantsBuy = Number.isFinite(buyAmount) && buyAmount > 0;
      const weth = contractAddresses.weth;

      if (!wantsBuy || !pool) {
        setStep("done");
        return;
      }
      if (!weth || !address) {
        // Token created fine; we just can't run the buy without WETH/address.
        setError("Token created, but the dev buy was skipped (wallet or WETH unavailable).");
        setStep("done");
        return;
      }

      try {
        const value = parseEther(buyEth);

        const [tokensOut] = (await publicClient.readContract({
          address: pool,
          abi: poolAbi,
          functionName: "quoteBuy",
          args: [value],
        })) as [bigint, bigint];
        const minTokensOut = minusSlippage(tokensOut, params.slippagePct ?? "3");

        const zap = contractAddresses.zap;
        if (zap) {
          // ONE transaction: the zap wraps, approves, and buys atomically —
          // create + dev buy = 2 wallet confirmations total.
          setStep("buying");
          const zapHash = await writeContractAsync({
            address: zap,
            abi: curveZapAbi,
            functionName: "buyWithETH",
            args: [pool, minTokensOut],
            value,
          });
          await publicClient.waitForTransactionReceipt({ hash: zapHash });
          setStep("done");
          return;
        }

        // Legacy path (no zap deployed): wrap → approve → buy.
        setStep("wrapping");
        const wrapHash = await writeContractAsync({
          address: weth,
          abi: wethAbi,
          functionName: "deposit",
          value,
        });
        await publicClient.waitForTransactionReceipt({ hash: wrapHash });

        const allowance = (await publicClient.readContract({
          address: weth,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, pool],
        })) as bigint;
        if (allowance < value) {
          setStep("approving");
          const apHash = await writeContractAsync({
            address: weth,
            abi: erc20Abi,
            functionName: "approve",
            args: [pool, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: apHash });
        }

        setStep("buying");
        const buyHash = await writeContractAsync({
          address: pool,
          abi: poolAbi,
          functionName: "buy",
          args: [value, minTokensOut],
        });
        await publicClient.waitForTransactionReceipt({ hash: buyHash });
        setStep("done");
      } catch (e) {
        // Creation already succeeded — report the buy failure without losing it.
        setError(`Token created, but the dev buy failed: ${readError(e)}`);
        setStep("done");
      }
    },
    [address, publicClient, writeContractAsync],
  );

  const isBusy = step !== "idle" && step !== "done" && step !== "error";

  return {
    createToken,
    canCreate: areContractsConfigured,
    step,
    stepLabel: STEP_LABEL[step],
    isBusy,
    // Back-compat flags used by the wizard / TransactionStatus:
    isSubmitting: step === "creating",
    isConfirming: step === "confirming" || step === "wrapping" || step === "approving" || step === "buying",
    isSuccess: step === "done",
    createdToken,
    txHash,
    txUrl: txHash ? explorerTxUrl(txHash) : null,
    error,
    reset,
  };
}
