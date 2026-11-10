import { buildRequest, EMPTY_FORM, type FormValues } from './form';

const FILLED: FormValues = {
  respiration_rate: '16',
  spo2: '97',
  systolic_bp: '120',
  pulse: '72',
  temperature: '36.8',
  consciousness: 'alert',
  on_supplemental_oxygen: true,
};

describe('buildRequest', () => {
  it('builds the API request from a filled form', () => {
    expect(buildRequest(FILLED)).toEqual({
      ok: true,
      request: {
        respiration_rate: 16,
        spo2: 97,
        systolic_bp: 120,
        pulse: 72,
        temperature: 36.8,
        consciousness: 'alert',
        on_supplemental_oxygen: true,
      },
    });
  });

  it('flags every empty field and an unchosen consciousness level', () => {
    expect(buildRequest(EMPTY_FORM)).toEqual({
      ok: false,
      errors: {
        respiration_rate: 'Required',
        spo2: 'Required',
        systolic_bp: 'Required',
        pulse: 'Required',
        temperature: 'Required',
        consciousness: 'Choose a level',
      },
    });
  });

  it('accepts a decimal comma and surrounding spaces', () => {
    const built = buildRequest({ ...FILLED, temperature: ' 36,8 ' });
    expect(built.ok && built.request.temperature).toBe(36.8);
  });

  it('rejects text that is not a number', () => {
    expect(buildRequest({ ...FILLED, pulse: '7O' })).toEqual({ ok: false, errors: { pulse: 'Enter a number' } });
  });

  it('leaves range, whole-number and decimal-place checks to the server', () => {
    const built = buildRequest({ ...FILLED, spo2: '101', respiration_rate: '12.5', temperature: '36.85' });
    expect(built.ok).toBe(true);
  });
});
