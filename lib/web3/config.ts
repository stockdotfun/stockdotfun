import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { robinhoodChain } from "@/lib/chains/robinhood";

/**
 * wagmi config with an injected connector (MetaMask, Rabby, browser wallets).
 *
 * TODO(wallets): swap in ConnectKit/RainbowKit once a WalletConnect project ID
 * is provisioned — the rest of the app only consumes wagmi hooks, so the
 * connector layer can change without touching pages.
 */
export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [injected()],
  transports: {
    [robinhoodChain.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
