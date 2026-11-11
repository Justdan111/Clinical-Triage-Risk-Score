import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { scoreVitals } from '@/api/client';
import { CONSCIOUSNESS_LEVELS, VITALS_FIELDS, type Consciousness, type VitalsField } from '@/api/types';
import { Disclaimer } from '@/components/disclaimer';
import { buildRequest, EMPTY_FORM, type FormValues, type NumericField } from '@/triage/form';
import { CONSCIOUSNESS_LABELS, PARAMETER_INFO, parameterLabel } from '@/triage/labels';

const NUMERIC_INPUTS: { field: NumericField; placeholder: string; decimal: boolean }[] = [
  { field: 'respiration_rate', placeholder: 'e.g. 16', decimal: false },
  { field: 'spo2', placeholder: 'e.g. 97', decimal: false },
  { field: 'systolic_bp', placeholder: 'e.g. 120', decimal: false },
  { field: 'pulse', placeholder: 'e.g. 72', decimal: false },
  { field: 'temperature', placeholder: 'e.g. 36.8', decimal: true },
];

function isVitalsField(f: string): f is VitalsField {
  return (VITALS_FIELDS as readonly string[]).includes(f);
}

export default function VitalsFormScreen() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  // Keyed by API field name; holds both client-side and server-side messages.
  const [errors, setErrors] = useState<Partial<Record<VitalsField, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined })); // editing a field clears its error
  }

  async function submit() {
    if (submitting) return;
    setBanner(null);

    const built = buildRequest(values);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }

    setSubmitting(true);
    const outcome = await scoreVitals(built.request);
    setSubmitting(false);

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
        setBanner([outcome.message, ...unknown].join('\n'));
        return;
      }
      case 'network':
      case 'timeout':
      case 'server':
      case 'unexpected':
      case 'config':
        setBanner(outcome.message);
        return;
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Disclaimer />

        {NUMERIC_INPUTS.map(({ field, placeholder, decimal }) => {
          const { label, unit } = PARAMETER_INFO[field];
          const error = errors[field];
          return (
            <View key={field} style={styles.field}>
              <Text style={styles.label}>
                {label} <Text style={styles.unit}>({unit})</Text>
              </Text>
              <TextInput
                style={[styles.input, error ? styles.inputError : null]}
                value={values[field]}
                onChangeText={(text) => update(field, text)}
                placeholder={placeholder}
                placeholderTextColor="#8A8A8A"
                keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
                returnKeyType="done"
                accessibilityLabel={`${label} in ${unit}`}
                accessibilityHint={error}
                editable={!submitting}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          );
        })}

        <View style={styles.field}>
          <Text style={styles.label}>{PARAMETER_INFO.consciousness.label} (ACVPU)</Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {CONSCIOUSNESS_LEVELS.map((level: Consciousness) => {
              const selected = values.consciousness === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => update('consciousness', level)}
                  disabled={submitting}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
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
          {errors.consciousness ? <Text style={styles.error}>{errors.consciousness}</Text> : null}
        </View>

        <View style={[styles.field, styles.switchRow]}>
          <Text style={styles.label}>{PARAMETER_INFO.on_supplemental_oxygen.label}</Text>
          <Switch
            value={values.on_supplemental_oxygen}
            onValueChange={(on) => update('on_supplemental_oxygen', on)}
            disabled={submitting}
            accessibilityLabel="On supplemental oxygen"
          />
        </View>
        {errors.on_supplemental_oxygen ? <Text style={styles.error}>{errors.on_supplemental_oxygen}</Text> : null}

        {banner ? (
          <View style={styles.banner} accessibilityRole="alert">
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          style={({ pressed }) => [styles.button, (pressed || submitting) && styles.buttonPressed]}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Calculate NEWS2</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 16, gap: 16, paddingBottom: 48 },
  field: { gap: 6 },
  label: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  unit: { fontWeight: '400', color: '#555555' },
  input: {
    borderWidth: 1,
    borderColor: '#9E9E9E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    color: '#1A1A1A',
  },
  inputError: { borderColor: '#B71C1C', borderWidth: 2 },
  error: { color: '#B71C1C', fontSize: 14 },
  options: { gap: 8 },
  option: { borderWidth: 1, borderColor: '#9E9E9E', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  optionSelected: { borderColor: '#0D47A1', backgroundColor: '#E3F2FD', borderWidth: 2 },
  optionText: { fontSize: 16, color: '#1A1A1A' },
  optionTextSelected: { fontWeight: '600', color: '#0D47A1' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  banner: { backgroundColor: '#FDECEA', borderColor: '#B71C1C', borderWidth: 1, borderRadius: 8, padding: 12 },
  bannerText: { color: '#7F1010', fontSize: 15, lineHeight: 20 },
  button: { backgroundColor: '#0D47A1', borderRadius: 8, paddingVertical: 14, alignItems: 'center', minHeight: 50 },
  buttonPressed: { opacity: 0.75 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
