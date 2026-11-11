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
| `progress` | `RefObject<number>` | Hero walk, `0` at the trailhead and `1` at the Sponsors hand-off. Read every frame. |
| `pointer` | `RefObject<{ x: number; y: number }>` | `-1..1`. The page only smooths this lightly; the camera eases itself. |
| `reducedMotion` | `boolean` optional | Wind and sway stop. Scroll still walks the camera and plays the Sponsors veil. Detected from `prefers-reduced-motion` when omitted. |
| `quality` | `"low" \| "high"` optional | Omit it and `detectQuality()` runs once, before the first frame, including on desktop: narrow viewports, low core or memory counts, and older mobile GPUs use low. `HeroMeadow` omits this prop so a phone does not build the high scene and then rebuild. An explicit value still wins. DPR cap is `1.25` high and `1` low. If frames stay over 18 ms, each mesh keeps about half its instances and the pixel ratio drops to 1. If they stay over 18 ms after that, grass drops to about a quarter, the spark range shortens, and the pixel ratio goes to about 0.85. Counts never hit zero. |
| `onReady` | `() => void` optional | Once, after the first presented frame (or immediately if WebGL is unavailable). |
| `className` | `string` optional | Added on the root. |

The root is `position: absolute; inset: 0` inside whatever parent you give it. It does not use `position: fixed` or a z-index, and the canvas has `pointer-events: none` so the navbar, wordmark, and join button keep the page.

## Light

One sun direction and one horizon colour (`#f4e4b4`) feed the sky, fog, clouds, hills, grass, flowers, and path. Distant things lose saturation and fade into that horizon, so the path has no visible end and the ground does not meet the sky on a hard line. Behind the green hill stand three low-poly ranges (`addRange` in `geometry.ts`): each facet is lit or shaded by its own screen-space normal against the sun, the near range is deep violet and only frosts its tips, and the two back ranges are paler and bluer with snowcaps. From progress `0.7` the fog, hills, and path warm toward a light cream (`#fff6ea`), but the homepage never gets there: `HeroScroll` hands the scene only `0..WALK_END` (`0.2`, see `heroHandoff.ts`), because past about `0.25` the near garden slides under the frame and the meadow reads as bare hills. The hand-off into Sponsors is a page-side band, not the scene: the hero sits above Sponsors and overlaps it by exactly the height of Sponsors' `.dawn`, so that white-to-cream strip never shows, and a honey band rises over the meadow's foot to Sponsors' gold (`#f5cc7c`) on the stage's last row, which is the first colour of its sky and hive wall. The clouds drift slowly right and wrap: each loop is the frame's width at the cloud's depth plus the cloud, so one leaves the right edge before it comes back in on the left, and at time zero every cloud sits where the poster has it. With reduced motion the clouds hold still and the canvas draws on demand; a per-frame check (not a timer) redraws whenever progress moves, and the frame-time trim ignores the idle gap between demand draws. Distant flowers are one points draw. Behind the front beds the lawn is planted out to the edge of a 1920 frame; spots only a wide frame sees carry a tag in their phase (`WIDE_ONLY`, `NOT_PHONE` in `layout.ts`), the shaders drop them on narrower frames so they never pile up on a tablet or phone edge, and the low tier leaves the wide-only ones out. The ground itself carries a grass texture so the far meadow stays a carpet, and on a narrow screen the path tightens so grass stays in frame.

## Preview

`/prototype/meadow` scrolls `progress` and tracks the pointer. `?progress=0.5&bare=1` holds a still of the scene without the stand-in wordmark. The real navbar comes from the root layout; `data-path-scroll` on the demo turns on the same sky blur as the homepage. The route calls `notFound()` when `VERCEL_ENV` or `NODE_ENV` is `production`.
