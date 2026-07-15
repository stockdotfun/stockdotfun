/**
 * Build validated gateway calldata for trading a graduated Flap token through
 * StockDotFun. The gateway is the ONLY target; the frontend/wallet never submits
 * arbitrary router calldata. Returns { to, data, value } for a wallet to sign —
 * this module never holds keys or submits transactions.
 */
import { encodeFunctionData, getAddress, type Hex } from "viem";

export const gatewayAbi = [
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "minOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export type PreparedTrade = { to: `0x${string}`; data: Hex; value: string };

function gatewayAddress(): `0x${string}` {
  const g = process.env.NEXT_PUBLIC_EXTERNAL_TRADE_GATEWAY_ADDRESS;
  if (!g) throw new Error("gateway not configured");
  return getAddress(g);
}

/** Prepare a BUY (native ETH in) through the gateway. */
export function prepareBuy(token: string, ethIn: bigint, minOut: bigint, deadline: bigint): PreparedTrade {
  return {
    to: gatewayAddress(),
    data: encodeFunctionData({
      abi: gatewayAbi,
      functionName: "buy",
      args: [getAddress(token), minOut, deadline],
    }),
    value: ethIn.toString(),
  };
}

/** Prepare a SELL (token in) through the gateway. Requires a prior token approval. */
export function prepareSell(
  token: string,
  amountIn: bigint,
  minOut: bigint,
  deadline: bigint,
): PreparedTrade {
  return {
    to: gatewayAddress(),
    data: encodeFunctionData({
      abi: gatewayAbi,
      functionName: "sell",
      args: [getAddress(token), amountIn, minOut, deadline],
    }),
    value: "0",
  };
}
