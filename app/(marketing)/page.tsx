import { existsSync } from "node:fs";
import { join } from "node:path";
import Hero, { type HeroVideoSources } from "@/components/Hero";
import TickerStrip from "@/components/TickerStrip";
import TokenizedStocks from "@/components/TokenizedStocks";
import Rewards from "@/components/Rewards";
import Guarantee from "@/components/Guarantee";
import FeaturedPairs from "@/components/FeaturedPairs";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";

/**
 * Hero video sources are only passed down when the files actually exist in
 * /public/videos — no 404s, no broken <video> requests before the cinematic
 * footage is exported. Drop in wall-street-hero.mp4 (+ optional .webm) and
 * the next build/dev render picks it up automatically.
 */
function getHeroVideo(): HeroVideoSources {
  const dir = join(process.cwd(), "public", "videos");
  const mp4 = existsSync(join(dir, "wall-street-hero.mp4"));
  const webm = existsSync(join(dir, "wall-street-hero.webm"));
  return {
    src: mp4 ? "/videos/wall-street-hero.mp4" : undefined,
    webmSrc: webm ? "/videos/wall-street-hero.webm" : undefined,
    poster: "/videos/wall-street-hero-poster.jpg",
  };
}

export default function Home() {
  return (
    <>
      <Hero video={getHeroVideo()} />
      <TickerStrip />
      <TokenizedStocks />
      <Rewards />
      <Guarantee />
      <FeaturedPairs />
      <FAQ />
      <FinalCTA />
    </>
  );
}
