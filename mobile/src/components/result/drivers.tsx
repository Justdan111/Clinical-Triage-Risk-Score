import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import type { Driver } from '@/api/types';
import { easeOutCubic, staggerProgress } from '@/motion/easing';
import { DRIVER_ENTER_MS } from '@/motion/use-reveal';
import type { BandTheme } from '@/theme/band-theme';
import { Txt, useTheme } from '@/theme/theme';
import { radius, reveal, spacing } from '@/theme/tokens';
import { formatDriverValue, parameterLabel } from '@/triage/labels';

import { Card } from '../card';
import { IconBubble } from '../vital-card';
import { iconForParameter } from '../vital-icons';

const STEP = reveal.drivers.stepMs;

/** Small overshoot for the points chip (ease-out-back), as a pure worklet. */
function easeOutBack(t: number): number {
  'worklet';
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

interface DriversProps {
  drivers: Driver[];
  band: BandTheme;
  /** Elapsed ms of the stagger (see useReveal). */
  clock: SharedValue<number>;
}

/** Driver cards, staggered in one by one, each with a points chip. */
export function DriverList({ drivers, band, clock }: DriversProps) {
  if (drivers.length === 0) {
    return (
      <Card>
        <Txt variant="body" color="textMuted">
          No vital sign scored above zero.
        </Txt>
      </Card>
    );
  }
  return (
    <View style={styles.list}>
      {drivers.map((d, i) => (
        <DriverCard key={d.parameter} driver={d} index={i} band={band} clock={clock} />
      ))}
    </View>
  );
}

function DriverCard({ driver, index, band, clock }: { driver: Driver; index: number; band: BandTheme; clock: SharedValue<number> }) {
  const { colors } = useTheme();
  const label = parameterLabel(driver.parameter);
  const value = formatDriverValue(driver.parameter, driver.value);
  const scoredThree = driver.points === 3;

  const cardStyle = useAnimatedStyle(() => {
    const p = staggerProgress(clock.value, index, STEP, DRIVER_ENTER_MS);
    return { opacity: p, transform: [{ translateY: (1 - easeOutCubic(p)) * 12 }] };
  });
  const chipStyle = useAnimatedStyle(() => {
    const p = staggerProgress(clock.value, index, STEP, DRIVER_ENTER_MS);
    return { transform: [{ scale: 0.6 + 0.4 * easeOutBack(p) }] };
  });

  return (
    <Card style={cardStyle}>
      <View
        style={styles.row}
        accessible
        accessibilityLabel={`${label}, ${value}, ${driver.points} ${driver.points === 1 ? 'point' : 'points'}${scoredThree ? ', scored 3 on its own' : ''}`}
      >
        <IconBubble icon={iconForParameter(driver.parameter)} />
        <View style={styles.text}>
          <Txt variant="heading">{label}</Txt>
          <Txt variant="body" color="textMuted" tabular>
            {value}
          </Txt>
        </View>
        <Animated.View
          style={[
            styles.chip,
            { backgroundColor: scoredThree ? band.strong : colors.primaryMuted },
            chipStyle,
          ]}
        >
          <Txt variant="heading" tabular color={scoredThree ? band.onStrong : 'onPrimaryMuted'} maxFontSizeMultiplier={1.5}>
            +{driver.points}
          </Txt>
        </Animated.View>
      </View>
    </Card>
  );
}

/**
 * "How this score was built": one bar segment per driver (width ∝ its
 * points), growing in step with its card, plus the sum written out. All
 * numbers come straight from the server's drivers; nothing is computed here
 * beyond adding them up for the sentence.
 */
export function BuildBars({ drivers, total, band, clock }: DriversProps & { total: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  if (drivers.length === 0) return null;

  const sum = drivers.map((d) => d.points).join(' + ');
  return (
    <Card style={styles.buildCard}>
      <Txt variant="label" color="textMuted">
        How this score was built
      </Txt>
      <View
        style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {width > 0
          ? drivers.map((d, i) => (
              <Segment
                key={d.parameter}
                index={i}
                width={(d.points / total) * width}
                color={band.graphic}
                separator={colors.surface}
                clock={clock}
              />
            ))
          : null}
      </View>
      <Txt variant="body" tabular accessibilityLabel={`${drivers.map((d) => `${parameterLabel(d.parameter)} ${d.points}`).join(', plus ')}, equals ${total}`}>
        {sum} = <Txt variant="heading" tabular>{total}</Txt>
      </Txt>
    </Card>
  );
}

function Segment({ index, width, color, separator, clock }: { index: number; width: number; color: string; separator: string; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    width: width * easeOutCubic(staggerProgress(clock.value, index, STEP, DRIVER_ENTER_MS)),
  }));
  return <Animated.View style={[styles.segment, { backgroundColor: color, borderRightColor: separator }, style]} />;
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
  chip: { minWidth: 52, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  buildCard: { gap: spacing.md },
  track: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden' },
  segment: { height: 14, borderRightWidth: 3 },
});
