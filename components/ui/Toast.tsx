"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, AlertTriangle, Info, ExternalLink } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  link?: { href: string; label: string };
};

type ToastInput = Omit<ToastItem, "id">;

const ToastContext = createContext<{ toast: (t: ToastInput) => void }>({
  toast: () => {},
});

let nextId = 1;

const ICONS = {
  success: Check,
  error: AlertTriangle,
  info: Info,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId++;
      setItems((prev) => [...prev.slice(-3), { ...input, id }]);
      setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2.5">
        <AnimatePresence>
          {items.map((t) => {
            const Icon = ICONS[t.variant];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.25 }}
                className="pointer-events-auto rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/10"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      t.variant === "success"
                        ? "bg-primary text-primary-foreground"
                        : t.variant === "error"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon size={13} strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-foreground">
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="mt-0.5 break-words text-[12.5px] leading-snug text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                    {t.link && (
                      <a
                        href={t.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                      >
                        {t.link.label}
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
