"use client";

import { useState } from "react";
import { Wallet, ChevronDown, Copy, LogOut, AlertTriangle, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useWalletNetwork, shortAddress } from "@/lib/web3/hooks";

export default function ConnectWalletButton({ compact }: { compact?: boolean }) {
  const {
    address,
    isConnected,
    isConnecting,
    wrongNetwork,
    connectWallet,
    disconnect,
    switchToRobinhoodChain,
    isSwitching,
  } = useWalletNetwork();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={connectWallet}
        disabled={isConnecting}
        className="btn-sweep inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
      >
        <Wallet size={14} strokeWidth={2.2} />
        {isConnecting ? "Connecting…" : compact ? "Connect" : "Connect Wallet"}
      </button>
    );
  }

  if (wrongNetwork) {
    return (
      <button
        type="button"
        onClick={switchToRobinhoodChain}
        disabled={isSwitching}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-4 text-[13px] font-semibold text-warning transition-colors hover:bg-warning/20 disabled:opacity-60"
      >
        <AlertTriangle size={14} />
        {isSwitching ? "Switching…" : "Switch network"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-muted/60 px-4 font-mono text-[12.5px] font-medium text-foreground transition-colors hover:border-primary/50"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {shortAddress(address)}
        <ChevronDown size={13} className="text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-border bg-card p-1.5 shadow-xl"
            >
              <button
                type="button"
                onClick={() => {
                  if (address) navigator.clipboard.writeText(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                {copied ? (
                  <Check size={14} className="text-primary" />
                ) : (
                  <Copy size={14} className="text-muted-foreground" />
                )}
                {copied ? "Copied" : "Copy address"}
              </button>
              <button
                type="button"
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                <LogOut size={14} className="text-muted-foreground" />
                Disconnect
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
