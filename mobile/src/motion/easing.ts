// Pure motion maths. Marked as worklets so the same functions run on the UI
// thread (inside animated styles/props) and in Jest (where the directive is
// just an unused string).

/** NEWS2 Scale 1 maximum aggregate: 3+3+2+3+3+3+3. */
export const NEWS2_MAX = 20;

export function clamp01(x: number): number {
  'worklet';
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Ease-out cubic: fast start, gentle stop. Matches Easing.out(Easing.cubic). */
export function easeOutCubic(t: number): number {
  'worklet';
  const p = 1 - clamp01(t);
  return 1 - p * p * p;
}

/**
 * The number shown during the count-up at linear progress t (0..1). Uses the
 * same curve as the gauge fill so number and arc stay in step. Always an
 * integer between 0 and target, and exactly target when t >= 1.
 */
export function countUpValue(target: number, t: number): number {
  'worklet';
  if (t >= 1) return target;
  return Math.min(target, Math.max(0, Math.round(target * easeOutCubic(t))));
}

/** Fraction of the gauge ring filled for a total (0..1). */
export function gaugeFraction(total: number): number {
  'worklet';
  return clamp01(total / NEWS2_MAX);
}

/**
 * Marker position (0..1) on the threshold scale bar, which has three
 * equal-width segments: 0–4 | 5–6 | 7+. Within a segment the marker sits at
 * the value's position, offset by half a step so 0 isn't on the very edge.
 */
export function scalePosition(total: number): number {
  'worklet';
  const third = 1 / 3;
  if (total <= 4) return third * ((Math.max(0, total) + 0.5) / 5);
  if (total <= 6) return third + third * ((total - 5 + 0.5) / 2);
  return 2 * third + third * ((Math.min(total, NEWS2_MAX) - 7 + 0.5) / (NEWS2_MAX - 7 + 1));
}

/** Total length (ms) of a stagger of `count` items, each `enterMs` long, started `stepMs` apart. */
export function staggerEndMs(count: number, stepMs: number, enterMs: number): number {
  'worklet';
  return count <= 0 ? 0 : (count - 1) * stepMs + enterMs;
}

/** Entrance progress (0..1) of item `index` at `elapsedMs` into the stagger. */
export function staggerProgress(elapsedMs: number, index: number, stepMs: number, enterMs: number): number {
  'worklet';
  return clamp01((elapsedMs - index * stepMs) / enterMs);
}
