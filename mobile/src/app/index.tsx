import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { scoreVitals } from '@/api/client';
import { VITALS_FIELDS, type VitalsField } from '@/api/types';
import { Card } from '@/components/card';
import { ConsciousnessCard, OxygenCard } from '@/components/choice-cards';
import { Disclaimer } from '@/components/disclaimer';
import { VITAL_ICONS } from '@/components/vital-icons';
import { ProgressRing } from '@/components/progress-ring';
import { SubmitButton, type SubmitState } from '@/components/submit-button';
import { VitalCard } from '@/components/vital-card';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { haptics } from '@/motion/haptics';
import { buildRequest, EMPTY_FORM, type FormValues, type NumericField } from '@/triage/form';
import { PARAMETER_INFO, parameterLabel } from '@/triage/labels';
import {
  FORM_FIELDS,
  filledCount,
  firstEmptyField,
  isFieldFilled,
  newlyFilled,
  progressAnnouncement,
  TOTAL_FIELDS,
} from '@/triage/progress';
import { Txt, useTheme } from '@/theme/theme';
import { duration, radius, spacing } from '@/theme/tokens';

const NUMERIC_CARDS: { field: NumericField; decimal: boolean }[] = [
  { field: 'respiration_rate', decimal: false },
  { field: 'spo2', decimal: false },
  { field: 'systolic_bp', decimal: false },
  { field: 'pulse', decimal: false },
  { field: 'temperature', decimal: true },
];

const FIX_FIELDS_MESSAGE = 'Some vitals need attention. See the highlighted cards.';

function isVitalsField(f: string): f is VitalsField {
  return (VITALS_FIELDS as readonly string[]).includes(f);
}

export default function VitalsFormScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  // At large text sizes the title gets its own line under the ring, so words never break mid-word.
  const { fontScale } = useWindowDimensions();
  const stackHeader = fontScale >= 1.5;

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<VitalsField, string>>>({});
  const [errorKey, setErrorKey] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A ref, not state, guards against double-submit: two taps in the same frame
  // both see the old `submitting` state, but the ref changes synchronously.
  const inFlight = useRef(false);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const inputRefs = useRef<Partial<Record<NumericField, TextInputInstance | null>>>({});
  const consciousnessRef = useRef<ViewInstance>(null);
  const oxygenRef = useRef<ViewInstance>(null);
  // Card positions are relative to the cards container; add its offset in the scroll content.
  const cardY = useRef<Partial<Record<VitalsField, number>>>({});
  const cardsOffset = useRef(0);

  const count = filledCount(values);
  const submitState: SubmitState = submitting ? 'loading' : count === TOTAL_FIELDS ? 'ready' : 'incomplete';

  // Cards dim and lock while a request is in flight.
  const dim = useSharedValue(1);
  useEffect(() => {
    dim.value = withTiming(submitting ? 0.55 : 1, { duration: duration.base });
  }, [submitting, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    const next = { ...values, [field]: value };
    if (newlyFilled(values, next).length > 0) haptics.tick();
    setValues(next);
    setErrors((e) => ({ ...e, [field]: undefined })); // editing a field clears its error
  }

  function scrollToField(field: VitalsField) {
    const y = cardY.current[field];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, cardsOffset.current + y - spacing.lg), animated: true });
  }

  /** Brings the first card with an error into view, so its message is never hidden below the footer. */
  function scrollToFirstError(errs: Partial<Record<VitalsField, string>>) {
    const field = FORM_FIELDS.find((f) => errs[f]);
    if (field) scrollToField(field);
  }

  function focusFirstEmpty() {
    const field = firstEmptyField(values);
    if (!field) return;
    scrollToField(field);
    if (field === 'consciousness' || field === 'on_supplemental_oxygen') {
      const target = field === 'consciousness' ? consciousnessRef.current : oxygenRef.current;
      if (target) AccessibilityInfo.sendAccessibilityEvent(target, 'focus');
    } else {
      inputRefs.current[field]?.focus();
    }
  }

  async function submit() {
    if (inFlight.current) return;

    if (count < TOTAL_FIELDS) {
      // Dimmed button: guide, don't scold (DESIGN.md §8.4).
      haptics.nudge();
      AccessibilityInfo.announceForAccessibility(progressAnnouncement(count));
      focusFirstEmpty();
      return;
    }

    haptics.submit();
    setBanner(null);
    const built = buildRequest(values);
    if (!built.ok) {
      setErrors(built.errors);
      setErrorKey((k) => k + 1);
      scrollToFirstError(built.errors);
      setBanner(FIX_FIELDS_MESSAGE);
      AccessibilityInfo.announceForAccessibility(FIX_FIELDS_MESSAGE);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      const outcome = await scoreVitals(built.request);
      switch (outcome.kind) {
        case 'ok':
          setErrors({});
          router.push({ pathname: '/result', params: { result: JSON.stringify(outcome.result) } });
          return;
        case 'validation': {
          const known: Partial<Record<VitalsField, string>> = {};
          const unknown: string[] = [];
          for (const [field, message] of Object.entries(outcome.fieldErrors)) {
            if (isVitalsField(field)) known[field] = message;
            else unknown.push(`${parameterLabel(field)}: ${message}`);
          }
          setErrors(known);
          setErrorKey((k) => k + 1);
          scrollToFirstError(known);
          const text = [FIX_FIELDS_MESSAGE, ...unknown].join('\n');
          setBanner(text);
          const spoken = Object.entries(known).map(([f, m]) => `${parameterLabel(f)}: ${m}`);
          AccessibilityInfo.announceForAccessibility([FIX_FIELDS_MESSAGE, ...spoken, ...unknown].join('. '));
          return;
        }
        case 'network':
        case 'timeout':
        case 'server':
        case 'unexpected':
        case 'config':
          setBanner(outcome.message);
          AccessibilityInfo.announceForAccessibility(outcome.message);
          return;
      }
    } finally {
      // The client never throws, but release the guard even if a bug made it.
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function onCardLayout(field: VitalsField, y: number) {
    cardY.current[field] = y;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Card elevation="e1" style={[styles.progressCard, stackHeader && styles.progressCardStacked]}>
          <ProgressRing count={count} />
          <View style={styles.progressText}>
            <Txt variant="title">Patient vitals</Txt>
            <Txt variant="body" color="textMuted">
              {progressAnnouncement(count)}
            </Txt>
          </View>
        </Card>

        <Disclaimer />

        <Animated.View
          style={[styles.cards, dimStyle]}
          pointerEvents={submitting ? 'none' : 'auto'}
          onLayout={(e) => {
            cardsOffset.current = e.nativeEvent.layout.y;
          }}
        >
          {NUMERIC_CARDS.map(({ field, decimal }) => (
            <VitalCard
              key={field}
              field={field}
              icon={VITAL_ICONS[field]}
              label={PARAMETER_INFO[field].label}
              unit={PARAMETER_INFO[field].unit}
              decimal={decimal}
              value={values[field]}
              onChange={(text) => update(field, text)}
              error={errors[field]}
              errorKey={errorKey}
              filled={isFieldFilled(values, field)}
              disabled={submitting}
              inputRef={(r) => {
                inputRefs.current[field] = r;
              }}
              onLayout={(e) => onCardLayout(field, e.nativeEvent.layout.y)}
            />
          ))}
          <ConsciousnessCard
            value={values.consciousness}
            onChange={(c) => update('consciousness', c)}
            error={errors.consciousness}
            errorKey={errorKey}
            disabled={submitting}
            focusRef={consciousnessRef}
            onLayout={(e) => onCardLayout('consciousness', e.nativeEvent.layout.y)}
          />
          <OxygenCard
            value={values.on_supplemental_oxygen}
            onChange={(on) => update('on_supplemental_oxygen', on)}
            error={errors.on_supplemental_oxygen}
            errorKey={errorKey}
            disabled={submitting}
            focusRef={oxygenRef}
            onLayout={(e) => onCardLayout('on_supplemental_oxygen', e.nativeEvent.layout.y)}
          />
        </Animated.View>
      </ScrollView>

      {/* Outside the ScrollView and lifted by the keyboard's height, so the
          submit button (and any banner) is always on screen. */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            marginBottom: keyboardHeight,
            paddingBottom: keyboardHeight > 0 ? spacing.md : Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        {banner ? (
          <View style={[styles.banner, { backgroundColor: colors.errorSurface }]} accessibilityLiveRegion="polite">
            <Txt variant="label" color="onErrorSurface">
              {banner}
            </Txt>
          </View>
        ) : null}
        <SubmitButton state={submitState} filled={count} onPress={submit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' },
  progressCardStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  progressText: { flexShrink: 1, gap: 2 },
  cards: { gap: spacing.lg },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  banner: { borderRadius: radius.md, padding: spacing.md },
});
