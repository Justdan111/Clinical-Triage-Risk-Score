import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { TOTAL_FIELDS } from '@/triage/progress';
import { typeStyle, useTheme } from '@/theme/theme';
import { duration, radius, spacing, springs } from '@/theme/tokens';

export type SubmitState = 'incomplete' | 'ready' | 'loading';

interface SubmitButtonProps {
  state: SubmitState;
  filled: number;
  onPress: () => void;
}

const SHIMMER_FRACTION = 0.45;

/**
 * Dimmed until 7 of 7 (still pressable: it then guides to the first empty
 * field). Springs to full colour and scale when ready. While loading, a
 * shimmer sweeps across it instead of a bare spinner.
 */
export function SubmitButton({ state, filled, onPress }: SubmitButtonProps) {
  const { colors, fontsLoaded } = useTheme();
  const reduced = useReducedMotion();
  const ready = useSharedValue(state === 'incomplete' ? 0 : 1);
  const sweep = useSharedValue(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const target = state === 'incomplete' ? 0 : 1;
    ready.value = reduced ? withTiming(target, { duration: duration.fast }) : withSpring(target, springs.snappy);
  }, [state, reduced, ready]);

  useEffect(() => {
    if (state === 'loading' && !reduced) {
      sweep.value = 0;
      sweep.value = withRepeat(withTiming(1, { duration: duration.shimmer, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(sweep);
      sweep.value = 0;
    }
  }, [state, reduced, sweep]);

  const [muted, primary, textMuted, onPrimary] = [colors.surfaceMuted, colors.primary, colors.textMuted, colors.onPrimary];
  const buttonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(ready.value, [0, 1], [muted, primary]),
    transform: [{ scale: 0.96 + 0.04 * ready.value }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ color: interpolateColor(ready.value, [0, 1], [textMuted, onPrimary]) }));
  const shimmerWidth = width * SHIMMER_FRACTION;
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -shimmerWidth + sweep.value * (width + shimmerWidth) }],
  }));

  const label =
    state === 'loading' ? 'Calculating…' : state === 'ready' ? 'Calculate NEWS2' : `Fill all vitals · ${filled} of ${TOTAL_FIELDS}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={state === 'loading'}
      accessibilityRole="button"
      accessibilityLabel={state === 'loading' ? 'Calculating NEWS2 score' : state === 'ready' ? 'Calculate NEWS2 score' : label}
      accessibilityHint={
        state === 'incomplete' ? 'Not all vitals are entered. Moves to the first empty one.' : state === 'ready' ? 'Sends these vitals to the scoring server' : undefined
      }
      accessibilityState={{ busy: state === 'loading', disabled: state === 'loading' }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.button, buttonStyle]}>
        {state === 'loading' && !reduced && width > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.shimmer, { width: shimmerWidth }, shimmerStyle]}>
            <LinearGradient
              colors={[`${onPrimary}00`, `${onPrimary}55`, `${onPrimary}00`]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        <View style={styles.labelWrap}>
          {/* Capped at 1.6×: at the largest sizes an uncapped label takes three lines and a fifth of the screen. */}
          <Animated.Text maxFontSizeMultiplier={1.6} style={[typeStyle('heading', fontsLoaded), styles.label, labelStyle]}>
            {label}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    overflow: 'hidden',
  },
  shimmer: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  labelWrap: { alignItems: 'center' },
  label: { textAlign: 'center' },
});
