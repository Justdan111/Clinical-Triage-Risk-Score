// Design tokens. The single source of truth for colour, type, spacing, radius,
// elevation and motion (see DESIGN.md). Components reference token names only.

import type { Band } from '@/api/types';

export type SchemeName = 'light' | 'dark';

/** A #RRGGBB colour. */
export type Hex = `#${string}`;

export interface BandColors {
  strong: Hex;
  onStrong: Hex;
  tint: Hex;
  onTint: Hex;
  /** Strokes and markers (gauge ring, scale marker, bars): ≥ 3:1 on tint and surface. */
  graphic: Hex;
}

export interface Palette {
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  onPrimary: string;
  primaryMuted: string;
  onPrimaryMuted: string;
  error: string;
  errorSurface: string;
  onErrorSurface: string;
  warnSurface: string;
  onWarnSurface: string;
  shadow: string;
  bands: Record<Band, BandColors>;
}

export const palettes: Record<SchemeName, Palette> = {
  light: {
    bg: '#F3F5F8',
    surface: '#FFFFFF',
    surfaceMuted: '#EBEFF4',
    border: '#DCE2EA',
    text: '#101828',
    textMuted: '#475467',
    textSubtle: '#5F6B7A',
    primary: '#2346C8',
    onPrimary: '#FFFFFF',
    primaryMuted: '#E6ECFD',
    onPrimaryMuted: '#1A3699',
    error: '#B42318',
    errorSurface: '#FEF0EE',
    onErrorSurface: '#8F1A12',
    warnSurface: '#FFF4DB',
    onWarnSurface: '#5B3A00',
    shadow: '#101828',
    bands: {
      low: { strong: '#13784A', onStrong: '#FFFFFF', tint: '#E6F5EC', onTint: '#0B4A2D', graphic: '#13784A' },
      red_flagged: { strong: '#F5C53D', onStrong: '#2A1E00', tint: '#FFF6DA', onTint: '#5C4300', graphic: '#A07000' },
      medium: { strong: '#F59A3E', onStrong: '#2B1500', tint: '#FFEEDD', onTint: '#7A3A00', graphic: '#B35400' },
      high: { strong: '#C42B2B', onStrong: '#FFFFFF', tint: '#FDE8E8', onTint: '#8A1414', graphic: '#C42B2B' },
    },
  },
  dark: {
    bg: '#0B1017',
    surface: '#141B24',
    surfaceMuted: '#1C2530',
    border: '#26313E',
    text: '#F2F5F9',
    textMuted: '#B3BECB',
    textSubtle: '#9AA6B4',
    primary: '#8AA8FF',
    onPrimary: '#0B1017',
    primaryMuted: '#1C2A4D',
    onPrimaryMuted: '#C9D6FF',
    error: '#FF8B7E',
    errorSurface: '#3A1512',
    onErrorSurface: '#FFD3CD',
    warnSurface: '#2E2410',
    onWarnSurface: '#FFD98A',
    shadow: '#000000',
    bands: {
      low: { strong: '#45D08A', onStrong: '#04210F', tint: '#0F2A1E', onTint: '#B9F0D1', graphic: '#45D08A' },
      red_flagged: { strong: '#F7CF55', onStrong: '#231900', tint: '#2C250C', onTint: '#FBE6A2', graphic: '#F7CF55' },
      medium: { strong: '#FFA556', onStrong: '#251200', tint: '#2F1E0E', onTint: '#FFD2A8', graphic: '#FFA556' },
      high: { strong: '#FF6B6B', onStrong: '#1F0505', tint: '#331414', onTint: '#FFC9C9', graphic: '#FF6B6B' },
    },
  },
};

/** Every text/background pair the UI uses. The contrast test checks each one in both themes. */
export const TEXT_PAIRS: readonly [keyof Palette, keyof Palette][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surfaceMuted'],
  ['textMuted', 'bg'],
  ['textMuted', 'surface'],
  ['textMuted', 'surfaceMuted'],
  ['textSubtle', 'bg'],
  ['textSubtle', 'surface'],
  ['textSubtle', 'surfaceMuted'],
  ['onPrimary', 'primary'],
  ['onPrimaryMuted', 'primaryMuted'],
  ['primary', 'surface'],
  ['primary', 'bg'],
  ['error', 'surface'],
  ['error', 'bg'],
  ['onErrorSurface', 'errorSurface'],
  ['onWarnSurface', 'warnSurface'],
];

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40 } as const;

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, '2xl': 28, pill: 999 } as const;

/** Minimum touch target (pt). */
export const TOUCH_TARGET = 44;

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

/** Plus Jakarta Sans family name per weight (as registered by useFonts). */
export const FONT_FAMILIES: Record<FontWeightName, string> = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

/** Numeric weight used when falling back to the system font. */
export const FONT_WEIGHTS: Record<FontWeightName, '400' | '500' | '600' | '700' | '800'> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export interface TypeRole {
  size: number;
  lineHeight: number;
  weight: FontWeightName;
  /** Max text-scale multiplier, if capped (see DESIGN.md §3). */
  maxScale?: number;
}

export const typeScale = {
  scoreXL: { size: 56, lineHeight: 60, weight: 'extrabold', maxScale: 1.3 },
  bandLabel: { size: 36, lineHeight: 42, weight: 'extrabold', maxScale: 1.5 },
  numericInput: { size: 32, lineHeight: 38, weight: 'bold' },
  title: { size: 24, lineHeight: 30, weight: 'bold' },
  heading: { size: 18, lineHeight: 24, weight: 'semibold' },
  body: { size: 16, lineHeight: 22, weight: 'medium' },
  label: { size: 14, lineHeight: 18, weight: 'semibold' },
  caption: { size: 13, lineHeight: 18, weight: 'medium' },
} as const satisfies Record<string, TypeRole>;

export type TypeRoleName = keyof typeof typeScale;

/** Durations in ms (DESIGN.md §5). */
export const duration = { instant: 100, fast: 160, base: 240, slow: 400, countUp: 900, shimmer: 1200 } as const;

/** withSpring configs (DESIGN.md §5). */
export const springs = {
  snappy: { damping: 18, stiffness: 260, mass: 1 },
  gentle: { damping: 20, stiffness: 140, mass: 1 },
  pop: { damping: 9, stiffness: 320, mass: 0.8 },
  label: { damping: 14, stiffness: 180, mass: 1 },
} as const;

/** Result reveal timeline in ms from mount (DESIGN.md §5, approved order). */
export const reveal = {
  tint: { at: 0, ms: 400 },
  label: { at: 0 },
  labelLands: 350,
  gauge: { at: 450, ms: 900 },
  marker: { at: 1400 },
  drivers: { at: 1550, stepMs: 90 },
} as const;
