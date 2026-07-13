"use client";

import { useState } from "react";
import { useTokenImage } from "@/hooks/useTokenImage";

/**
 * Token launch image with a letter-avatar fallback. Resolves the image from the
 * token's IPFS metadata (via useTokenImage) unless an explicit `imageUrl` is
 * already known (e.g. demo data). Uses a plain <img> because the IPFS gateway
 * host is dynamic and not in next/image's allowlist.
 *
 * `className` sizes the element (e.g. "h-11 w-11 rounded-full"); `fallbackClassName`
 * sets the letter size (e.g. "text-[16px]").
 */
export default function TokenAvatar({
  symbol,
  imageUrl,
  metadataURI,
  className = "",
  fallbackClassName = "",
}: {
  symbol: string;
  imageUrl?: string;
  metadataURI?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const { data: resolved } = useTokenImage(imageUrl ? undefined : metadataURI);
  const [errored, setErrored] = useState(false);
  const src = imageUrl ?? resolved ?? null;

  if (src && !errored) {
    // eslint-disable-next-line @next/next/no-img-element -- dynamic IPFS gateway host
    return (
      <img
        src={src}
        alt={symbol}
        onError={() => setErrored(true)}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex items-center justify-center bg-gradient-to-br from-primary to-success font-bold text-primary-foreground ${className} ${fallbackClassName}`}
    >
      {symbol.charAt(0)}
    </span>
  );
}
