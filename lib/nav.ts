export type NavChild = {
  label: string;
  description: string;
  href: string;
};

export type NavGroup = {
  label: string;
  href: string;
  children?: NavChild[];
};

/** Shared nav structure for public + app headers and mobile nav. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Launch",
    href: "/launch",
    children: [
      {
        label: "Create coin",
        description: "Name it, pair it, launch it",
        href: "/create",
      },
      {
        label: "How launching works",
        description: "The full flow in plain words",
        href: "/docs/how-it-works",
      },
      {
        label: "Fee routing",
        description: "Where every trading fee goes",
        href: "/docs/fees",
      },
      {
        label: "Creator rewards",
        description: "Earn from the markets you start",
        href: "/creator",
      },
    ],
  },
  {
    label: "Explore",
    href: "/explore",
    children: [
      {
        label: "Trending coins",
        description: "What the market is chasing",
        href: "/explore?filter=trending",
      },
      {
        label: "New launches",
        description: "Fresh off the curve",
        href: "/explore?filter=new",
      },
      {
        label: "Stock pairs",
        description: "Supported tokenized stock assets",
        href: "/docs/supported-assets",
      },
      {
        label: "Reward pools",
        description: "Coins ranked by holder rewards",
        href: "/explore?sort=rewards",
      },
      {
        label: "Flap Graduates",
        description: "Graduated Flap tokens on Robinhood Chain",
        href: "/flap",
      },
    ],
  },
  {
    label: "Rewards",
    href: "/rewards",
    children: [
      {
        label: "Holder rewards",
        description: "Stock-token rewards for holding",
        href: "/rewards#holder",
      },
      {
        label: "Creator rewards",
        description: "ETH or stock-token routing",
        href: "/rewards#creator",
      },
      {
        label: "Claim center",
        description: "Claim from your portfolio",
        href: "/portfolio?tab=holder-rewards",
      },
      {
        label: "Reward routing",
        description: "How fees become rewards",
        href: "/docs/fees",
      },
    ],
  },
  {
    label: "Docs",
    href: "/docs/how-it-works",
    children: [
      {
        label: "How it works",
        description: "Platform overview",
        href: "/docs/how-it-works",
      },
      {
        label: "Supported assets",
        description: "The stock-token registry",
        href: "/docs/supported-assets",
      },
      {
        label: "Fees",
        description: "Fee splits and routing",
        href: "/docs/fees",
      },
      {
        label: "Contracts",
        description: "Addresses and architecture",
        href: "/docs/contracts",
      },
    ],
  },
];
