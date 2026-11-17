import type { Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type LayoutChangeEvent, type TextInputInstance } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useFieldFeedback } from '@/motion/use-field-feedback';
import type { NumericField } from '@/triage/form';
import { stepValue } from '@/triage/progress';
import { typeStyle, Txt, useTheme } from '@/theme/theme';
import { duration, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

import { Card } from './card';
import { Icon, type IconName } from './icons';

interface VitalCardProps {
  field: NumericField;
  icon: IconName;
  label: string;
  unit: string;
  decimal: boolean;
  value: string;
  onChange: (text: string) => void;
  /** Server (or client) message for this field. */
  error?: string;
  /** Increments on every submit that returned errors, so a repeated error shakes again. */
  errorKey: number;
  /** Filled = present and numeric. Becoming filled triggers the pop. */
  filled: boolean;
  disabled: boolean;
  inputRef?: Ref<TextInputInstance>;
  onLayout?: (e: LayoutChangeEvent) => void;
}

/** One vital: icon, name, unit, big tabular input and − / + steppers. */
export function VitalCard(props: VitalCardProps) {
  const { field, icon, label, unit, decimal, value, onChange, error, errorKey, filled, disabled, inputRef, onLayout } =
    props;
  const { colors, fontsLoaded } = useTheme();
  const feedback = useFieldFeedback({ filled, error, errorKey });

  // Steppers never invent a value: disabled until a number is typed (DESIGN.md §8.2).
  const canStep = stepValue(value, field, 1) !== null && !disabled;
  const step = (dir: 1 | -1) => {
    const next = stepValue(value, field, dir);
    if (next !== null) onChange(next);
  };

  return (
    <Card style={[styles.card, feedback]} onLayout={onLayout}>
      <View style={styles.header}>
        <IconBubble icon={icon} />
        <View style={styles.headerText}>
          <Txt variant="heading">{label}</Txt>
          <Txt variant="label" color="textMuted">
            {unit}
          </Txt>
        </View>
      </View>

      <View style={styles.inputRow}>
        <StepButton icon="minus" label={`Decrease ${label}`} enabled={canStep} onPress={() => step(-1)} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder="Enter"
          placeholderTextColor={colors.textSubtle}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          returnKeyType="done"
          editable={!disabled}
          textAlign="center"
          style={[
            styles.input,
            typeStyle('numericInput', fontsLoaded, true),
            { color: colors.text, backgroundColor: colors.surfaceMuted },
          ]}
          accessibilityLabel={`${label}, in ${unit}`}
          accessibilityHint={error ? `Error: ${error}` : undefined}
        />
        <StepButton icon="plus" label={`Increase ${label}`} enabled={canStep} onPress={() => step(1)} />
      </View>

      <FieldError error={error} errorKey={errorKey} />
    </Card>
  );
}

export function IconBubble({ icon }: { icon: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.iconBubble, { backgroundColor: colors.primaryMuted }]}>
      <Icon name={icon} size={22} color={colors.onPrimaryMuted} />
    </View>
  );
}

/** Error message that fades in; re-keyed per submit so it fades in again. */
export function FieldError({ error, errorKey }: { error?: string; errorKey: number }) {
  if (!error) return null;
  return (
    <Animated.View key={errorKey} entering={FadeIn.duration(duration.base)}>
      <Txt variant="label" color="error" importantForAccessibility="no" accessibilityElementsHidden>
        {error}
      </Txt>
    </Animated.View>
  );
}

function StepButton({ icon, label, enabled, onPress }: { icon: IconName; label: string; enabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={enabled ? undefined : 'Type a value first'}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.stepper,
        { backgroundColor: colors.surfaceMuted, opacity: enabled ? (pressed ? 0.6 : 1) : 0.4 },
      ]}
    >
      <Icon name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

export const cardStyles = StyleSheet.create({
  card: { gap: spacing.lg, borderWidth: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1 },
});

const styles = StyleSheet.create({
  ...cardStyles,
  iconBubble: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  input: { flex: 1, minHeight: 56, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  stepper: { width: TOUCH_TARGET + 4, height: TOUCH_TARGET + 4, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
