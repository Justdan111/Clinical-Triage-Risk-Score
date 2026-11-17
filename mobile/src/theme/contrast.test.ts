import { BANDS } from '@/api/types';

import { contrastRatio } from './contrast';
import { palettes, TEXT_PAIRS, type SchemeName } from './tokens';

const SCHEMES: SchemeName[] = ['light', 'dark'];
const TEXT_MIN = 4.5; // WCAG AA, normal text
const GRAPHIC_MIN = 3; // WCAG AA, non-text (rings, markers, bars)

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2); // the classic AA grey
  });
});

describe.each(SCHEMES)('%s theme', (scheme) => {
  const p = palettes[scheme];

  it.each(TEXT_PAIRS.map(([fg, bg]) => [fg, bg] as const))('%s on %s meets 4.5:1', (fg, bg) => {
    expect(contrastRatio(p[fg] as string, p[bg] as string)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  describe.each(BANDS)('%s band', (band) => {
    const c = p.bands[band];

    it.each([
      ['onStrong on strong', c.onStrong, c.strong],
      ['onTint on tint', c.onTint, c.tint],
      ['text on tint', p.text, c.tint],
      ['textMuted on tint', p.textMuted, c.tint],
      ['text on surface (driver cards on a tinted screen)', p.text, p.surface],
    ])('%s meets 4.5:1', (_name, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it.each([
      ['graphic on tint', c.graphic, c.tint],
      ['graphic on surface', c.graphic, p.surface],
      ['graphic on bg', c.graphic, p.bg],
    ])('%s meets 3:1 (non-text)', (_name, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(GRAPHIC_MIN);
    });
  });
});

describe('the two themes', () => {
  it('define exactly the same tokens', () => {
    expect(Object.keys(palettes.dark).sort()).toEqual(Object.keys(palettes.light).sort());
    for (const band of BANDS) {
      expect(Object.keys(palettes.dark.bands[band]).sort()).toEqual(Object.keys(palettes.light.bands[band]).sort());
    }
  });

  it('use only #RRGGBB colours (the contrast maths assumes it)', () => {
    for (const scheme of SCHEMES) {
      const p = palettes[scheme];
      const values = [
        ...Object.values(p).filter((v): v is string => typeof v === 'string'),
        ...BANDS.flatMap((b) => Object.values(p.bands[b])),
      ];
      for (const v of values) expect(v).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
