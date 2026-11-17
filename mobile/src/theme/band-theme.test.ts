import { BANDS } from '@/api/types';

import { bandTheme } from './band-theme';
import { palettes } from './tokens';

describe('bandTheme', () => {
  it.each(BANDS)('%s uses that band’s colours for the current scheme', (band) => {
    for (const scheme of ['light', 'dark'] as const) {
      const t = bandTheme(band, scheme);
      expect(t.band).toBe(band);
      expect(t.strong).toBe(palettes[scheme].bands[band].strong);
      expect(t.tint).toBe(palettes[scheme].bands[band].tint);
      expect(t.graphic).toBe(palettes[scheme].bands[band].graphic);
    }
  });

  it('gives each band a distinct label, icon and colour, so colour is never the only signal', () => {
    const themes = BANDS.map((b) => bandTheme(b, 'light'));
    expect(new Set(themes.map((t) => t.label)).size).toBe(BANDS.length);
    expect(new Set(themes.map((t) => t.icon)).size).toBe(BANDS.length);
    expect(new Set(themes.map((t) => t.strong)).size).toBe(BANDS.length);
    for (const t of themes) {
      expect(t.label).toBeTruthy();
      expect(t.iconDescription).toBeTruthy();
      expect(t.rcpRisk).toBeTruthy();
    }
  });

  it('has a light and a dark variant for every band', () => {
    for (const band of BANDS) {
      expect(bandTheme(band, 'light').tint).not.toBe(bandTheme(band, 'dark').tint);
    }
  });

  it.each([
    ['low', 'none'],
    ['red_flagged', 'warning'],
    ['medium', 'warning'],
    ['high', 'warning'],
  ] as const)('%s -> %s haptic (a low result is never celebrated)', (band, haptic) => {
    expect(bandTheme(band, 'light').haptic).toBe(haptic);
    expect(bandTheme(band, 'dark').haptic).toBe(haptic);
  });
});
