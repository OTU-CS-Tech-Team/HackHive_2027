# Walk the Path — Chapter 1 layers

Painted plates for the Trailhead hero and the petal-wall curtain.
The look-sign-off route is `/prototype/path`. The live homepage does not use these files.

Every plate uses viewBox `0 0 1440 900` and `preserveAspectRatio="xMidYMid slice"`.
Stack back to front. Scale each plate from the center: `scale(1 + speed * walk)`, where `walk` is 0 at the trailhead and 1 after the step forward. Higher speed is nearer, so it moves outward fastest.

## Depth order

| Order | File | Speed | Below 768px | Role |
| ---: | --- | ---: | --- | --- |
| 0 | `ch1/01-sky.svg` | 0.05 | yes | Gradient sky, soft clouds, and the meadow ground |
| 1 | `ch1/02-far-trees.svg` | 0.16 | yes | Distant hills along the horizon |
| 2 | `ch1/03-path.svg` | 0.32 | yes | Dirt path straight up the centre, from the viewer's feet to the horizon |
| 3 | `ch1/04-sign.svg` | 0.46 | yes | Soft mist behind the centred title. The title itself is HTML, not this plate |
| 4 | `ch1/05-mid-flowers.svg` | 0.68 | yes | Dense flower beds on both sides of the path |
| 5 | `ch1/06-near-flowers.svg` | 1.05 | no — hide below 768px | Large soft-focus flowers surrounding the viewer |
| 6 | `ch1/07-foreground-stems.svg` | 1.50 | no — hide below 768px | Closest blurred blooms at the frame |

## Petal wall

| File | Role |
| --- | --- |
| `transition/petal-wall-left.svg` | Left half of the near-flower curtain |
| `transition/petal-wall-right.svg` | Right half of the near-flower curtain |

These sit in front of every chapter plate. Part them on X: left `translateX(-open * 105%)`, right `translateX(open * 105%)`. `open` 1 is fully parted. `open` 0 is the closed wall. The halves overlap through the center so the seam is flowers, not a gap.

## Title

The wooden sign is gone. `HackHive`, `Jan 29–31, 2027`, Join (`/apply`), and Learn more are HTML centred on the prototype, above the plates and under the petal wall.

## Motion

Mid-flower groups use class `hh-nod`. Dew uses class `hh-dew`.
Both animate only for `prefers-reduced-motion: no-preference`, and only when the SVG is inlined. An `<img>` plate stays still. Drifting petals are a prototype overlay, not a depth plate.
