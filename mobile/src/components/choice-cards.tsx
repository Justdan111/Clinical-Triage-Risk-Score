import { useEffect, useState, type Ref } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type ViewInstance } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CONSCIOUSNESS_LEVELS, type Consciousness } from '@/api/types';
import { useFieldFeedback } from '@/motion/use-field-feedback';
import { haptics } from '@/motion/haptics';
import { CONSCIOUSNESS_LABELS } from '@/triage/labels';
import { typeStyle, Txt, useTheme } from '@/theme/theme';
import { duration, radius, spacing, springs, TOUCH_TARGET } from '@/theme/tokens';

import { Card } from './card';
import { Icon } from './icons';
import { VITAL_ICONS } from './vital-icons';
import { cardStyles, FieldError, IconBubble } from './vital-card';

interface FeedbackProps {
  error?: string;
  errorKey: number;
  disabled: boolean;
  /** Receives screen-reader focus when the dimmed submit button is pressed. */
  focusRef?: Ref<ViewInstance>;
  onLayout?: (e: LayoutChangeEvent) => void;
}

/** Consciousness (ACVPU): a wrapping row of animated chips. No default. */
export function ConsciousnessCard({
  value,
  onChange,
  error,
  errorKey,
  disabled,
  focusRef,
  onLayout,
}: FeedbackProps & { value: Consciousness | null; onChange: (c: Consciousness) => void }) {
  const feedback = useFieldFeedback({ filled: value !== null, error, errorKey });
  return (
    <Card style={[cardStyles.card, feedback]} onLayout={onLayout}>
      <View style={cardStyles.header} ref={focusRef} accessible accessibilityRole="header">
        <IconBubble icon={VITAL_ICONS.consciousness} />
        <View style={cardStyles.headerText}>
          <Txt variant="heading">Consciousness</Txt>
          <Txt variant="label" color="textMuted">
            ACVPU
          </Txt>
        </View>
      </View>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Consciousness level">
        {CONSCIOUSNESS_LEVELS.map((level) => (
          <Chip
            key={level}
            label={CONSCIOUSNESS_LABELS[level]}
            selected={value === level}
            disabled={disabled}
            onPress={() => {
              if (value !== level) haptics.select();
              onChange(level);
            }}
          />
        ))}
      </View>
      <FieldError error={error} errorKey={errorKey} />
    </Card>
  );
}

function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  const { colors, fontsLoaded } = useTheme();
  const reduced = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    on.value = reduced ? withTiming(selected ? 1 : 0, { duration: duration.fast }) : withSpring(selected ? 1 : 0, springs.snappy);
  }, [selected, reduced, on]);

  const [muted, sel, text, onSel, primary] = [colors.surfaceMuted, colors.primaryMuted, colors.text, colors.onPrimaryMuted, colors.primary];
  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [muted, sel]),
    borderColor: interpolateColor(on.value, [0, 1], [muted, primary]),
    transform: [{ scale: press.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [text, onSel]) }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (!reduced) press.set(withSpring(0.95, springs.snappy));
      }}
      onPressOut={() => {
        press.set(withSpring(1, springs.snappy));
      }}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
    >
      <Animated.View style={[styles.chip, chipStyle]}>
        {/* A check mark, so the selection isn't shown by colour alone. */}
        {selected ? <Icon name="check" size={16} color={colors.onPrimaryMuted} strokeWidth={2.4} /> : null}
        <Animated.Text style={[typeStyle('label', fontsLoaded), textStyle]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/** Air or supplemental oxygen: a two-option toggle that starts unanswered (DESIGN.md §8.1). */
export function OxygenCard({
  value,
  onChange,
  error,
  errorKey,
  disabled,
  focusRef,
  onLayout,
}: FeedbackProps & { value: boolean | null; onChange: (on: boolean) => void }) {
  const { colors, fontsLoaded } = useTheme();
  const reduced = useReducedMotion();
  const feedback = useFieldFeedback({ filled: value !== null, error, errorKey });
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useSharedValue(value === true ? 1 : 0);
  const visible = useSharedValue(value === null ? 0 : 1);

  useEffect(() => {
    if (value === null) {
      visible.value = withTiming(0, { duration: duration.fast });
      return;
    }
    visible.value = withTiming(1, { duration: duration.fast });
    position.value = reduced ? value ? 1 : 0 : withSpring(value ? 1 : 0, springs.snappy);
  }, [value, reduced, position, visible]);

  const half = Math.max(0, (trackWidth - 2 * THUMB_INSET) / 2);
  const thumbStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateX: position.value * half }],
  }));

  const options: { on: boolean; label: string; a11y: string }[] = [
    { on: false, label: 'Air', a11y: 'Air' },
    { on: true, label: 'Supplemental O₂', a11y: 'Supplemental oxygen' },
  ];

  return (
    <Card style={[cardStyles.card, feedback]} onLayout={onLayout}>
      <View style={cardStyles.header} ref={focusRef} accessible accessibilityRole="header">
        <IconBubble icon={VITAL_ICONS.on_supplemental_oxygen} />
        <View style={cardStyles.headerText}>
          <Txt variant="heading">Breathing</Txt>
          <Txt variant="label" color="textMuted">
            Air or supplemental oxygen
          </Txt>
        </View>
      </View>
      <View
        style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        accessibilityRole="radiogroup"
        accessibilityLabel="Air or supplemental oxygen"
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, { width: half, backgroundColor: colors.primary }, thumbStyle]}
        />
        {options.map((o) => {
          const selected = value === o.on;
          return (
            <Pressable
              key={o.label}
              style={styles.option}
              disabled={disabled}
              onPress={() => {
                if (value !== o.on) haptics.select();
                onChange(o.on);
              }}
              accessibilityRole="radio"
              accessibilityLabel={o.a11y}
              accessibilityState={{ checked: selected, disabled: disabled }}
            >
              <Txt
                variant="label"
                color={selected ? 'onPrimary' : 'text'}
                style={[typeStyle('label', fontsLoaded), styles.optionText]}
              >
                {o.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <FieldError error={error} errorKey={errorKey} />
    </Card>
  );
}

const THUMB_INSET = 4;

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  track: { flexDirection: 'row', borderRadius: radius.pill, padding: THUMB_INSET, minHeight: TOUCH_TARGET + 2 * THUMB_INSET },
  thumb: { position: 'absolute', top: THUMB_INSET, bottom: THUMB_INSET, left: THUMB_INSET, borderRadius: radius.pill },
  option: { flex: 1, minHeight: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  optionText: { textAlign: 'center' },
});
