"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

type HeroVideoBackgroundProps = {
  /** MP4 source, e.g. /videos/wall-street-hero.mp4. Omit to render poster only. */
  src?: string;
  /** Optional WebM source served before the MP4. */
  webmSrc?: string;
  /** Poster image — also the reduced-motion / mobile / error fallback. */
  poster: string;
  className?: string;
  /** Dark-mode video opacity (0-1). Light mode renders at half of this. */
  opacity?: number;
};

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // SSR: assume no (video renders progressively on client)
  );
}

/**
 * Cinematic looping video layer for hero sections.
 *
 * Behavior:
 * - Poster image is always painted underneath (absolute layers, no CLS).
 * - Video mounts only on desktop-width viewports without reduced motion,
 *   fades in once playable, and unmounts itself if loading errors — the
 *   poster simply remains. Missing video file ⇒ poster-only, no crash.
 * - Light mode halves the opacity so the ivory hero stays clean.
 */
export default function HeroVideoBackground({
  src,
  webmSrc,
  poster,
  className,
  opacity = 0.36,
}: HeroVideoBackgroundProps) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const hasSource = Boolean(src || webmSrc);
  const showVideo = hasSource && !reducedMotion && !isMobile && !failed;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 select-none overflow-hidden opacity-50 dark:opacity-100 ${className ?? ""}`}
    >
      {/* Poster base layer — always present, zero layout shift. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed background, not content */}
      <img
        src={poster}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity }}
        loading="eager"
        decoding="async"
      />

      {showVideo && (
        <video
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          style={{ opacity: ready ? opacity : 0 }}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          onCanPlay={() => setReady(true)}
          onError={() => setFailed(true)}
        >
          {webmSrc && <source src={webmSrc} type="video/webm" />}
          {src && (
            <source src={src} type="video/mp4" onError={() => setFailed(true)} />
          )}
        </video>
      )}
    </div>
  );
}
