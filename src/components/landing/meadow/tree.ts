/**
 * Blossoming tree on the right of the hero text, at the end of the path.
 * The mesh is authored at `x`. The shaders add an aspect shift so the
 * crown stays in the right margin at 1280 and 768. On a phone the whole
 * tree is scaled evenly (phoneScale) and stays on the far hill where the
 * path ends, to the right of the join button. phoneSlide is shader-only,
 * so the layout anchor stays put. The phone path aims at that trunk.
 */
export const TREE = {
  x: 0.85,
  z: 1.15,
  baseY: 0,
  /** Height of the blossom cloud above the trunk base. */
  canopyY: 1.02,
  canopyRadius: 0.64,
  /** Round crown. A squash below 1 flattens the blossom into a strip. */
  canopySquash: 0.96,
  /** Extra world-x added on a wide frame (1280), a tablet (768), and a phone. */
  shiftWide: 1.74,
  shiftMid: 0.46,
  shiftPhone: -0.05,
  /** Phone-only world-x added in the shaders, on top of shiftPhone. */
  phoneSlide: -0.08,
  /** Phone-only step toward the camera. Zero keeps the tree where the path ends. */
  phoneReach: 0,
  /**
   * Even phone scale about the trunk base. The phone camera (fov 46,
   * aspect about 0.46, eye 1.84) sees about 0.6 world units of grass right
   * of the join button at the path's end. Just under half the authored tree
   * puts a crown about 110 px wide there at 390 px, clear of the copy.
   */
  phoneScale: 0.48,
} as const;

export type LimbPoint = { x: number; y: number; z: number; r: number };

/**
 * Trunk and limbs, local to the trunk base. Every limb runs up into the
 * blossom cloud, so no bare stub ends under it. The bark mesh and the
 * hanging blossoms both read this, so the clusters sit on the limbs.
 */
export const TREE_TRUNK: LimbPoint[] = [
  { x: 0, y: 0.006, z: 0, r: 0.156 },
  { x: 0.006, y: 0.06, z: 0.006, r: 0.108 },
  { x: 0.018, y: 0.19, z: 0.006, r: 0.078 },
  { x: 0.024, y: 0.35, z: 0, r: 0.06 },
  { x: 0.012, y: 0.52, z: -0.006, r: 0.045 },
  { x: 0, y: 0.7, z: 0.006, r: 0.034 },
  { x: -0.02, y: 0.9, z: 0, r: 0.024 },
  { x: -0.04, y: 1.1, z: 0, r: 0.015 },
  { x: -0.05, y: 1.28, z: 0.01, r: 0.008 },
];

export const TREE_LIMBS: LimbPoint[][] = [
  // Left
  [
    { x: 0.01, y: 0.42, z: 0.004, r: 0.036 },
    { x: -0.12, y: 0.6, z: 0.04, r: 0.027 },
    { x: -0.27, y: 0.78, z: 0.07, r: 0.019 },
    { x: -0.4, y: 0.93, z: 0.08, r: 0.012 },
    { x: -0.48, y: 1.06, z: 0.07, r: 0.007 },
  ],
  // Right
  [
    { x: 0.02, y: 0.4, z: 0, r: 0.035 },
    { x: 0.15, y: 0.58, z: -0.03, r: 0.026 },
    { x: 0.3, y: 0.76, z: -0.05, r: 0.019 },
    { x: 0.42, y: 0.91, z: -0.05, r: 0.012 },
    { x: 0.5, y: 1.04, z: -0.04, r: 0.007 },
  ],
  // Front, toward the path
  [
    { x: 0.01, y: 0.48, z: 0.01, r: 0.03 },
    { x: -0.03, y: 0.66, z: 0.12, r: 0.021 },
    { x: -0.07, y: 0.84, z: 0.26, r: 0.015 },
    { x: -0.09, y: 1.0, z: 0.36, r: 0.009 },
  ],
  // Back
  [
    { x: 0.02, y: 0.46, z: 0, r: 0.028 },
    { x: 0.06, y: 0.66, z: -0.12, r: 0.02 },
    { x: 0.08, y: 0.86, z: -0.26, r: 0.014 },
    { x: 0.08, y: 1.02, z: -0.34, r: 0.008 },
  ],
  // Right and forward
  [
    { x: 0.015, y: 0.56, z: 0.005, r: 0.026 },
    { x: 0.13, y: 0.72, z: 0.1, r: 0.018 },
    { x: 0.25, y: 0.88, z: 0.2, r: 0.012 },
    { x: 0.33, y: 1.02, z: 0.26, r: 0.008 },
  ],
  // Left and high
  [
    { x: 0, y: 0.72, z: 0.004, r: 0.024 },
    { x: -0.14, y: 0.88, z: -0.04, r: 0.017 },
    { x: -0.26, y: 1.02, z: -0.02, r: 0.011 },
    { x: -0.34, y: 1.16, z: 0.02, r: 0.007 },
  ],
];
