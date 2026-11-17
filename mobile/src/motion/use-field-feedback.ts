import { useEffect, useRef } from 'react';
import {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/theme';
import { duration, springs } from '@/theme/tokens';

/**
 * Card feedback shared by every input card (DESIGN.md §5):
 * - pop (scale 1 → 1.03 → 1) when the field changes from empty to filled
 * - border animates to the error colour while there's an error
 * - one shake per new errorKey (i.e. per submit that returned errors)
 * Reduce Motion: no pop, no shake; the border colour still changes.
 */
export function useFieldFeedback({ filled, error, errorKey }: { filled: boolean; error?: string; errorKey: number }) {
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const errorProgress = useSharedValue(error ? 1 : 0);

  const wasFilled = useRef(filled);
  useEffect(() => {
    if (filled && !wasFilled.current && !reduced) {
      scale.value = withSequence(withSpring(1.03, springs.pop), withSpring(1, springs.pop));
    }
    wasFilled.current = filled;
  }, [filled, reduced, scale]);

  useEffect(() => {
    errorProgress.value = withTiming(error ? 1 : 0, { duration: duration.fast });
  }, [error, errorProgress]);

  const hasError = Boolean(error);
  useEffect(() => {
    if (!hasError || reduced || errorKey === 0) return;
    const leg = 64; // 5 legs ≈ 320 ms
    shakeX.value = withSequence(
      withTiming(-8, { duration: leg }),
      withTiming(8, { duration: leg }),
      withTiming(-6, { duration: leg }),
      withTiming(6, { duration: leg }),
      withTiming(0, { duration: leg }),
    );
    // Shake only for a new errorKey, not when the message text alone changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorKey]);

  const resting = scheme === 'dark' ? colors.border : colors.surface;
  const errorColor = colors.error;
  return useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: scale.value }],
    borderColor: interpolateColor(errorProgress.value, [0, 1], [resting, errorColor]),
  }));
}
