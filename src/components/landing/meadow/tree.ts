/**
 * Blossoming tree at the end of the path.
 * Nudge these if the title button moves: the crown is meant to sit
 * just behind that button, with the path fading as it climbs the hill.
 */
export const TREE = {
  x: 0.22,
  z: -1.35,
  baseY: 0,
  /** Height of the blossom cloud above the trunk base. */
  canopyY: 0.2,
  canopyRadius: 0.92,
  /** Vertical squash so the crown sits on the button, under the wordmark. */
  canopySquash: 0.34,
} as const;
