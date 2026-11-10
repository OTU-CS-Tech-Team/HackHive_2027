/**
 * Blossoming tree on the right of the hero text.
 * The mesh is authored at `x`. The shaders add an aspect shift so the
 * crown stays in the right margin at 1280 and 768. On a phone the crown
 * is smaller than the tablet one but still a full tree, inside the frame
 * and clear of the title, date, and button. The path's far end aims at
 * that shifted trunk.
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
} as const;
