"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import {
  factoryAbi,
  rewardVaultAbi,
  creatorRewardVaultAbi,
  wethAbi,
} from "@/lib/contracts/abis";
import { contractAddresses } from "@/lib/contracts/addresses";
import { areContractsConfigured, explorerTxUrl } from "@/lib/config";

export type ClaimStep = "idle" | "claiming" | "unwrapping" | "done" | "error";

function readError(e: unknown): string {
  const anyE = e as { shortMessage?: string; message?: string };
  return anyE?.shortMessage || anyE?.message?.split("\n")[0] || "Claim failed.";
}

/**
 * Claims holder or creator rewards and, when the reward asset is WETH,
 * unwraps it to native ETH so the user receives ETH.
 * Vault addresses are resolved from the factory on demand (per-token holder
 * vault via vaultOf, global creator vault via creatorVault).
 * Runs only when contracts are configured.
 */
export function useClaim() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [step, setStep] = useState<ClaimStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const weth = contractAddresses.weth;
  const factory = contractAddresses.factory;
  const canClaim = areContractsConfigured && !!factory;

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(null);
  }, []);

  const runClaim = useCallback(
    async (
      vault: `0x${string}`,
      asset: `0x${string}`,
      abi: typeof rewardVaultAbi | typeof creatorRewardVaultAbi,
    ) => {
      if (!address || !publicClient) throw new Error("Wallet not ready.");

      const claimable = (await publicClient.readContract({
        address: vault,
        abi,
        functionName: "claimable",
        args: [address, asset],
      })) as bigint;
      if (claimable === 0n) throw new Error("Nothing to claim yet.");

      setStep("claiming");
      const claimHash = await writeContractAsync({
        address: vault,
        abi,
        functionName: "claim",
        args: [asset],
      });
      await publicClient.waitForTransactionReceipt({ hash: claimHash });
      setTxHash(claimHash);

      // If the reward was WETH, unwrap the claimed amount to native ETH.
      if (weth && asset.toLowerCase() === weth.toLowerCase()) {
        setStep("unwrapping");
        const unwrapHash = await writeContractAsync({
          address: weth,
          abi: wethAbi,
          functionName: "withdraw",
          args: [claimable],
        });
        await publicClient.waitForTransactionReceipt({ hash: unwrapHash });
      }
      setStep("done");
    },
    [address, publicClient, weth, writeContractAsync],
  );

  /** Claim a holder reward for `tokenAddress` in `asset` (defaults to WETH/ETH). */
  const claimHolderRewards = useCallback(
    async (tokenAddress: `0x${string}`, asset?: `0x${string}`) => {
      setError(null);
      setTxHash(null);
      if (!canClaim || !factory || !publicClient) {
        setError("Claiming is not available yet.");
        setStep("error");
        return;
      }
      try {
        const rewardAsset = asset ?? weth;
        if (!rewardAsset) throw new Error("Reward asset not configured.");
        const vault = (await publicClient.readContract({
          address: factory,
          abi: factoryAbi,
          functionName: "vaultOf",
          args: [tokenAddress],
        })) as `0x${string}`;
        await runClaim(vault, rewardAsset, rewardVaultAbi);
      } catch (e) {
        setError(readError(e));
        setStep("error");
      }
    },
    [canClaim, factory, publicClient, weth, runClaim],
  );

  /** Claim creator rewards in `asset` (defaults to WETH/ETH). */
  const claimCreatorRewards = useCallback(
    async (asset?: `0x${string}`) => {
      setError(null);
      setTxHash(null);
      if (!canClaim || !factory || !publicClient) {
        setError("Claiming is not available yet.");
        setStep("error");
        return;
      }
      try {
        const rewardAsset = asset ?? weth;
        if (!rewardAsset) throw new Error("Reward asset not configured.");
        const vault = (await publicClient.readContract({
          address: factory,
          abi: factoryAbi,
          functionName: "creatorVault",
          args: [],
        })) as `0x${string}`;
        await runClaim(vault, rewardAsset, creatorRewardVaultAbi);
      } catch (e) {
        setError(readError(e));
        setStep("error");
      }
    },
    [canClaim, factory, publicClient, weth, runClaim],
  );

  const isBusy = step === "claiming" || step === "unwrapping";

  return {
    claimHolderRewards,
    claimCreatorRewards,
    step,
    isBusy,
    error,
    txHash,
    txUrl: txHash ? explorerTxUrl(txHash) : null,
    canClaim,
    reset,
  };
}
