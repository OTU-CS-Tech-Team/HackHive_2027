export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * walk scales layers outward.
 * wallOpen 1 is parted, 0 is the closed petal wall.
 * hero is the Chapter 1 title block; it fades with the closing wall and stays hidden.
 * chapter fades in behind the closed wall so the parting reveals the next chapter.
 */
export function sceneMotion(progress: number) {
  const p = clamp(progress, 0, 1);
  const walk = smoothstep(clamp(p / 0.62, 0, 1));
  let wallOpen: number;
  if (p < 0.46) wallOpen = 1;
  else if (p < 0.72) wallOpen = 1 - smoothstep((p - 0.46) / 0.26);
  else wallOpen = smoothstep((p - 0.72) / 0.28);
  const hero = p < 0.46 ? 1 : p >= 0.64 ? 0 : 1 - smoothstep((p - 0.46) / 0.18);
  const chapter = p <= 0.72 ? 0 : smoothstep((p - 0.72) / 0.2);
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
