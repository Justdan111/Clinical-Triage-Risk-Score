import { StyleSheet, Text, View } from 'react-native';

export const DISCLAIMER_TEXT =
  'Portfolio demo only. This is not a medical device and has not been validated for clinical use. Do not use it to make decisions about real patients.';

/** Always-visible disclaimer banner, rendered at the top of every screen. */
export function Disclaimer() {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.title}>Not for clinical use</Text>
      <Text style={styles.body}>{DISCLAIMER_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FFF4E5',
    borderColor: '#B26A00',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  title: { fontWeight: '700', color: '#5C3700', fontSize: 15 },
  body: { color: '#5C3700', fontSize: 13, lineHeight: 18 },
});
