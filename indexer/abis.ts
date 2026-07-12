// Event-only ABIs for the V2 contracts indexed by Ponder.

export const FactoryAbi = [
  {
    type: "event",
    name: "TokenCreated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "pool", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "stock", type: "address", indexed: false },
      { name: "holderVault", type: "address", indexed: false },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
] as const;

export const PoolAbi = [
  {
    type: "event",
    name: "Buy",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "quoteIn", type: "uint256", indexed: false },
      { name: "tokensOut", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
      { name: "refund", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Sell",
    inputs: [
      { name: "seller", type: "address", indexed: true },
      { name: "tokensIn", type: "uint256", indexed: false },
      { name: "quoteOut", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
  { type: "event", name: "GraduationReady", inputs: [{ name: "principal", type: "uint256", indexed: false }] },
  {
    type: "event",
    name: "GraduationCompleted",
    inputs: [
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "liquidity", type: "uint128", indexed: false },
    ],
  },
  { type: "event", name: "GraduationFailed", inputs: [{ name: "reason", type: "bytes", indexed: false }] },
] as const;

export const TreasuryAbi = [
  {
    type: "event",
    name: "Converted",
    inputs: [
      { name: "pool", type: "address", indexed: true },
      { name: "wethConverted", type: "uint256", indexed: false },
      { name: "stockOut", type: "uint256", indexed: false },
      { name: "holderStock", type: "uint256", indexed: false },
      { name: "creatorStock", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StockConversionFailed",
    inputs: [
      { name: "pool", type: "address", indexed: true },
      { name: "wethAttempted", type: "uint256", indexed: false },
      { name: "reason", type: "bytes", indexed: false },
    ],
  },
] as const;

export const HolderVaultAbi = [
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "asset", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const CreatorVaultAbi = [
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "asset", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const MemeTokenAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;
