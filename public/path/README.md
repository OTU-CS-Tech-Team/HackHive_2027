# Walk the Path — Chapter 1 layers

Painted plates for the Trailhead hero and the petal-wall curtain.
The look-sign-off route is `/prototype/path`. The live homepage does not use these files.

Every plate uses viewBox `0 0 1440 900` and `preserveAspectRatio="xMidYMid slice"`.
Stack back to front. Scale each plate from the horizon: `scale(1 + speed * walk)` with origin `50% 49.8%`, where `walk` is 0 at the trailhead and 1 after the step forward. Higher speed is nearer, so it moves outward fastest. Path and mid-flower speeds are high so the step reads as walking into the flowers.

## Depth order

| Order | File | Speed | Below 768px | Role |
| ---: | --- | ---: | --- | --- |
| 0 | `ch1/01-sky.svg` | 0.08 | yes | Gradient sky, soft clouds, and the meadow ground |
| 1 | `ch1/02-hills.svg` | 0.34 | yes | Distant hills along the horizon |
| 2 | `ch1/03-path.svg` | 1.45 | yes | Dirt path straight up the centre, from the viewer's feet to the horizon |
| 3 | `ch1/04-mist.svg` | 0.62 | yes | Soft mist behind the centred title. The title itself is HTML, not this plate |
| 4 | `ch1/05-mid-flowers.svg` | 2.25 | yes | Dense flower beds on both sides of the path |
| 5 | `ch1/06-near-flowers.svg` | 3.15 | no — hide below 768px | Large soft-focus flowers surrounding the viewer |
| 6 | `ch1/07-foreground-stems.svg` | 4.10 | no — hide below 768px | Closest blurred blooms at the frame |

## Petal wall

| File | Role |
| --- | --- |
| `transition/petal-wall-left.svg` | Left half of the near-flower curtain |
| `transition/petal-wall-right.svg` | Right half of the near-flower curtain |

These sit in front of every chapter plate. Part them on X: left `translateX(-open * 105%)`, right `translateX(open * 105%)`. `open` 1 is fully parted. `open` 0 is the closed wall. The halves overlap through the center so the seam is flowers, not a gap. The curtain is soft: blurred depth bands, uneven clusters, and a gradient tint, in the same language as the near flowers. The prototype mounts these two images only after scroll passes about 0.35, so they are not part of the first paint.

The wall closes over the approach, then parts onto a prototype-only Chapter 2 placeholder. That placeholder is HTML, not a depth plate. The centred Chapter 1 title fades with the closing wall and stays hidden.

## Title

The wooden sign is gone. `HackHive`, `Jan 29–31, 2027`, and Join (`/apply`) are HTML centred on the prototype, above the plates and under the petal wall. Learn more links to `/#faq`.

## Motion

Mid-flower groups use class `hh-nod`. Dew uses class `hh-dew`.
Both animate only for `prefers-reduced-motion: no-preference`, and only when the SVG is inlined. An `<img>` plate stays still. Drifting petals are a prototype overlay, not a depth plate.
