// Runtime checks for JSON from the network. `JSON.parse` returns `unknown`
// as far as we're concerned; these functions are the only way that data
// becomes a typed ScoreResult / ErrorResponse. They return null rather than
// throwing, so a surprising response can never crash a screen.

import { BANDS, type Band, type Driver, type ErrorResponse, type FieldError, type ScoreResult } from './types';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isBand(v: unknown): v is Band {
  return typeof v === 'string' && (BANDS as readonly string[]).includes(v);
}

function isInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function parseDriver(v: unknown): Driver | null {
  if (!isRecord(v)) return null;
  const { parameter, value, points } = v;
  if (typeof parameter !== 'string' || !isInteger(points)) return null;
  if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') return null;
  return { parameter, value, points };
}

/** Validates a parsed 200 body. Returns null if it isn't a ScoreResult. */
export function parseScoreResult(v: unknown): ScoreResult | null {
  if (!isRecord(v)) return null;
  const { total, band, drivers, note } = v;
  if (!isInteger(total) || !isBand(band) || !Array.isArray(drivers)) return null;
  if (note !== undefined && typeof note !== 'string') return null;

  const parsed: Driver[] = [];
  for (const d of drivers) {
    const driver = parseDriver(d);
    if (driver === null) return null;
    parsed.push(driver);
  }
  return note === undefined ? { total, band, drivers: parsed } : { total, band, drivers: parsed, note };
}

function parseFieldError(v: unknown): FieldError | null {
  if (!isRecord(v)) return null;
  const { field, message } = v;
  if (typeof field !== 'string' || typeof message !== 'string') return null;
  return { field, message };
}

/** Validates a parsed error body. Returns null if it isn't the backend's ErrorResponse shape. */
export function parseErrorResponse(v: unknown): ErrorResponse | null {
  if (!isRecord(v)) return null;
  const { error, code, fields } = v;
  if (typeof error !== 'string' || typeof code !== 'string') return null;
  if (fields === undefined) return { error, code };
  if (!Array.isArray(fields)) return null;

  const parsed: FieldError[] = [];
  for (const f of fields) {
    const fe = parseFieldError(f);
    if (fe === null) return null;
    parsed.push(fe);
  }
  return { error, code, fields: parsed };
}

/** JSON.parse that returns undefined instead of throwing on non-JSON text. */
export function tryParseJSON(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
