import { StyleSheet, Text, View } from 'react-native';

export const DISCLAIMER_TEXT =
  'Portfolio demo. Not a medical device and not validated for clinical use. Do not use it for real patients.';

/** Always-visible disclaimer banner, rendered on every screen (never behind a menu). */
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
