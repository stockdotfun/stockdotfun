# StockDotFun — Image Generation Prompts

Image generation was unavailable in the build environment (Runway workspace limit
reached), so the landing page currently uses polished inline CSS/SVG compositions
for every visual. The page is complete without external images.

When image generation becomes available, generate the assets below, drop them into
`public/images/generated/`, and swap them in. Placeholder SVGs with matching
filenames already exist there.

All prompts follow the compliance rules: **no real company logos, no readable
brand marks, tickers as plain text only.**

---

## 1. `hero-phone.jpg` — Hero background (16:9, ≥1920px wide)

> Cinematic close-up photograph of a smartphone lying on a dark graphite desk at
> night, screen glowing with an abstract green candlestick trading chart, soft
> emerald-green rim light reflecting off the matte desk surface, faint
> out-of-focus stock ticker digits reflected in the phone's glass edge, a few
> small holographic coin-like sticker objects scattered near the phone (abstract,
> no logos, no readable text), shallow depth of field, moody premium fintech
> atmosphere, deep blacks, subtle green ambient glow, photorealistic, 85mm lens
> look, high-end product photography.

Intended placement: `components/Hero.tsx`, as a dimmed background layer behind
the grid/glow (opacity ~0.35, masked to fade at edges).

## 2. `stock-pairs.jpg` — Stock-pair visual (16:9)

> Clean premium 3D render composition on a near-black background: small glossy
> pill-shaped coin capsules in emerald green and chrome orbiting around larger
> floating minimal dark-glass rectangular cards, each card showing only simple
> white ticker-style text "TSLA", "AAPL", "NVDA", "HOOD", "SPY" in a clean
> sans-serif font (text only, absolutely no company logos), thin green orbit
> lines connecting capsules to cards, soft studio lighting, subtle grid of faint
> green lines in the background, refined fintech aesthetic, sharp, minimal,
> high-end render.

Intended placement: `components/StockPairingShowcase.tsx`, as a header banner or
side visual next to the section title.

## 3. `creator-rewards.jpg` — Creator rewards visual (16:9)

> Premium abstract 3D visualization of value flow on a dark graphite background:
> a single glowing emerald-green stream of light entering from the left,
> splitting into two elegant branching light channels — one channel flowing
> toward a minimal white glowing disc, the other toward a minimal dark-glass
> rectangular card outlined in green, thin luminous fee-flow lines, small
> floating translucent nodes along the streams, no text, no logos, cinematic
> depth of field, refined fintech infrastructure aesthetic, dark and
> sophisticated, soft shadows, subtle chrome accents.

Intended placement: `components/CreatorRewards.tsx`, behind or beside the fee
split panel.

## 4. `holder-wallet.jpg` — Holder rewards visual (3:4 portrait)

> Photorealistic close-up of a generic smartphone held in a hand in a dim room,
> screen showing a minimal dark-mode crypto wallet interface concept with
> abstract green balance bars, a circular token icon, small green reward badges
> and progress rings, all interface text blurred or abstract (no readable words,
> no real brand, no logos), emerald green UI accents on near-black interface,
> soft cinematic lighting, bokeh city lights in background, premium fintech
> product photography feel.

Intended placement: `components/HolderRewards.tsx`, behind or framing the
wallet-style reward panel.

## 5. `city-grid.jpg` — Footer / brand visual (21:9 or 16:9, wide)

> Dark cinematic wide shot of an abstract futuristic financial city grid at
> night viewed from a low aerial angle: minimalist black skyscraper silhouettes
> made of thin luminous lines, glowing emerald-green light rails running between
> buildings like circuit traces or train lines, faint green candlestick-chart
> shapes rising like distant towers, deep black sky, subtle fog, no text, no
> logos, restrained color palette of black, graphite and emerald green, premium
> fintech infrastructure mood, ultra clean, cinematic composition.

Intended placement: `components/Footer.tsx`, replacing or layered under the
inline `CityGridVisual` SVG skyline.

---

### Palette to keep generations on-brand

- Robinhood green accent: `#00C805`
- Mint highlight: `#7CE896`
- Near-black background: `#070A08`
- Graphite panels: `#0C110E` / `#10150F`
- Ivory surfaces (light sections): `#F4F2EB`
