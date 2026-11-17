// Form progress: which of the 7 inputs are filled, and stepper arithmetic.
// "Filled" means present and numeric (or chosen). It says nothing about
// whether a value is in range: only the server decides that (DESIGN.md §8.3).

import type { VitalsField } from '@/api/types';

import { parseNumber, type FormValues, type NumericField } from './form';

/** All 7 inputs in on-screen order. */
export const FORM_FIELDS: readonly VitalsField[] = [
  'respiration_rate',
  'spo2',
  'systolic_bp',
  'pulse',
  'temperature',
  'consciousness',
  'on_supplemental_oxygen',
];

export const TOTAL_FIELDS = FORM_FIELDS.length;

export function isFieldFilled(values: FormValues, field: VitalsField): boolean {
  switch (field) {
    case 'consciousness':
      return values.consciousness !== null;
    case 'on_supplemental_oxygen':
      return values.on_supplemental_oxygen !== null;
    default:
      return typeof parseNumber(values[field]) === 'number';
  }
}

export function filledCount(values: FormValues): number {
  return FORM_FIELDS.filter((f) => isFieldFilled(values, f)).length;
}

/** The first input (in on-screen order) that isn't filled, or null when all are. */
export function firstEmptyField(values: FormValues): VitalsField | null {
  return FORM_FIELDS.find((f) => !isFieldFilled(values, f)) ?? null;
}

/** Fields that became filled between two form states (drives the haptic tick and card pop). */
export function newlyFilled(before: FormValues, after: FormValues): VitalsField[] {
  return FORM_FIELDS.filter((f) => !isFieldFilled(before, f) && isFieldFilled(after, f));
}

export function progressAnnouncement(count: number): string {
  return `${count} of ${TOTAL_FIELDS} vitals entered`;
}

/** Step size per numeric field: 0.1 °C for temperature, 1 for the rest. */
export function stepFor(field: NumericField): number {
  return field === 'temperature' ? 0.1 : 1;
}

/**
 * Applies a stepper press. Returns the new text, or null when the stepper
 * should be disabled (no number typed yet: steppers never invent a value,
 * DESIGN.md §8.2). Never goes below 0; ranges are the server's job.
 */
export function stepValue(text: string, field: NumericField, direction: 1 | -1): string | null {
  const current = parseNumber(text);
  if (typeof current !== 'number') return null;
  const step = stepFor(field);
  const next = Math.max(0, current + direction * step);
  // Round to the step's precision so 36.1 + 0.1 is 36.2, not 36.20000000000001.
  return step < 1 ? (Math.round(next * 10) / 10).toFixed(1) : String(Math.round(next));
}
