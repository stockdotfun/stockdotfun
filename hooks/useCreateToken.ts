"use client";

import { useCallback, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { factoryAbi } from "@/lib/contracts/abis";
import { contractAddresses } from "@/lib/contracts/addresses";
import { areContractsConfigured, explorerTxUrl } from "@/lib/config";
import type { CreatorRewardPreference } from "@/types/token";

const PREF_TO_UINT8: Record<CreatorRewardPreference, number> = {
  eth: 0,
  stock: 1,
  split: 2,
};

export type CreateTokenParams = {
  name: string;
  symbol: string;
  metadataURI: string;
  stockAssetAddress: `0x${string}`;
  creatorRewardPreference: CreatorRewardPreference;
};

/**
 * Real token creation against StockDotFunFactory.
 * Refuses to run (with a clear error) when contracts are not configured —
 * token creation is never faked.
 */
export function useCreateToken() {
  const [error, setError] = useState<string | null>(null);
  const {
    writeContract,
    data: txHash,
    isPending: isSubmitting,
    reset,
  } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  const createToken = useCallback(
    (params: CreateTokenParams) => {
      setError(null);
      if (!areContractsConfigured || !contractAddresses.factory) {
        setError("Launch contracts are not configured yet.");
        return;
      }
      writeContract(
        {
          address: contractAddresses.factory,
          abi: factoryAbi,
          functionName: "createToken",
          args: [
            params.name,
            params.symbol,
            params.metadataURI,
            params.stockAssetAddress,
            PREF_TO_UINT8[params.creatorRewardPreference],
          ],
        },
        {
          onError: (e) =>
            setError(
              e.message.split("\n")[0] || "Transaction failed. Try again.",
            ),
        },
      );
    },
    [writeContract],
  );

  return {
    createToken,
    canCreate: areContractsConfigured,
    isSubmitting,
    isConfirming: receipt.isLoading,
    isSuccess: receipt.isSuccess,
    txHash,
    txUrl: txHash ? explorerTxUrl(txHash) : null,
    error,
    reset,
  };
}
