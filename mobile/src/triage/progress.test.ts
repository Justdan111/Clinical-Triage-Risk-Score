import { EMPTY_FORM, type FormValues } from './form';
import {
  filledCount,
  firstEmptyField,
  isFieldFilled,
  newlyFilled,
  progressAnnouncement,
  stepValue,
  TOTAL_FIELDS,
} from './progress';

const FULL: FormValues = {
  respiration_rate: '16',
  spo2: '97',
  systolic_bp: '120',
  pulse: '72',
  temperature: '36.8',
  consciousness: 'alert',
  on_supplemental_oxygen: false,
};

describe('filledCount', () => {
  it('is 0 for an empty form and 7 for a full one', () => {
    expect(TOTAL_FIELDS).toBe(7);
    expect(filledCount(EMPTY_FORM)).toBe(0);
    expect(filledCount(FULL)).toBe(7);
  });

  it('counts each input once as it is filled', () => {
    expect(filledCount({ ...EMPTY_FORM, pulse: '72' })).toBe(1);
    expect(filledCount({ ...EMPTY_FORM, pulse: '72', consciousness: 'voice' })).toBe(2);
  });

  it('counts "air" (false) as answered, but an unanswered toggle (null) as not', () => {
    expect(isFieldFilled({ ...EMPTY_FORM, on_supplemental_oxygen: false }, 'on_supplemental_oxygen')).toBe(true);
    expect(isFieldFilled(EMPTY_FORM, 'on_supplemental_oxygen')).toBe(false);
  });

  it('does not count text that is not a number, or whitespace', () => {
    expect(filledCount({ ...FULL, pulse: '7O' })).toBe(6);
    expect(filledCount({ ...FULL, spo2: '   ' })).toBe(6);
  });

  it('counts out-of-range numbers as filled: ranges are the server’s job', () => {
    expect(filledCount({ ...FULL, spo2: '101', respiration_rate: '12.5' })).toBe(7);
  });

  it('accepts a decimal comma', () => {
    expect(isFieldFilled({ ...EMPTY_FORM, temperature: '36,8' }, 'temperature')).toBe(true);
  });
});

describe('firstEmptyField', () => {
  it('follows on-screen order', () => {
    expect(firstEmptyField(EMPTY_FORM)).toBe('respiration_rate');
    expect(firstEmptyField({ ...FULL, systolic_bp: '', consciousness: null })).toBe('systolic_bp');
    expect(firstEmptyField({ ...FULL, on_supplemental_oxygen: null })).toBe('on_supplemental_oxygen');
    expect(firstEmptyField(FULL)).toBeNull();
  });
});

describe('newlyFilled', () => {
  it('reports only fields that changed from empty to filled', () => {
    expect(newlyFilled(EMPTY_FORM, { ...EMPTY_FORM, pulse: '7' })).toEqual(['pulse']);
    expect(newlyFilled({ ...EMPTY_FORM, pulse: '7' }, { ...EMPTY_FORM, pulse: '72' })).toEqual([]); // another keystroke: no new tick
    expect(newlyFilled(FULL, { ...FULL, pulse: '' })).toEqual([]);
  });
});

describe('progressAnnouncement', () => {
  it('reads "N of 7 vitals entered"', () => {
    expect(progressAnnouncement(3)).toBe('3 of 7 vitals entered');
  });
});

describe('stepValue', () => {
  it('is disabled (null) until a number is typed: steppers never invent a value', () => {
    expect(stepValue('', 'pulse', 1)).toBeNull();
    expect(stepValue('abc', 'pulse', -1)).toBeNull();
  });

  it.each([
    ['72', 'pulse', 1, '73'],
    ['72', 'pulse', -1, '71'],
    ['36.8', 'temperature', 1, '36.9'],
    ['36.1', 'temperature', 1, '36.2'],
    ['37', 'temperature', -1, '36.9'],
    ['36,8', 'temperature', 1, '36.9'],
    ['0', 'respiration_rate', -1, '0'],
    ['0.05', 'temperature', -1, '0.0'],
  ] as const)('%s %s %i -> %s', (text, field, dir, out) => {
    expect(stepValue(text, field, dir)).toBe(out);
  });
});
