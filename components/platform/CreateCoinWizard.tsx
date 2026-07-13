"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, X, AlertTriangle, Check } from "lucide-react";
import { Input, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import StockAssetSelector from "@/components/platform/StockAssetSelector";
import FeeSplitPreview from "@/components/platform/FeeSplitPreview";
import RewardRoutePreview from "@/components/platform/RewardRoutePreview";
import TransactionStatus from "@/components/platform/TransactionStatus";
import StockLogo from "@/components/StockLogo";
import { useSupportedAssets } from "@/hooks/useSupportedAssets";
import { useLaunchConfig } from "@/hooks/useLaunchConfig";
import { useCreateToken } from "@/hooks/useCreateToken";
import { useUploadTokenImage } from "@/hooks/useUploadTokenImage";
import {
  uploadTokenLaunchMetadata,
  metadataStorageConfigured,
} from "@/lib/storage/upload";
import { useWalletNetwork } from "@/lib/web3/hooks";

const STEPS = ["Meme", "Pair", "Rewards", "Review"] as const;

export default function CreateCoinWizard() {
  const [step, setStep] = useState(0);

  // Step 1 — meme
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const image = useUploadTokenImage();

  // Step 2 — pair
  const [stockSymbol, setStockSymbol] = useState<string | null>(null);

  // Step 3 — rewards. In V2 both holders and creators earn the paired stock
  // token (converted from fees by the treasury); there is no preference choice.
  const pref = "stock" as const;

  // Optional initial "dev buy" — the creator buys some of their own token from
  // the bonding curve right after launch (a real second tx from their wallet).
  const [initialBuyEth, setInitialBuyEth] = useState("");
  const devBuy = parseFloat(initialBuyEth);
  const devBuyValid = initialBuyEth.trim() === "" || (!Number.isNaN(devBuy) && devBuy > 0);

  // Metadata pinning (Part 8) happens at launch, before the on-chain tx.
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { assets, enabledAssets } = useSupportedAssets();
  const launch = useLaunchConfig();
  const wallet = useWalletNetwork();
  const create = useCreateToken();

  const selectedAsset = assets.find((a) => a.symbol === stockSymbol) ?? null;
  const cleanTicker = ticker.replace(/^\$/, "").toUpperCase().slice(0, 10);

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return name.trim().length > 1 && cleanTicker.length > 1 && !!image.file;
      case 1:
        return !!selectedAsset && selectedAsset.enabled;
      case 2:
        return true; // informational in V2 — no reward choice to make
      default:
        return true;
    }
  }, [step, name, cleanTicker, image.file, selectedAsset]);

  const launchBlockers: string[] = [];
  if (!launch.contractsConfigured)
    launchBlockers.push("Launch contracts are not configured yet.");
  if (!wallet.isConnected) launchBlockers.push("Connect your wallet to launch.");
  if (wallet.wrongNetwork)
    launchBlockers.push("Switch to Robinhood Chain to launch.");
  if (selectedAsset && !selectedAsset.address)
    launchBlockers.push(
      `${selectedAsset.symbol} Stock Token address is not configured yet.`,
    );
  if (!metadataStorageConfigured)
    launchBlockers.push(
      "Permanent metadata storage is not configured (set PINATA_JWT).",
    );

  const onLaunch = async () => {
    if (!selectedAsset?.address || !image.file) return;
    setUploadError(null);
    setUploading(true);
    try {
      // 1) Pin image + metadata JSON to IPFS; the factory rejects a blank URI.
      const { metadataUri } = await uploadTokenLaunchMetadata({
        image: image.file,
        name: name.trim(),
        symbol: cleanTicker,
        description: description.trim() || name.trim(),
        stockSymbol: selectedAsset.symbol,
        stockAddress: selectedAsset.address,
        website: website.trim() || undefined,
        twitter: twitter.trim() || undefined,
        telegram: telegram.trim() || undefined,
      });
      // 2) Launch with the permanent metadata URI, plus an optional dev buy.
      create.createToken({
        name: name.trim(),
        symbol: cleanTicker,
        metadataURI: metadataUri,
        stockAssetAddress: selectedAsset.address,
        initialBuyEth: initialBuyEth.trim() || undefined,
      });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Metadata upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && setStep(i)}
            disabled={i > step}
            className={`flex flex-1 items-center gap-2 rounded-full border px-3.5 py-2 transition-colors ${
              i === step
                ? "border-primary/50 bg-primary/10"
                : i < step
                  ? "border-border bg-muted/60 hover:border-primary/30"
                  : "border-border-soft opacity-50"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "border border-primary text-primary"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {i < step ? <Check size={10} strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={`hidden text-[12.5px] font-medium sm:block ${
                i === step ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 rounded-3xl border border-border bg-card p-6 sm:p-7"
        >
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Token name *"
                  placeholder="Doge CEO"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                />
                <Input
                  label="Ticker *"
                  placeholder="DOGECEO"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  maxLength={11}
                  className="font-mono uppercase"
                />
              </div>
              <Textarea
                label="Description"
                placeholder="What is this meme about?"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={280}
              />

              {/* Image upload */}
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Meme image *
                </span>
                {image.previewUrl ? (
                  <div className="mt-1.5 flex items-center gap-4 rounded-xl border border-border bg-muted/50 p-3.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                    <img
                      src={image.previewUrl}
                      alt="Token preview"
                      className="h-14 w-14 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {image.file?.name}
                      </p>
                      <p className="font-mono text-[10.5px] text-muted-foreground">
                        Local preview — permanent storage connects at launch
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={image.clear}
                      aria-label="Remove image"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-4 transition-colors hover:border-primary/40">
                    <ImagePlus size={18} className="text-muted-foreground" />
                    <span className="text-[13px] text-muted-foreground">
                      Upload meme image (max 4MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) image.selectFile(f);
                      }}
                    />
                  </label>
                )}
                {image.error && (
                  <p className="mt-1 text-[11.5px] text-destructive">
                    {image.error}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  label="Website"
                  placeholder="https://"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
                <Input
                  label="X / Twitter"
                  placeholder="@handle"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                />
                <Input
                  label="Telegram"
                  placeholder="t.me/…"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-[14px] text-muted-foreground">
                Choose the supported Stock Token your meme pairs with. Trading
                fees can route toward this asset for eligible holders.
              </p>
              <div className="mt-5">
                <StockAssetSelector
                  assets={assets}
                  selected={stockSymbol}
                  onSelect={setStockSymbol}
                />
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                Stock-token assets may provide economic exposure but do not
                represent direct ownership of underlying securities.
                Availability subject to supported assets, liquidity,
                jurisdiction, and protocol configuration.
              </p>
            </div>
          )}

          {step === 2 && stockSymbol && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <StockLogo ticker={stockSymbol} size={14} brandColor />
                  Holders and creators both earn {stockSymbol}
                </p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  A share of every trade is collected in ETH and converted to{" "}
                  {stockSymbol} in batches, then distributed to eligible holders
                  and to you as the creator. Conversion happens asynchronously —
                  rewards show as “pending conversion” until the swap settles.
                </p>
              </div>
              <FeeSplitPreview feeSplit={launch.feeSplit} stockSymbol={stockSymbol} />
              <RewardRoutePreview stockSymbol={stockSymbol} preference={pref} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                {image.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img
                    src={image.previewUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    {cleanTicker.charAt(0)}
                  </span>
                )}
                <div>
                  <p className="text-lg font-semibold tracking-tight text-foreground">
                    ${cleanTicker}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">{name}</p>
                </div>
                {stockSymbol && (
                  <span className="ml-auto flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 font-mono text-[11.5px] font-bold text-foreground">
                    <StockLogo ticker={stockSymbol} size={12} brandColor />
                    {stockSymbol}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-2xl border border-border-soft bg-muted/40 p-4 font-mono text-[12px]">
                <span className="text-muted-foreground">Fee per trade</span>
                <span className="text-right text-foreground">
                  {(launch.feeSplit.totalBps / 100).toFixed(1)}%
                </span>
                <span className="text-muted-foreground">Creator route</span>
                <span className="text-right text-foreground">{stockSymbol}</span>
                <span className="text-muted-foreground">Launch cost</span>
                <span className="text-right text-foreground">
                  {launch.launchCostLabel}
                </span>
                <span className="text-muted-foreground">Network</span>
                <span className="text-right text-foreground">{launch.network}</span>
              </div>

              {/* Optional initial dev buy */}
              <div className="rounded-2xl border border-border-soft bg-muted/40 p-4">
                <label className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-foreground">
                    Buy ${cleanTicker || "TOKEN"} at launch
                    <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      optional
                    </span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    ETH
                  </span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="0.00"
                  value={initialBuyEth}
                  onChange={(e) => setInitialBuyEth(e.target.value)}
                  className={`mt-2 w-full rounded-xl border bg-background px-3.5 py-2.5 font-mono text-[15px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary ${
                    devBuyValid ? "border-input" : "border-destructive"
                  }`}
                />
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Seed your own coin from the bonding curve in the same flow. This
                  is a second transaction from your wallet right after creation
                  (wrap ETH → buy). Leave blank to skip.
                </p>
              </div>

              {launchBlockers.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-warning/30 bg-warning/5 p-4">
                  {launchBlockers.map((b) => (
                    <p
                      key={b}
                      className="flex items-start gap-2 text-[12.5px] text-warning"
                    >
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {b}
                    </p>
                  ))}
                </div>
              )}

              {uploadError && (
                <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-[12.5px] text-destructive">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {uploadError}
                </div>
              )}

              <TransactionStatus
                isSubmitting={create.isSubmitting}
                isConfirming={create.isConfirming}
                isSuccess={create.isSuccess}
                error={create.error}
                txUrl={create.txUrl}
              />

              <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                By launching you accept the platform terms and risk
                disclosure. Rewards depend on activity and protocol
                configuration — never guaranteed. Not financial advice.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer controls */}
      <div className="mt-5 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!stepValid}>
            Continue
          </Button>
        ) : !wallet.isConnected ? (
          <Button onClick={wallet.connectWallet}>Connect wallet</Button>
        ) : wallet.wrongNetwork ? (
          <Button variant="secondary" onClick={wallet.switchToRobinhoodChain}>
            Switch network
          </Button>
        ) : (
          <Button
            onClick={onLaunch}
            disabled={
              launchBlockers.length > 0 || !devBuyValid || uploading || create.isBusy
            }
            loading={uploading || create.isBusy}
            size="lg"
          >
            {uploading
              ? "Pinning metadata…"
              : create.isBusy
                ? create.stepLabel
                : !launch.contractsConfigured
                  ? "Launch unavailable"
                  : initialBuyEth.trim()
                    ? "Create + buy"
                    : "Create token"}
          </Button>
        )}
      </div>

      {!launch.contractsConfigured && step === STEPS.length - 1 && (
        <div className="mt-4 flex justify-center">
          <Badge variant="warning" dot>
            Launch contracts are not configured yet
          </Badge>
        </div>
      )}

      {enabledAssets.length === 0 && (
        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          No supported stock assets are currently enabled.
        </p>
      )}
    </div>
  );
}
