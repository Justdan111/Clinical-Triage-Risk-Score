import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { countUpValue, easeOutCubic, gaugeFraction, NEWS2_MAX } from '@/motion/easing';
import type { BandTheme } from '@/theme/band-theme';
import { Txt } from '@/theme/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 172;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

interface GaugeRingProps {
  total: number;
  band: BandTheme;
  /** Linear 0..1 clock; arc and number both apply easeOutCubic, so they stay in step. */
  progress: SharedValue<number>;
}

/**
 * Ring gauge of the NEWS2 total out of 20. The arc animates on the UI thread;
 * the number only re-renders when its integer value changes (≤ total + 1 times).
 * Decorative for screen readers: the hero's label carries the total.
 */
export function GaugeRing({ total, band, progress }: GaugeRingProps) {
  const [shown, setShown] = useState(() => countUpValue(total, progress.value));

  useAnimatedReaction(
    () => countUpValue(total, progress.value),
    (n, prev) => {
      if (n !== prev) scheduleOnRN(setShown, n);
    },
  );

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - gaugeFraction(total) * easeOutCubic(progress.value)),
  }));

  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={band.graphic} strokeOpacity={0.18} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={band.graphic}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${C} ${C}`}
          animatedProps={arcProps}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <Txt variant="label" color={band.onTint} maxFontSizeMultiplier={1.3}>
          NEWS2
        </Txt>
        <Txt variant="scoreXL" tabular color={band.onTint}>
          {shown}
        </Txt>
        <Txt variant="caption" color={band.onTint} maxFontSizeMultiplier={1.3}>
          of {NEWS2_MAX}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
