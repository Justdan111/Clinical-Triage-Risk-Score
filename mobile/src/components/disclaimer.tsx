import { StyleSheet, View } from 'react-native';

import { Txt, useTheme } from '@/theme/theme';
import { radius, spacing } from '@/theme/tokens';

import { Icon } from './icons';

export const DISCLAIMER_TEXT =
  'Portfolio demo. Not a medical device and not validated for clinical use. Do not use it for real patients.';

/** Always-visible disclaimer card, rendered on every screen (never behind a menu). */
export function Disclaimer() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.box, { backgroundColor: colors.warnSurface, borderColor: `${colors.onWarnSurface}40` }]}
      accessible
      accessibilityLabel={`Not for clinical use. ${DISCLAIMER_TEXT}`}
    >
      <Icon name="info" size={20} color={colors.onWarnSurface} />
      <View style={styles.text}>
        <Txt variant="label" color="onWarnSurface">
          Not for clinical use
        </Txt>
        <Txt variant="caption" color="onWarnSurface">
          {DISCLAIMER_TEXT}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  text: { flex: 1, gap: 2 },
});
