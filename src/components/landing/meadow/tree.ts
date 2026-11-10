/**
 * Blossoming tree on the right of the hero text.
 * The mesh is authored at `x`. The shaders add an aspect shift so the
 * crown stays in the right margin at 1280 and 768. On a phone the whole
 * crown, trunk included, sits inside the frame to the right of the title,
 * date, and button. The path's far end aims at that shifted trunk.
 */
export const TREE = {
  x: 0.85,
  z: 1.15,
  baseY: 0,
  /** Height of the blossom cloud above the trunk base. */
  canopyY: 1.2,
  canopyRadius: 0.8,
  /** Round crown. The old 0.34 squash flattened it into a pink strip. */
  canopySquash: 0.94,
  /** Extra world-x added on a wide frame (1280), a tablet (768), and a phone. */
  shiftWide: 1.74,
  shiftMid: 0.46,
  shiftPhone: -0.05,
} as const;
