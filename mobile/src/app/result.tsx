import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { parseScoreResult, tryParseJSON } from '@/api/parse';
import type { ScoreResult } from '@/api/types';
import { Disclaimer } from '@/components/disclaimer';
import { BAND_INFO, formatDriverValue, parameterLabel, RED_FLAG_EXPLANATION } from '@/triage/labels';

/** The form passes the result as a JSON route param; it is re-validated here
 *  so a malformed or hand-typed deep link shows an error instead of crashing. */
function readResult(param: string | string[] | undefined): ScoreResult | null {
  return typeof param === 'string' ? parseScoreResult(tryParseJSON(param)) : null;
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function ResultScreen() {
  const { result: param } = useLocalSearchParams<{ result?: string }>();
  const result = readResult(param);

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Disclaimer />
      {result ? <ResultView result={result} /> : <Text style={styles.body}>This result could not be displayed.</Text>}
      <Pressable onPress={goBack} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>Back to vitals</Text>
      </Pressable>
    </ScrollView>
  );
}

function ResultView({ result }: { result: ScoreResult }) {
  const band = BAND_INFO[result.band];
  return (
    <>
      <View
        style={[styles.bandCard, { backgroundColor: band.background }]}
        accessible
        accessibilityLabel={`Band: ${band.label}. ${band.rcpRisk}. NEWS2 total ${result.total}.`}
      >
        <View style={styles.bandRow}>
          <Text style={[styles.bandIcon, { color: band.foreground }]}>{band.icon}</Text>
          <Text style={[styles.bandLabel, { color: band.foreground }]}>{band.label}</Text>
        </View>
        <Text style={[styles.bandRisk, { color: band.foreground }]}>{band.rcpRisk}</Text>
        <Text style={[styles.total, { color: band.foreground }]}>NEWS2 total: {result.total}</Text>
      </View>

      {result.band === 'red_flagged' ? <Text style={styles.explanation}>{RED_FLAG_EXPLANATION}</Text> : null}
      {result.note ? <Text style={styles.note}>Note: {result.note}</Text> : null}

      <Text style={styles.heading}>What drove this score</Text>
      {result.drivers.length === 0 ? (
        <Text style={styles.body}>No vital sign scored above zero.</Text>
      ) : (
        <View style={styles.drivers}>
          {result.drivers.map((d) => (
            <View
              key={d.parameter}
              style={styles.driverRow}
              accessible
              accessibilityLabel={`${parameterLabel(d.parameter)}, ${formatDriverValue(d.parameter, d.value)}, ${d.points} ${d.points === 1 ? 'point' : 'points'}`}
            >
              <View style={styles.driverText}>
                <Text style={styles.driverLabel}>{parameterLabel(d.parameter)}</Text>
                <Text style={styles.driverValue}>{formatDriverValue(d.parameter, d.value)}</Text>
              </View>
              <Text style={[styles.points, d.points === 3 && styles.pointsRed]}>+{d.points}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 48, backgroundColor: '#FFFFFF', flexGrow: 1 },
  bandCard: { borderRadius: 12, padding: 20, gap: 4 },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bandIcon: { fontSize: 36, fontWeight: '700' },
  bandLabel: { fontSize: 36, fontWeight: '800' },
  bandRisk: { fontSize: 16, fontWeight: '500' },
  total: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  explanation: { fontSize: 16, lineHeight: 22, color: '#1A1A1A', fontWeight: '500' },
  note: { fontSize: 15, color: '#333333', fontStyle: 'italic' },
  heading: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  body: { fontSize: 16, color: '#333333' },
  drivers: { borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDDDD',
  },
  driverText: { flex: 1, gap: 2 },
  driverLabel: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  driverValue: { fontSize: 15, color: '#444444' },
  points: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', minWidth: 44, textAlign: 'right' },
  pointsRed: { color: '#B71C1C' },
  button: { backgroundColor: '#0D47A1', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonPressed: { opacity: 0.75 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
