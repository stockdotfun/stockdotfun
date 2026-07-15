"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { contractAddresses } from "@/lib/contracts/addresses";
import { ALL_ASSETS } from "@/lib/assets/robinhoodAssets";

const managerAbi = [
  { type: "function", name: "currentEpochId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "campaignActive", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "epochs",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "start", type: "uint64" },
      { name: "end", type: "uint64" },
      { name: "started", type: "bool" },
    ],
  },
  { type: "function", name: "epochEnded", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "creditsOf",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "claimedOf",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "previewReward",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "ready", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }, { type: "uint256" }],
  },
] as const;

function symbolFor(asset?: string): string {
  if (!asset) return "";
  return ALL_ASSETS.find((a) => a.address?.toLowerCase() === asset.toLowerCase())?.symbol ?? "stock";
}

export type FlapRewardState = {
  configured: boolean;
  campaignActive: boolean;
  epochId: bigint;
  endsAt: number; // unix seconds
  credits: bigint;
  claimed: boolean;
  ended: boolean;
  reward: { asset: `0x${string}`; symbol: string; amount: bigint; ready: boolean } | null;
  claim: () => Promise<void>;
  claiming: boolean;
  claimTx: `0x${string}` | null;
  claimError: string | null;
};

/** Reads the connected wallet's Flap reward credits + claim state for the current epoch. */
export function useFlapRewards(): FlapRewardState {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const manager = contractAddresses.flapRewardManager;

  const { data: epochIdData } = useReadContract({
    address: manager ?? undefined,
    abi: managerAbi,
    functionName: "currentEpochId",
    query: { enabled: !!manager, refetchInterval: 30_000 },
  });
  const epochId = (epochIdData as bigint | undefined) ?? 0n;
  const ready = !!manager && !!address && epochId > 0n;
  const argsEpochUser = [epochId, address ?? "0x0000000000000000000000000000000000000000"] as const;

  const { data: campaign } = useReadContract({ address: manager ?? undefined, abi: managerAbi, functionName: "campaignActive", query: { enabled: !!manager } });
  const { data: epochInfo } = useReadContract({ address: manager ?? undefined, abi: managerAbi, functionName: "epochs", args: [epochId], query: { enabled: ready } });
  const { data: ended } = useReadContract({ address: manager ?? undefined, abi: managerAbi, functionName: "epochEnded", args: [epochId], query: { enabled: ready } });
  const { data: credits } = useReadContract({ address: manager ?? undefined, abi: managerAbi, functionName: "creditsOf", args: argsEpochUser, query: { enabled: ready, refetchInterval: 30_000 } });
  const { data: claimed } = useReadContract({ address: manager ?? undefined, abi: managerAbi, functionName: "claimedOf", args: argsEpochUser, query: { enabled: ready } });
  const { data: preview } = useReadContract({ address: manager ?? undefined, abi: managerAbi, functionName: "previewReward", args: argsEpochUser, query: { enabled: ready } });

  const [claiming, setClaiming] = useState(false);
  const [claimTx, setClaimTx] = useState<`0x${string}` | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const claim = useCallback(async () => {
    if (!manager || !publicClient || epochId === 0n) return;
    setClaimError(null);
    setClaiming(true);
    try {
      const hash = await writeContractAsync({ address: manager, abi: managerAbi, functionName: "claim", args: [epochId] });
      await publicClient.waitForTransactionReceipt({ hash });
      setClaimTx(hash);
    } catch (e) {
      const m = e as { shortMessage?: string; message?: string };
      setClaimError(m?.shortMessage || m?.message?.split("\n")[0] || "Claim failed");
    } finally {
      setClaiming(false);
    }
  }, [manager, publicClient, epochId, writeContractAsync]);

  const info = epochInfo as [bigint, bigint, boolean] | undefined;
  const pv = preview as [`0x${string}`, bigint, boolean] | undefined;

  return {
    configured: !!manager,
    campaignActive: !!campaign,
    epochId,
    endsAt: info ? Number(info[1]) : 0,
    credits: (credits as bigint | undefined) ?? 0n,
    claimed: !!claimed,
    ended: !!ended,
    reward: pv && pv[0] !== "0x0000000000000000000000000000000000000000"
      ? { asset: pv[0], symbol: symbolFor(pv[0]), amount: pv[1], ready: pv[2] }
      : null,
    claim,
    claiming,
    claimTx,
    claimError,
  };
}
