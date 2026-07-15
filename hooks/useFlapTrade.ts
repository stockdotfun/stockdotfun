"use client";

import { useCallback, useState } from "react";
import { parseEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { contractAddresses } from "@/lib/contracts/addresses";
import { erc20Abi } from "@/lib/contracts/abis";
import { gatewayAbi } from "@/lib/integrations/flap/trades";
import type { TradeSide } from "@/types/token";

export type FlapQuote = {
  amountOut: bigint;
  minOut: bigint;
  priceImpactBps: number;
  buyTaxBps: number;
  sellTaxBps: number;
};

type Step = "idle" | "approving" | "buying" | "selling" | "done";

/**
 * Trade a graduated Flap token through the StockDotFun gateway. Buys send native
 * ETH; sells approve the gateway then call sell. Quotes come from the honest
 * on-chain quote API. The gateway enforces slippage + attribution on-chain.
 */
export function useFlapTrade(token: string) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const gateway = contractAddresses.externalTradeGateway;
  const isBusy = step === "approving" || step === "buying" || step === "selling";

  const quote = useCallback(
    async (amount: string, side: TradeSide, slippageBps = 100): Promise<FlapQuote | null> => {
      try {
        const res = await fetch(
          `/api/flap/tokens/${token}/quote?side=${side}&amountIn=${amount}&slippageBps=${slippageBps}`,
        );
        if (!res.ok) return null;
        const j = await res.json();
        return {
          amountOut: BigInt(j.amountOut),
          minOut: BigInt(j.minOut),
          priceImpactBps: j.priceImpactBps,
          buyTaxBps: j.buyTaxBps,
          sellTaxBps: j.sellTaxBps,
        };
      } catch {
        return null;
      }
    },
    [token],
  );

  const buy = useCallback(
    async (ethAmount: string, minOut: bigint) => {
      if (!gateway || !publicClient) return;
      setError(null);
      setTxHash(null);
      setStep("buying");
      try {
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
        const hash = await writeContractAsync({
          address: gateway,
          abi: gatewayAbi,
          functionName: "buy",
          args: [token as `0x${string}`, minOut, deadline],
          value: parseEther(ethAmount),
        });
        await publicClient.waitForTransactionReceipt({ hash });
        setTxHash(hash);
        setStep("done");
      } catch (e) {
        setError(readableError(e));
        setStep("idle");
      }
    },
    [gateway, publicClient, token, writeContractAsync],
  );

  const sell = useCallback(
    async (amountIn: bigint, minOut: bigint) => {
      if (!gateway || !publicClient || !address) return;
      setError(null);
      setTxHash(null);
      try {
        const allowance = (await publicClient.readContract({
          address: token as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, gateway],
        })) as bigint;
        if (allowance < amountIn) {
          setStep("approving");
          const ah = await writeContractAsync({
            address: token as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [gateway, amountIn],
          });
          await publicClient.waitForTransactionReceipt({ hash: ah });
        }
        setStep("selling");
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
        const hash = await writeContractAsync({
          address: gateway,
          abi: gatewayAbi,
          functionName: "sell",
          args: [token as `0x${string}`, amountIn, minOut, deadline],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        setTxHash(hash);
        setStep("done");
      } catch (e) {
        setError(readableError(e));
        setStep("idle");
      }
    },
    [gateway, publicClient, address, token, writeContractAsync],
  );

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(null);
  }, []);

  return { quote, buy, sell, reset, step, isBusy, error, txHash, gatewayConfigured: !!gateway };
}

function readableError(e: unknown): string {
  const m = e as { shortMessage?: string; message?: string };
  return m?.shortMessage || m?.message?.split("\n")[0] || "Transaction failed";
}
