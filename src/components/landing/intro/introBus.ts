/**
 * Shared between the first-load intro (plain DOM) and the meadow scene.
 * The scene reports how far it has got; the intro decides when the camera
 * starts its descent. The phase lives on <html data-intro>, set before
 * first paint by the inline script in IntroLoader:
 *
 *   loading -> wipe -> text -> done     (first visit this session)
 *   lite                                 (later loads: soft fade, copy rises)
 *   skip                                 (reduced motion, deep link)
 *
 * With no attribute at all (no JS) the page renders as if skipped.
 */

export type IntroPhase = "loading" | "wipe" | "text" | "done" | "lite" | "skip";

export const INTRO = {
  /** The loader stays at least this long, so it never flashes. */
  minLoaderMs: 700,
  /** Logo and bar fade before the tiles start to go. */
  logoFadeMs: 250,
  /** The tiles start shrinking this long after the wipe begins. */
  wipeLeadMs: 150,
  /** Each tile shrinks over this; its delay grows with distance from the centre. */
  tileMs: 260,
  /** The farthest tile waits this long. */
  rippleMs: 480,
  /** Camera descent, starting with the tiles. */
  descentMs: 1600,
  /** The copy rises over the last part of the descent. */
  textMs: 500,
  /** If the scene never reports ready, go anyway. */
  failsafeMs: 6000,
  /** A scroll during the descent finishes it over this. */
  rushMs: 320,
} as const;

type State = { progress: number; ready: boolean; descentAt: number; rushAt: number; rushFrom: number };

const state: State = { progress: 0, ready: false, descentAt: -1, rushAt: -1, rushFrom: 0 };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function introPhase(): IntroPhase | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.intro;
  if (value === "loading" || value === "wipe" || value === "text" || value === "done" || value === "lite" || value === "skip") return value;
  return null;
}

export function setIntroPhase(phase: IntroPhase) {
  document.documentElement.dataset.intro = phase;
}

/** True while the intro owns the camera (loading through the end of the descent). */
export function introPlaying() {
  const phase = introPhase();
  return phase === "loading" || phase === "wipe" || phase === "text";
}

export function reportIntroProgress(progress: number) {
  if (state.ready || progress <= state.progress) return;
  state.progress = Math.min(0.99, progress);
  emit();
}

export function reportIntroReady() {
  if (state.ready) return;
  state.ready = true;
  state.progress = 1;
  emit();
}

export function introSnapshot(): Readonly<State> {
  return state;
}

export function subscribeIntro(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startDescent(at: number) {
  if (state.descentAt < 0) state.descentAt = at;
}

function easeOutCubic(t: number) {
  const u = 1 - t;
  return 1 - u * u * u;
}

/**
 * 0 at the start pose (high, above the clouds), 1 at the hero view.
 * Held at 0 while the loader is up; always 1 when the intro is skipped.
 */
export function descentAmount(now: number) {
  const phase = introPhase();
  if (phase !== "loading" && phase !== "wipe" && phase !== "text") return 1;
  if (state.descentAt < 0) return 0;
  const raw = Math.min(1, Math.max(0, (now - state.descentAt) / INTRO.descentMs));
  let k = easeOutCubic(raw);
  if (state.rushAt >= 0) {
    const rushed = Math.min(1, (now - state.rushAt) / INTRO.rushMs);
    k = Math.max(k, state.rushFrom + (1 - state.rushFrom) * easeOutCubic(rushed));
  }
  return k;
}

/** The visitor scrolled mid-descent: land quickly instead of fighting the scroll. */
export function rushDescent(now: number) {
  if (state.rushAt >= 0 || state.descentAt < 0) return;
  state.rushFrom = descentAmount(now);
  state.rushAt = now;
}
