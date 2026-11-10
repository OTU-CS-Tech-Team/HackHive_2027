/**
 * Blossoming tree on a rise to the right of the hero text.
 * The mesh is authored at `x`. The shaders add an aspect shift so the
 * crown stays in the right margin at 1280 and 768, and peeks from the
 * right edge on a phone. The path's far end aims at that shifted trunk.
 */
export const TREE = {
  x: 0.85,
  z: 1.15,
  baseY: 0,
  /** Height of the blossom cloud above the trunk base. */
  canopyY: 1.06,
  canopyRadius: 0.66,
  /** Round crown. The old 0.34 squash flattened it into a pink strip. */
  canopySquash: 0.8,
  /** Extra world-x added on a wide frame (1280), a tablet (768), and a phone. */
  shiftWide: 1.62,
  shiftMid: 0.74,
  shiftPhone: 0.62,
} as const;
