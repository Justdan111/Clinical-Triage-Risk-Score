import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { scoreVitals } from '@/api/client';
import { CONSCIOUSNESS_LEVELS, VITALS_FIELDS, type VitalsField } from '@/api/types';
import { Disclaimer } from '@/components/disclaimer';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { buildRequest, EMPTY_FORM, type FormValues, type NumericField } from '@/triage/form';
import { CONSCIOUSNESS_LABELS, PARAMETER_INFO, parameterLabel } from '@/triage/labels';

const NUMERIC_INPUTS: { field: NumericField; placeholder: string; decimal: boolean }[] = [
  { field: 'respiration_rate', placeholder: 'e.g. 16', decimal: false },
  { field: 'spo2', placeholder: 'e.g. 97', decimal: false },
  { field: 'systolic_bp', placeholder: 'e.g. 120', decimal: false },
  { field: 'pulse', placeholder: 'e.g. 72', decimal: false },
  { field: 'temperature', placeholder: 'e.g. 36.8', decimal: true },
];

// Banner text when the problems are shown next to the inputs.
const FIX_FIELDS_MESSAGE = 'Some vitals need attention. See the highlighted fields.';

function isVitalsField(f: string): f is VitalsField {
  return (VITALS_FIELDS as readonly string[]).includes(f);
}

function announce(message: string) {
  // Screen readers don't notice text that appears elsewhere on screen.
  AccessibilityInfo.announceForAccessibility(message);
}

export default function VitalsFormScreen() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  // Keyed by API field name; holds both client-side and server-side messages.
  const [errors, setErrors] = useState<Partial<Record<VitalsField, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A ref, not state, guards against double-submit: two taps in the same frame
  // both see the old `submitting` state, but the ref changes synchronously.
  const inFlight = useRef(false);

  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined })); // editing a field clears its error
  }

  async function submit() {
    if (inFlight.current) return;
    setBanner(null);

    const built = buildRequest(values);
    if (!built.ok) {
      setErrors(built.errors);
      setBanner(FIX_FIELDS_MESSAGE);
      announce(FIX_FIELDS_MESSAGE);
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
          const text = [FIX_FIELDS_MESSAGE, ...unknown].join('\n');
          setBanner(text);
          announce(text);
          return;
        }
        case 'network':
        case 'timeout':
        case 'server':
        case 'unexpected':
        case 'config':
          setBanner(outcome.message);
          announce(outcome.message);
          return;
      }
    } finally {
      // The client never throws, but release the guard even if a bug made it.
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Disclaimer />

        {NUMERIC_INPUTS.map(({ field, placeholder, decimal }) => {
          const { label, unit } = PARAMETER_INFO[field];
          const error = errors[field];
          return (
            <View key={field} style={styles.field}>
              <Text style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
                {label} <Text style={styles.unit}>({unit})</Text>
              </Text>
              <TextInput
                style={[styles.input, error ? styles.inputError : null]}
                value={values[field]}
                onChangeText={(text) => update(field, text)}
                placeholder={placeholder}
                placeholderTextColor="#6B6B6B"
                keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
                returnKeyType="done"
                accessibilityLabel={`${label}, in ${unit}`}
                accessibilityHint={error ? `Error: ${error}` : undefined}
                editable={!submitting}
              />
              {error ? (
                <Text style={styles.error} importantForAccessibility="no" accessibilityElementsHidden>
                  {error}
                </Text>
              ) : null}
            </View>
          );
        })}

        <View style={styles.field}>
          <Text style={styles.label} accessibilityRole="header">
            {PARAMETER_INFO.consciousness.label} (ACVPU)
          </Text>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Consciousness level">
            {CONSCIOUSNESS_LEVELS.map((level) => {
              const selected = values.consciousness === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => update('consciousness', level)}
                  disabled={submitting}
                  accessibilityRole="radio"
                  accessibilityLabel={CONSCIOUSNESS_LABELS[level]}
                  accessibilityState={{ checked: selected, disabled: submitting }}
                  style={[styles.option, selected && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {selected ? '● ' : '○ '}
                    {CONSCIOUSNESS_LABELS[level]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.consciousness ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              Consciousness: {errors.consciousness}
            </Text>
          ) : null}
        </View>

        <View style={[styles.field, styles.switchRow]}>
          <Text style={[styles.label, styles.switchLabel]} importantForAccessibility="no" accessibilityElementsHidden>
            {PARAMETER_INFO.on_supplemental_oxygen.label}
          </Text>
          <Switch
            value={values.on_supplemental_oxygen}
            onValueChange={(on) => update('on_supplemental_oxygen', on)}
            disabled={submitting}
            accessibilityLabel="On supplemental oxygen"
            accessibilityHint={errors.on_supplemental_oxygen ? `Error: ${errors.on_supplemental_oxygen}` : undefined}
          />
        </View>
        {errors.on_supplemental_oxygen ? <Text style={styles.error}>{errors.on_supplemental_oxygen}</Text> : null}
      </ScrollView>

      {/* Outside the ScrollView and lifted by the keyboard's height, so the
          submit button (and any error banner) is always on screen. */}
      <View
        style={[
          styles.footer,
          { marginBottom: keyboardHeight, paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 12) },
        ]}
      >
        {banner ? (
          <View style={styles.banner} accessibilityLiveRegion="polite">
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={submit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={submitting ? 'Calculating NEWS2 score' : 'Calculate NEWS2 score'}
          accessibilityHint="Sends these vitals to the scoring server"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          style={({ pressed }) => [styles.button, (pressed || submitting) && styles.buttonPressed]}
        >
          {submitting ? (
            <View style={styles.buttonRow}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.buttonText}>Calculating…</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Calculate NEWS2</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  container: { padding: 16, gap: 16, paddingBottom: 24 },
  field: { gap: 6 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  unit: { fontWeight: '400', color: '#555555' },
  input: {
    borderWidth: 1,
    borderColor: '#767676',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    color: '#1A1A1A',
  },
  inputError: { borderColor: '#B71C1C', borderWidth: 2 },
  error: { color: '#B71C1C', fontSize: 14 },
  options: { gap: 8 },
  option: { borderWidth: 1, borderColor: '#767676', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  optionSelected: { borderColor: '#0D47A1', backgroundColor: '#E3F2FD', borderWidth: 2 },
  optionText: { fontSize: 16, color: '#1A1A1A' },
  optionTextSelected: { fontWeight: '600', color: '#0D47A1' },
  // Wraps so that at large text sizes the label gets the full width (no
  // mid-word breaks) and the switch moves onto the next line.
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchLabel: { flexGrow: 1, flexShrink: 1 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
  },
  banner: { backgroundColor: '#FDECEA', borderColor: '#B71C1C', borderWidth: 1, borderRadius: 8, padding: 12 },
  bannerText: { color: '#7F1010', fontSize: 15, lineHeight: 20 },
  button: { backgroundColor: '#0D47A1', borderRadius: 8, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  buttonPressed: { opacity: 0.75 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
