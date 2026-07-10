# Hero background video

Drop the generated cinematic Wall Street footage here:

- `wall-street-hero.mp4` — required (H.264, 16:9, ≥8s, loopable, ~1080p,
  aim for < 4–6 MB with two-pass encoding)
- `wall-street-hero.webm` — optional (VP9/AV1, served first when present)
- `wall-street-hero-poster.jpg` — poster/fallback frame. Currently a real
  Wall Street photograph (user-supplied, 1200×800) serving as the hero
  background image; when the video ships, either keep it or replace it with
  the best frame of the final footage for a seamless video hand-off.

The landing page (`app/(marketing)/page.tsx`) checks for these files at
render time — the moment `wall-street-hero.mp4` exists, the hero plays it.
No code changes needed.

## Generation prompt (video model)

> Cinematic dark-finance background video for a website hero section. A Wall
> Street / New York Financial District-inspired sequence at night: tall
> financial buildings, glowing office windows, wet street reflections, subtle
> emerald-green stock-market light, abstract trading screens visible through
> glass, faint silhouettes of builders behind glass (no recognizable faces).
> Mood: dark graphite, black, deep green, subtle white highlights — premium,
> moody, expensive. Camera: very slow push-in, no cuts, no shake. Composition:
> center of frame dark and clean for text overlay; detail at edges and lower
> third. 16:9, ≥8 seconds, loopable, high resolution.
>
> Negative: no text, no logos, no brand names, no readable tickers, no famous
> actors, no movie recreations, no crypto coins, no cartoon memes, no neon
> purple, no blue cyberpunk, no bull statue closeup, no clutter in center,
> no overexposed lights, no watermark.

Note: generation was attempted via the connected Runway workspace in-session
(Seedance unavailable + image quota exhausted) — regenerate when the
workspace has credit, or export from any video tool using the prompt above.

## Poster extraction from the final video

```bash
ffmpeg -i wall-street-hero.mp4 -vf "select=eq(n\,24)" -frames:v 1 -q:v 3 wall-street-hero-poster.jpg
```
