import {
  clamp01,
  countUpValue,
  easeOutCubic,
  gaugeFraction,
  NEWS2_MAX,
  scalePosition,
  staggerEndMs,
  staggerProgress,
} from './easing';

const steps = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

describe('easeOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('is monotonic and front-loaded (ease-out)', () => {
    const ys = steps(50).map(easeOutCubic);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1]);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('clamps out-of-range input', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(clamp01(-0.1)).toBe(0);
    expect(clamp01(1.1)).toBe(1);
  });
});

describe('countUpValue', () => {
  it.each([0, 1, 3, 5, 7, 20])('counts 0 -> %i in whole, non-decreasing steps and ends exactly on it', (target) => {
    const values = steps(60).map((t) => countUpValue(target, t));
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(target);
    for (let i = 1; i < values.length; i++) {
      expect(Number.isInteger(values[i])).toBe(true);
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      expect(values[i]).toBeLessThanOrEqual(target);
    }
  });

  it('never overshoots, even past t = 1', () => {
    expect(countUpValue(7, 1.5)).toBe(7);
  });
});

describe('gaugeFraction', () => {
  it.each([
    [0, 0],
    [5, 0.25],
    [NEWS2_MAX, 1],
    [25, 1],
    [-1, 0],
  ])('total %i -> %f of the ring', (total, fraction) => {
    expect(gaugeFraction(total)).toBeCloseTo(fraction, 10);
  });
});

describe('scalePosition', () => {
  const third = 1 / 3;

  it('places each total in its threshold segment: 0–4 | 5–6 | 7+', () => {
    for (let total = 0; total <= 4; total++) {
      expect(scalePosition(total)).toBeGreaterThan(0);
      expect(scalePosition(total)).toBeLessThan(third);
    }
    for (const total of [5, 6]) {
      expect(scalePosition(total)).toBeGreaterThan(third);
      expect(scalePosition(total)).toBeLessThan(2 * third);
    }
    for (let total = 7; total <= NEWS2_MAX; total++) {
      expect(scalePosition(total)).toBeGreaterThan(2 * third);
      expect(scalePosition(total)).toBeLessThan(1);
    }
  });

  it('is strictly increasing across 0..20', () => {
    for (let total = 1; total <= NEWS2_MAX; total++) {
      expect(scalePosition(total)).toBeGreaterThan(scalePosition(total - 1));
    }
  });
});

describe('stagger', () => {
  it('ends when the last item has finished entering', () => {
    expect(staggerEndMs(0, 90, 260)).toBe(0);
    expect(staggerEndMs(1, 90, 260)).toBe(260);
    expect(staggerEndMs(4, 90, 260)).toBe(3 * 90 + 260);
  });

  it('starts each item stepMs after the previous one and finishes it after enterMs', () => {
    expect(staggerProgress(0, 0, 90, 260)).toBe(0);
    expect(staggerProgress(130, 0, 90, 260)).toBeCloseTo(0.5);
    expect(staggerProgress(89, 1, 90, 260)).toBe(0); // second item hasn't started
    expect(staggerProgress(90 + 260, 1, 90, 260)).toBe(1);
  });

  it('has every item fully entered at the stagger end (what "skip" jumps to)', () => {
    const count = 6;
    const end = staggerEndMs(count, 90, 260);
    for (let i = 0; i < count; i++) expect(staggerProgress(end, i, 90, 260)).toBe(1);
  });
});
