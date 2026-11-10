import type { Consciousness, VitalsField, VitalsRequest } from '@/api/types';

export type NumericField = 'respiration_rate' | 'spo2' | 'systolic_bp' | 'pulse' | 'temperature';

export interface FormValues {
  respiration_rate: string;
  spo2: string;
  systolic_bp: string;
  pulse: string;
  temperature: string;
  consciousness: Consciousness | null; // null until the user picks one: no silent default
  on_supplemental_oxygen: boolean;
}

export const EMPTY_FORM: FormValues = {
  respiration_rate: '',
  spo2: '',
  systolic_bp: '',
  pulse: '',
  temperature: '',
  consciousness: null,
  on_supplemental_oxygen: false,
};

export type FieldErrors = Partial<Record<VitalsField, string>>;

export type BuildResult = { ok: true; request: VitalsRequest } | { ok: false; errors: FieldErrors };

/** Parses a numeric text input. Accepts a decimal comma ("36,8"), which many
 *  locales' keyboards produce. Returns an error string or the number. */
function parseNumber(text: string): number | string {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return 'Required';
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : 'Enter a number';
}

/**
 * Light client-side checks only: empty or non-numeric inputs and an unchosen
 * consciousness level. Ranges, whole numbers and the one-decimal temperature
 * rule are left to the server, which is the source of truth; its field
 * errors are shown next to the inputs in the same way.
 */
export function buildRequest(values: FormValues): BuildResult {
  const errors: FieldErrors = {};
  const numbers: Partial<Record<NumericField, number>> = {};

  const numericFields: NumericField[] = ['respiration_rate', 'spo2', 'systolic_bp', 'pulse', 'temperature'];
  for (const field of numericFields) {
    const parsed = parseNumber(values[field]);
    if (typeof parsed === 'string') errors[field] = parsed;
    else numbers[field] = parsed;
  }
  if (values.consciousness === null) errors.consciousness = 'Choose a level';

  const { respiration_rate, spo2, systolic_bp, pulse, temperature } = numbers;
  if (
    Object.keys(errors).length > 0 ||
    respiration_rate === undefined ||
    spo2 === undefined ||
    systolic_bp === undefined ||
    pulse === undefined ||
    temperature === undefined ||
    values.consciousness === null
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    request: {
      respiration_rate,
      spo2,
      systolic_bp,
      pulse,
      consciousness: values.consciousness,
      temperature,
      on_supplemental_oxygen: values.on_supplemental_oxygen,
    },
  };
}
