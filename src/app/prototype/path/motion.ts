export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Shared with the homepage timeline so the approved walk does not drift. */
export const TRAIL_MOTION = {
  mountAt: 0.35,
  walkEnd: 0.62,
  closeStart: 0.46,
  closeEnd: 0.72,
  heroEnd: 0.64,
  chapterSpan: 0.2,
  partSpan: 0.28,
  partPercent: 105,
} as const;

/**
 * walk scales layers outward.
 * wallOpen 1 is parted, 0 is the closed petal wall.
 * hero is the Chapter 1 title block; it fades with the closing wall and stays hidden.
 * chapter fades in behind the closed wall so the parting reveals the next chapter.
 */
export function sceneMotion(progress: number) {
  const p = clamp(progress, 0, 1);
  const closeSpan = TRAIL_MOTION.closeEnd - TRAIL_MOTION.closeStart;
  const heroSpan = TRAIL_MOTION.heroEnd - TRAIL_MOTION.closeStart;
  const walk = smoothstep(clamp(p / TRAIL_MOTION.walkEnd, 0, 1));
  let wallOpen: number;
  if (p < TRAIL_MOTION.closeStart) wallOpen = 1;
  else if (p < TRAIL_MOTION.closeEnd) wallOpen = 1 - smoothstep((p - TRAIL_MOTION.closeStart) / closeSpan);
  else wallOpen = smoothstep((p - TRAIL_MOTION.closeEnd) / TRAIL_MOTION.partSpan);
  const hero =
    p < TRAIL_MOTION.closeStart
      ? 1
      : p >= TRAIL_MOTION.heroEnd
        ? 0
        : 1 - smoothstep((p - TRAIL_MOTION.closeStart) / heroSpan);
  const chapter = p <= TRAIL_MOTION.closeEnd ? 0 : smoothstep((p - TRAIL_MOTION.closeEnd) / TRAIL_MOTION.chapterSpan);
  return { walk, wallOpen, hero, chapter };
}

export function placeRect(
  rect: { x: number; y: number; w: number; h: number },
  stageW: number,
  stageH: number,
  viewW: number,
  viewH: number,
) {
  const scale = Math.max(stageW / viewW, stageH / viewH);
  const offsetX = (viewW * scale - stageW) / 2;
  const offsetY = (viewH * scale - stageH) / 2;
  return {
    left: rect.x * scale - offsetX,
    top: rect.y * scale - offsetY,
    width: rect.w * scale,
    height: rect.h * scale,
  };
}
