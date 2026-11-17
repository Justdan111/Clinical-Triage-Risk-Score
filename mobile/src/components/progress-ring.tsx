import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { progressAnnouncement, TOTAL_FIELDS } from '@/triage/progress';
import { Txt, useTheme } from '@/theme/theme';
import { duration, springs } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 64;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** "x of 7" ring. The arc springs to the new fraction on the UI thread. */
export function ProgressRing({ count }: { count: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(count / TOTAL_FIELDS);

  useEffect(() => {
    const target = count / TOTAL_FIELDS;
    progress.value = reduced ? withTiming(target, { duration: duration.fast }) : withSpring(target, springs.gentle);
  }, [count, reduced, progress]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress.value))),
  }));

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={progressAnnouncement(count)}
      accessibilityValue={{ min: 0, max: TOTAL_FIELDS, now: count }}
    >
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.surfaceMuted} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={colors.primary}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          animatedProps={arcProps}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Txt variant="heading" tabular maxFontSizeMultiplier={1.2}>
            {count}
            <Txt variant="caption" color="textMuted" maxFontSizeMultiplier={1.2}>
              /{TOTAL_FIELDS}
            </Txt>
          </Txt>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
