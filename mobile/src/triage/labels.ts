// Human-readable presentation of API values. Pure functions only (no React),
// so they can be unit tested directly.

import type { Band, Consciousness, VitalsField } from '@/api/types';

interface ParameterInfo {
  label: string;
  unit: string; // appended to numeric values; '' for none
}

export const PARAMETER_INFO: Record<VitalsField, ParameterInfo> = {
  respiration_rate: { label: 'Respiration rate', unit: 'breaths/min' },
  spo2: { label: 'SpO₂', unit: '%' },
  systolic_bp: { label: 'Systolic blood pressure', unit: 'mmHg' },
  pulse: { label: 'Pulse', unit: 'beats/min' },
  consciousness: { label: 'Consciousness', unit: '' },
  temperature: { label: 'Temperature', unit: '°C' },
  on_supplemental_oxygen: { label: 'Supplemental oxygen', unit: '' },
};

export const CONSCIOUSNESS_LABELS: Record<Consciousness, string> = {
  alert: 'Alert',
  new_confusion: 'New confusion',
  voice: 'Responds to voice',
  pain: 'Responds to pain',
  unresponsive: 'Unresponsive',
};

function isVitalsField(p: string): p is VitalsField {
  return Object.prototype.hasOwnProperty.call(PARAMETER_INFO, p);
}

function isConsciousness(v: string): v is Consciousness {
  return Object.prototype.hasOwnProperty.call(CONSCIOUSNESS_LABELS, v);
}

/** Readable name for an API parameter; unknown names are shown as sent, never dropped. */
export function parameterLabel(parameter: string): string {
  return isVitalsField(parameter) ? PARAMETER_INFO[parameter].label : parameter;
}

/** Formats a driver's value with its unit, e.g. "8 breaths/min", "38.5 °C", "On oxygen". */
export function formatDriverValue(parameter: string, value: number | string | boolean): string {
  if (typeof value === 'boolean') {
    return parameter === 'on_supplemental_oxygen' ? (value ? 'On oxygen' : 'On air') : value ? 'Yes' : 'No';
  }
  if (typeof value === 'string') {
    return isConsciousness(value) ? CONSCIOUSNESS_LABELS[value] : value;
  }
  const unit = isVitalsField(parameter) ? PARAMETER_INFO[parameter].unit : '';
  const text = parameter === 'temperature' ? value.toFixed(1) : String(value);
  return unit ? `${text} ${unit}` : text;
}

export interface BandInfo {
  label: string;
  /** A glyph shown beside the label so colour is never the only signal. */
  icon: string;
  /** Spoken by screen readers instead of the glyph. */
  iconDescription: string;
  background: string;
  foreground: string;
  /** RCP NEWS2 Chart 2 wording for the clinical risk. */
  rcpRisk: string;
}

// Colours follow the RCP chart's escalating order (calm -> amber -> orange -> red).
// Every foreground/background pair has a contrast ratio of at least 4.5:1.
export const BAND_INFO: Record<Band, BandInfo> = {
  low: {
    label: 'Low',
    icon: '✓',
    iconDescription: 'check mark',
    background: '#1B5E20',
    foreground: '#FFFFFF',
    rcpRisk: 'Low clinical risk',
  },
  red_flagged: {
    label: 'Red-flagged',
    icon: '⚑',
    iconDescription: 'flag',
    background: '#FFD54F',
    foreground: '#1A1A1A',
    rcpRisk: 'Low–medium clinical risk (red score)',
  },
  medium: {
    label: 'Medium',
    icon: '▲',
    iconDescription: 'warning triangle',
    background: '#FB8C00',
    foreground: '#1A1A1A',
    rcpRisk: 'Medium clinical risk',
  },
  high: {
    label: 'High',
    icon: '‼',
    iconDescription: 'double exclamation mark',
    background: '#B71C1C',
    foreground: '#FFFFFF',
    rcpRisk: 'High clinical risk',
  },
};

export const RED_FLAG_EXPLANATION =
  'One vital sign scored 3 on its own, so this result is flagged for urgent review even though the total score is low.';
