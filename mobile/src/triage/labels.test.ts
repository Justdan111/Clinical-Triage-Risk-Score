import { BANDS, CONSCIOUSNESS_LEVELS, VITALS_FIELDS } from '@/api/types';

import { BAND_INFO, CONSCIOUSNESS_LABELS, formatDriverValue, parameterLabel, PARAMETER_INFO } from './labels';

describe('parameterLabel', () => {
  it.each([
    ['respiration_rate', 'Respiration rate'],
    ['spo2', 'SpO₂'],
    ['systolic_bp', 'Systolic blood pressure'],
    ['pulse', 'Pulse'],
    ['consciousness', 'Consciousness'],
    ['temperature', 'Temperature'],
    ['on_supplemental_oxygen', 'Supplemental oxygen'],
  ])('maps %s to %s', (parameter, label) => {
    expect(parameterLabel(parameter)).toBe(label);
  });

  it('covers every API field', () => {
    for (const field of VITALS_FIELDS) {
      expect(PARAMETER_INFO[field].label).not.toBe(field);
    }
  });

  it('shows an unknown parameter as sent rather than dropping it', () => {
    expect(parameterLabel('lactate')).toBe('lactate');
  });

  it('does not treat inherited object keys as parameters', () => {
    expect(parameterLabel('toString')).toBe('toString');
  });
});

describe('formatDriverValue', () => {
  it.each([
    ['respiration_rate', 8, '8 breaths/min'],
    ['spo2', 91, '91 %'],
    ['systolic_bp', 85, '85 mmHg'],
    ['pulse', 120, '120 beats/min'],
    ['temperature', 38.5, '38.5 °C'],
    ['temperature', 39, '39.0 °C'], // JSON 39.0 arrives as 39
    ['on_supplemental_oxygen', true, 'On oxygen'],
    ['on_supplemental_oxygen', false, 'On air'],
    ['consciousness', 'new_confusion', 'New confusion'],
    ['consciousness', 'unresponsive', 'Unresponsive'],
    ['consciousness', 'drowsy', 'drowsy'], // unknown level shown as sent
    ['lactate', 4, '4'], // unknown parameter: no unit
  ] as const)('%s %p -> %s', (parameter, value, text) => {
    expect(formatDriverValue(parameter, value)).toBe(text);
  });

  it('has a label for every consciousness level the API accepts', () => {
    for (const level of CONSCIOUSNESS_LEVELS) {
      expect(CONSCIOUSNESS_LABELS[level]).toBeTruthy();
    }
  });
});

describe('BAND_INFO', () => {
  it('gives every band a distinct label and icon, so colour is never the only signal', () => {
    const labels = BANDS.map((b) => BAND_INFO[b].label);
    const icons = BANDS.map((b) => BAND_INFO[b].icon);
    expect(new Set(labels).size).toBe(BANDS.length);
    expect(new Set(icons).size).toBe(BANDS.length);
  });

  it.each(BANDS)('%s has wording for screen readers and the RCP risk line', (band) => {
    expect(BAND_INFO[band].iconDescription).toBeTruthy();
    expect(BAND_INFO[band].rcpRisk).toBeTruthy();
  });
});

// Band colours and their contrast (both themes) are tested in src/theme/contrast.test.ts.
