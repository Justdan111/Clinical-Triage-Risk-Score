import type { ReactNode } from 'react';
import { Platform, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme';
import { radius, spacing } from '@/theme/tokens';

type Elevation = 'e0' | 'e1' | 'e2';

interface CardProps {
  children: ReactNode;
  elevation?: Elevation;
  style?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  radiusSize?: keyof typeof radius;
  onLayout?: (e: LayoutChangeEvent) => void;
}

/**
 * A surface card. Light theme: soft shadow. Dark theme: shadows don't read on
 * dark backgrounds, so a 1 px border separates the card instead (DESIGN.md §4).
 */
export function Card({ children, elevation = 'e1', style, radiusSize = 'lg', onLayout }: CardProps) {
  const { colors, scheme } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius[radiusSize],
    padding: spacing.xl,
  };
  const depth: ViewStyle =
    elevation === 'e0'
      ? {}
      : scheme === 'dark'
        ? { borderWidth: 1, borderColor: colors.border }
        : Platform.select<ViewStyle>({
            ios: {
              shadowColor: colors.shadow,
              shadowOpacity: elevation === 'e2' ? 0.1 : 0.06,
              shadowRadius: elevation === 'e2' ? 24 : 16,
              shadowOffset: { width: 0, height: elevation === 'e2' ? 10 : 6 },
            },
            default: { elevation: elevation === 'e2' ? 6 : 2 },
          });
  return (
    <Animated.View onLayout={onLayout} style={[base, depth, style]}>
      {children}
    </Animated.View>
  );
}
