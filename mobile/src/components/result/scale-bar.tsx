import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import type { Band } from '@/api/types';
import { scalePosition } from '@/motion/easing';
import { bandTheme, type BandTheme } from '@/theme/band-theme';
import { Txt, useTheme } from '@/theme/theme';
import { radius, spacing } from '@/theme/tokens';

import { Card } from '../card';
import { Icon } from '../icons';

const SEGMENTS: { band: Band; range: string; name: string }[] = [
  { band: 'low', range: '0–4', name: 'Low' },
  { band: 'medium', range: '5–6', name: 'Medium' },
  { band: 'high', range: '7+', name: 'High' },
];

const MARKER = 34;

interface ScaleBarProps {
  total: number;
  band: BandTheme;
  /** 0 → 1 (spring): marker travels from the left edge to the total's position. */
  progress: SharedValue<number>;
  /** For red_flagged: the parameter that scored 3, already a readable label. */
  redFlagParameter?: string;
}

/** The three NEWS2 thresholds with a marker at the total. Segments carry text, not just colour. */
export function ScaleBar({ total, band, progress, redFlagParameter }: ScaleBarProps) {
  const { scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const target = scalePosition(total) * width;

  const markerStyle = useAnimatedStyle(() => ({
    // Hidden until it starts moving, so it never shows the total parked at 0.
    opacity: Math.min(1, progress.value * 4),
    transform: [{ translateX: Math.min(Math.max(0, progress.value * target - MARKER / 2), Math.max(0, width - MARKER)) }],
  }));

  const summary =
    `Thresholds: 0 to 4 low, 5 to 6 medium, 7 or more high. This total, ${total}, is in the ` +
    (total >= 7 ? 'high' : total >= 5 ? 'medium' : 'low') +
    ' range' +
    (redFlagParameter ? `, and ${redFlagParameter} scored 3 on its own.` : '.');

  return (
    <Card style={styles.card} elevation="e1">
      <View accessible accessibilityLabel={summary}>
        <Txt variant="label" color="textMuted" style={styles.title}>
          Where this total falls
        </Txt>
        <View style={styles.markerTrack} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? (
            <Animated.View style={[styles.marker, { backgroundColor: band.strong }, markerStyle]}>
              <Txt variant="label" tabular color={band.onStrong} maxFontSizeMultiplier={1.2}>
                {total}
              </Txt>
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.bar}>
          {SEGMENTS.map((s) => (
            <View key={s.band} style={[styles.segment, { backgroundColor: bandTheme(s.band, scheme).graphic }]} />
          ))}
        </View>
        <View style={styles.legend}>
          {SEGMENTS.map((s) => (
            <View key={s.band} style={styles.legendItem}>
              <Txt variant="label" tabular>
                {s.range}
              </Txt>
              <Txt variant="caption" color="textMuted">
                {s.name}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      {redFlagParameter ? (
        <View style={[styles.redFlag, { backgroundColor: band.tint }]}>
          <Icon name="flag" size={18} color={band.graphic} />
          <Txt variant="label" color={band.onTint} style={styles.flex}>
            {redFlagParameter} scored 3 on its own
          </Txt>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  title: { marginBottom: spacing.sm },
  markerTrack: { height: MARKER, justifyContent: 'center' },
  marker: {
    position: 'absolute',
    left: 0,
    width: MARKER,
    height: MARKER - 6,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: { flexDirection: 'row', gap: 4, marginTop: spacing.xs },
  segment: { flex: 1, height: 10, borderRadius: radius.pill },
  legend: { flexDirection: 'row', gap: 4, marginTop: spacing.sm },
  legendItem: { flex: 1, alignItems: 'center' },
  redFlag: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  flex: { flex: 1 },
});
