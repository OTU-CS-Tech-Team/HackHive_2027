import { LAYER_SLOTS, type LayerSlot } from "@/components/path/types";

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

/** End scale for a layer. Nearer depths travel farther. */
export function zoomScale(depth: number, mobile: boolean) {
  const travel = mobile ? 1.35 : 2.05;
  return 1 + depth * travel;
}

/**
 * Static blur in pixels. Far planes stay sharp; close planes soften.
 * Mobile keeps a single soft edge on the nearest slot.
 */
export function blurPx(depth: number, mobile: boolean) {
  if (mobile) return depth >= 0.9 ? 0.6 : 0;
  if (depth < 0.35) return 0;
  if (depth < 0.6) return 0.4;
  if (depth < 0.85) return 1.1;
  return 2.2;
}

export function slotRank(slot: LayerSlot) {
  switch (slot) {
    case "sky":
      return 0;
    case "far":
      return 1;
    case "mid":
      return 2;
    case "near":
      return 3;
    case "foreground":
      return 4;
    default:
      return assertNever(slot);
  }
}

export function slotsInOrder() {
  return LAYER_SLOTS;
}
