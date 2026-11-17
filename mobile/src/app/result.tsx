import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseScoreResult, tryParseJSON } from '@/api/parse';
import type { ScoreResult } from '@/api/types';
import { Disclaimer } from '@/components/disclaimer';
import { Icon } from '@/components/icons';
import { BuildBars, DriverList } from '@/components/result/drivers';
import { GaugeRing } from '@/components/result/gauge-ring';
import { ScaleBar } from '@/components/result/scale-bar';
import { useReveal } from '@/motion/use-reveal';
import { bandTheme, type BandTheme } from '@/theme/band-theme';
import { Txt, useTheme } from '@/theme/theme';
import { radius, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { formatDriverValue, parameterLabel, RED_FLAG_EXPLANATION } from '@/triage/labels';

/** The form passes the result as a JSON route param; it is re-validated here
 *  so a malformed or hand-typed deep link shows an error instead of crashing. */
function readResult(param: string | string[] | undefined): ScoreResult | null {
  return typeof param === 'string' ? parseScoreResult(tryParseJSON(param)) : null;
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Everything a screen-reader user needs, announced at once (not after the animation). */
function announcement(result: ScoreResult, band: BandTheme): string {
  const drivers = result.drivers.length
    ? result.drivers
        .map(
          (d) =>
            `${parameterLabel(d.parameter)} ${formatDriverValue(d.parameter, d.value)}, ${d.points} ${d.points === 1 ? 'point' : 'points'}`,
        )
        .join('; ')
    : 'No vital sign scored above zero';
  return [
    `Result: ${band.label}. ${band.rcpRisk}. NEWS2 total ${result.total}.`,
    result.band === 'red_flagged' ? RED_FLAG_EXPLANATION : '',
    `Drivers: ${drivers}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

export default function ResultScreen() {
  const { result: param } = useLocalSearchParams<{ result?: string }>();
  const result = readResult(param);
  return result ? <ResultView result={result} /> : <InvalidResult />;
}

function InvalidResult() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.content}>
        <TopBar />
        <Disclaimer />
        <Txt variant="body">This result could not be displayed.</Txt>
      </View>
    </View>
  );
}

function ResultView({ result }: { result: ScoreResult }) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const band = bandTheme(result.band, scheme);
  const r = useReveal({ driverCount: result.drivers.length, warn: band.haptic === 'warning' });

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(announcement(result, band));
    // Announce once per result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tap anywhere skips straight to the final state (buttons keep working).
  const tap = useTapGesture({ runOnJS: true, onActivate: () => r.skip() });

  const bg = colors.bg;
  const tint = band.tint;
  const screenStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(r.tint.value, [0, 1], [bg, tint]),
    opacity: r.fade.value,
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, r.label.value),
    transform: [{ scale: 0.85 + 0.15 * r.label.value }],
  }));

  const redFlag = result.band === 'red_flagged' ? result.drivers.find((d) => d.points === 3) : undefined;

  return (
    <Animated.View style={[styles.screen, screenStyle]}>
      <GestureDetector gesture={tap}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing['2xl'] },
          ]}
        >
          <TopBar />

          {/* Hero: the band first (≈0.4 s), then the gauge counts up. */}
          <Animated.View
            style={[styles.bandRow, labelStyle]}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`Result: ${band.label}, ${band.iconDescription}. ${band.rcpRisk}. NEWS2 total ${result.total}.`}
          >
            <View style={[styles.bandIcon, { backgroundColor: band.strong }]}>
              <Icon name={band.icon} size={30} color={band.onStrong} strokeWidth={2.4} />
            </View>
            <View style={styles.bandText}>
              <Txt variant="bandLabel" color={band.onTint}>
                {band.label}
              </Txt>
              <Txt variant="body" color={band.onTint}>
                {band.rcpRisk}
              </Txt>
            </View>
          </Animated.View>

          <GaugeRing total={result.total} band={band} progress={r.gauge} />
          <Txt
            variant="title"
            color={band.onTint}
            style={styles.center}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            NEWS2 total {result.total}
          </Txt>

          <ScaleBar
            total={result.total}
            band={band}
            progress={r.marker}
            redFlagParameter={redFlag ? parameterLabel(redFlag.parameter) : undefined}
          />

          {result.band === 'red_flagged' ? (
            <Txt variant="body" color={band.onTint}>
              {RED_FLAG_EXPLANATION}
            </Txt>
          ) : null}
          {result.note ? (
            <Txt variant="body" color="textMuted">
              Note: {result.note}
            </Txt>
          ) : null}

          <Disclaimer />

          <Txt variant="title" accessibilityRole="header">
            What drove this score
          </Txt>
          <DriverList drivers={result.drivers} band={band} clock={r.drivers} />
          <BuildBars drivers={result.drivers} total={result.total} band={band} clock={r.drivers} />

          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back to the vitals form"
            style={({ pressed }) => [styles.backButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Txt variant="heading" color="onPrimary">
              Back to vitals
            </Txt>
          </Pressable>
        </ScrollView>
      </GestureDetector>
    </Animated.View>
  );
}

function TopBar() {
  const { colors } = useTheme();
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Back to the vitals form"
        hitSlop={8}
        style={({ pressed }) => [styles.topBack, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon name="back" size={22} color={colors.text} />
      </Pressable>
      <Txt variant="heading" accessibilityRole="header">
        Result
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET },
  topBack: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap', marginTop: spacing.sm },
  bandIcon: { width: 60, height: 60, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  bandText: { flexShrink: 1, gap: 2 },
  center: { textAlign: 'center' },
  backButton: {
    minHeight: 56,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
});
