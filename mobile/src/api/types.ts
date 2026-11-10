// Types mirroring the Go backend's JSON contract exactly.
// Source of truth: backend/internal/triage/vitals.go, scoring.go and
// backend/internal/api/handlers.go. If those change, change this file.

/** ACVPU levels, spelled exactly as the API accepts them. */
export const CONSCIOUSNESS_LEVELS = [
  'alert',
  'new_confusion',
  'voice',
  'pain',
  'unresponsive',
] as const;
export type Consciousness = (typeof CONSCIOUSNESS_LEVELS)[number];

/** Request body for POST /score. Every field is required by the server. */
export interface VitalsRequest {
  respiration_rate: number;
  spo2: number;
  systolic_bp: number;
  pulse: number;
  consciousness: Consciousness;
  temperature: number;
  on_supplemental_oxygen: boolean;
}

/** The JSON field names of the request; also the `parameter` names in drivers. */
export type VitalsField = keyof VitalsRequest;

export const VITALS_FIELDS: readonly VitalsField[] = [
  'respiration_rate',
  'spo2',
  'systolic_bp',
  'pulse',
  'consciousness',
  'temperature',
  'on_supplemental_oxygen',
];

export const BANDS = ['low', 'red_flagged', 'medium', 'high'] as const;
export type Band = (typeof BANDS)[number];

export interface Driver {
  parameter: string; // a VitalsField in practice; kept as string so a new server field can't break parsing
  value: number | string | boolean;
  points: number;
}

/** 200 response from POST /score. */
export interface ScoreResult {
  total: number;
  band: Band;
  drivers: Driver[];
  note?: string;
}

/** One entry of `fields` in a 400 response. */
export interface FieldError {
  field: string;
  message: string;
}

/** JSON body of every non-2xx response the backend itself produces. */
export interface ErrorResponse {
  error: string;
  code: string;
  fields?: FieldError[];
}
