/**
 * Original "Wall Street celebration" motif for the footer — an anonymous
 * arms-spread ghost silhouette with green + gold confetti raining over the
 * giant wordmark. A nod to market-meme culture with zero copyrighted or
 * celebrity imagery: fully generated vector art in the brand palette.
 *
 * Theme-aware: the figure uses --foreground (dark on light, light on dark),
 * so it reads as a subtle silhouette in both themes, echoing the hero's
 * ghost-ticker aesthetic.
 */

const CONFETTI_PALETTE = [
  "#00c805",
  "#7ce896",
  "#00a305",
  "#d4af37",
  "#e6c65c",
  "#c9a227",
];

// Deterministic layout (index-derived, no Math.random) → no hydration drift.
const CONFETTI = Array.from({ length: 64 }, (_, i) => {
  const x = (i * 137.5) % 1200;
  const y = ((i * 83) % 210) + 8;
  const rot = (i * 47) % 360;
  const long = i % 3 === 0;
  return {
    x,
    y,
    rot,
    w: long ? 16 : 8,
    h: long ? 5 : 8,
    color: CONFETTI_PALETTE[i % CONFETTI_PALETTE.length],
    opacity: 0.35 + ((i * 7) % 45) / 100,
  };
});

export default function FooterCelebration() {
  return (
    <svg
      viewBox="0 0 1200 260"
      preserveAspectRatio="xMidYMax meet"
      className="pointer-events-none absolute inset-x-0 bottom-[6vw] mx-auto h-[22vw] max-h-[260px] min-h-[150px] w-full max-w-4xl"
      aria-hidden="true"
    >
      {/* soft green stage glow behind the figure */}
      <ellipse cx="600" cy="210" rx="230" ry="60" fill="var(--primary)" opacity="0.08" />

      {/* confetti / ticker-tape rain */}
      {CONFETTI.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          rx="1.5"
          fill={c.color}
          opacity={c.opacity}
          transform={`rotate(${c.rot} ${c.x + c.w / 2} ${c.y + c.h / 2})`}
        />
      ))}

      {/* arms-spread ghost figure */}
      <g fill="var(--foreground)" opacity="0.12">
        {/* head */}
        <circle cx="600" cy="86" r="17" />
        {/* torso / suit jacket */}
        <path d="M562 104 h76 l-13 108 h-50 Z" />
      </g>
      {/* arms spread wide + up, open palms */}
      <g
        stroke="var(--foreground)"
        strokeOpacity="0.12"
        strokeWidth="22"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M568 112 L440 66" />
        <path d="M632 112 L760 66" />
      </g>
      <g fill="var(--foreground)" opacity="0.12">
        <circle cx="432" cy="62" r="15" />
        <circle cx="768" cy="62" r="15" />
      </g>
      {/* brand-green tie (the culture cue, not gold) */}
      <path d="M596 108 l4 0 l3 60 l-5 4 l-5 -4 Z" fill="var(--primary)" opacity="0.7" />
    </svg>
  );
}
