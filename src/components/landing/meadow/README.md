# Meadow scene

Real-time hero meadow for chapter 1. `MeadowScene` is the only module Tabish mounts.
The homepage already loads it from `HeroMeadow` with `next/dynamic` and `ssr: false`,
behind `/path/poster.webp`. Do not render it on the server.

```tsx
const MeadowScene = dynamic(() => import("@/components/landing/MeadowScene"), {
  ssr: false,
});
```

## Props

| Prop | Type | Role |
| --- | --- | --- |
| `progress` | `RefObject<number>` | Hero walk, `0` at the trailhead and `1` at the chapter 2 hand-off. Read every frame. |
| `pointer` | `RefObject<{ x: number; y: number }>` | `-1..1`. The page only smooths this lightly; the camera eases itself. |
| `reducedMotion` | `boolean` optional | One static frame, no wind. Detected from `prefers-reduced-motion` when omitted. |
| `quality` | `"low" \| "high"` optional | Instance counts and DPR cap (`1.5` high, `1.1` low). Phones and weak GPUs default to low. A sustained slow frame rate drops counts further. |
| `onReady` | `() => void` optional | Once, after the first presented frame (or immediately if WebGL is unavailable). |
| `className` | `string` optional | Added on the root. |

The root is `position: absolute; inset: 0` inside whatever parent you give it. It does not use `position: fixed` or a z-index, and the canvas has `pointer-events: none` so the navbar, wordmark, and join button keep the page.

## Light

One sun direction and one horizon colour (`#f4e4b4`) feed the sky, fog, clouds, hills, grass, flowers, and path. Distant things lose saturation and fade into that horizon, so the path has no visible end and the ground does not meet the sky on a hard line. Near the end of `progress` the frame veils a little further into the same haze.

## Preview

`/prototype/meadow` scrolls `progress` and tracks the pointer. `?progress=0.5&bare=1` holds a still of the scene without the stand-in wordmark. The real navbar comes from the root layout; `data-path-scroll` on the demo turns on the same sky blur as the homepage.
