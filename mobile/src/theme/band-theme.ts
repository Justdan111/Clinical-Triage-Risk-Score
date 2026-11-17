// Maps a band to everything the result screen needs to present it: colours
// for the current scheme, words, icon, and the haptic rule. Pure, so it can be
// unit tested without rendering.

import type { Band } from '@/api/types';
import { BAND_INFO, type BandIconName } from '@/triage/labels';

import { palettes, type BandColors, type SchemeName } from './tokens';

export type BandHaptic = 'warning' | 'none';

export interface BandTheme extends BandColors {
  band: Band;
  label: string;
  rcpRisk: string;
  icon: BandIconName;
  iconDescription: string;
  /** Warning for red_flagged, medium and high. Never a celebration: low gets none. */
  haptic: BandHaptic;
}

export function bandTheme(band: Band, scheme: SchemeName): BandTheme {
  const info = BAND_INFO[band];
  return {
    band,
    ...palettes[scheme].bands[band],
    label: info.label,
    rcpRisk: info.rcpRisk,
    icon: info.icon,
    iconDescription: info.iconDescription,
    haptic: band === 'low' ? 'none' : 'warning',
  };
}
