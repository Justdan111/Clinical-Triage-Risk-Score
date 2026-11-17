import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Text, useColorScheme, type TextProps, type TextStyle } from 'react-native';

import {
  FONT_FAMILIES,
  FONT_WEIGHTS,
  palettes,
  typeScale,
  type Palette,
  type Hex,
  type SchemeName,
  type TypeRoleName,
} from './tokens';

export interface Theme {
  scheme: SchemeName;
  colors: Palette;
  /** False when Plus Jakarta Sans failed to load: text falls back to the system font. */
  fontsLoaded: boolean;
}

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: palettes.light, fontsLoaded: false });

export function ThemeProvider({ fontsLoaded, children }: { fontsLoaded: boolean; children: ReactNode }) {
  const scheme: SchemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  const value = useMemo(() => ({ scheme, colors: palettes[scheme], fontsLoaded }), [scheme, fontsLoaded]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Text style for a type role. With the custom font, the weight is in the family name. */
export function typeStyle(role: TypeRoleName, fontsLoaded: boolean, tabular = false): TextStyle {
  const r = typeScale[role];
  return {
    fontSize: r.size,
    lineHeight: r.lineHeight,
    ...(fontsLoaded ? { fontFamily: FONT_FAMILIES[r.weight] } : { fontWeight: FONT_WEIGHTS[r.weight] }),
    ...(tabular ? { fontVariant: ['tabular-nums'] } : null),
  };
}

export function maxScaleFor(role: TypeRoleName): number | undefined {
  const r = typeScale[role];
  return 'maxScale' in r ? r.maxScale : undefined;
}

type ColorToken = { [K in keyof Palette]: Palette[K] extends string ? K : never }[keyof Palette];

interface TxtProps extends TextProps {
  /** Type-scale role (named `variant` because `role` is React Native's ARIA prop). */
  variant?: TypeRoleName;
  /** A palette token, or a raw colour (band colours come from bandTheme). */
  color?: ColorToken | Hex;
  tabular?: boolean;
}

/** Text with the design-system type scale, theme colour and the role's scale cap. */
export function Txt({ variant = 'body', color = 'text', tabular = false, style, ...rest }: TxtProps) {
  const { colors, fontsLoaded } = useTheme();
  const resolved = color.startsWith('#') ? color : colors[color as ColorToken];
  return (
    <Text
      maxFontSizeMultiplier={maxScaleFor(variant)}
      {...rest}
      style={[typeStyle(variant, fontsLoaded, tabular), { color: resolved }, style]}
    />
  );
}
