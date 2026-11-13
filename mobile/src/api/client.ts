import { parseErrorResponse, parseScoreResult, tryParseJSON } from './parse';
import type { ScoreResult, VitalsRequest } from './types';

/** Every way a /score call can end. The client never throws; screens switch on `kind`. */
export type ScoreOutcome =
  | { kind: 'ok'; result: ScoreResult }
  /** 400 with field errors: show each message next to its input. */
  | { kind: 'validation'; message: string; fieldErrors: Record<string, string> }
  /** No response at all: server down, wrong URL, no Wi-Fi, cleartext blocked. */
  | { kind: 'network'; message: string }
  /** The server didn't answer within the timeout. */
  | { kind: 'timeout'; message: string }
  /** A JSON error from the backend without field errors (invalid_json, 413, 415, 500). */
  | { kind: 'server'; status: number; message: string }
  /** A response that means "wrong server": a non-JSON error body, a 404/405,
   *  or a 200 whose body isn't a valid ScoreResult. */
  | { kind: 'unexpected'; status: number; message: string }
  /** EXPO_PUBLIC_API_URL is not set. */
  | { kind: 'config'; message: string };

/** The subset of fetch the client uses, so tests can pass a fake without casts. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number; text(): Promise<string> }>;

export interface ClientOptions {
  baseUrl: string | undefined;
  timeoutMs?: number;
  fetchFn?: FetchLike;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

export function createScoreClient({ baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS, fetchFn = fetch }: ClientOptions) {
  return async function score(vitals: VitalsRequest): Promise<ScoreOutcome> {
    const base = baseUrl?.trim().replace(/\/+$/, '');
    if (!base) {
      return {
        kind: 'config',
        message: 'The app has no server address. Set EXPO_PUBLIC_API_URL in mobile/.env and restart Expo.',
      };
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    let status: number;
    let text: string;
    try {
      const res = await fetchFn(`${base}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(vitals),
        signal: controller.signal,
      });
      status = res.status;
      text = await res.text(); // inside the try: a stalled body also hits the timeout
    } catch {
      // We set `timedOut` ourselves, so there's no need to inspect the error
      // type (AbortError naming differs between platforms).
      return timedOut
        ? { kind: 'timeout', message: `The server didn't respond within ${Math.round(timeoutMs / 1000)} seconds. Try again.` }
        : { kind: 'network', message: `Can't reach the server at ${base}. Check the address and that your phone and computer are on the same network.` };
    } finally {
      clearTimeout(timer);
    }

    const body = tryParseJSON(text);

    if (status === 200) {
      const result = parseScoreResult(body);
      return result
        ? { kind: 'ok', result }
        : { kind: 'unexpected', status, message: 'The server sent a result the app could not read.' };
    }

    const err = parseErrorResponse(body);
    // A non-JSON body (a proxy page, or an older backend's plain-text 404/405)
    // or a JSON 404/405 from this backend all mean the app is pointing at the
    // wrong address, not that the vitals were wrong.
    if (err === null || err.code === 'not_found' || err.code === 'method_not_allowed') {
      return {
        kind: 'unexpected',
        status,
        message: `Unexpected response from the server (HTTP ${status}). Check that EXPO_PUBLIC_API_URL points at the triage API.`,
      };
    }

    if (status === 400 && err.fields && err.fields.length > 0) {
      const fieldErrors: Record<string, string> = {};
      for (const f of err.fields) {
        fieldErrors[f.field] = f.message;
      }
      return { kind: 'validation', message: err.error, fieldErrors };
    }

    return { kind: 'server', status, message: err.error };
  };
}

/** The app's client, configured from the environment. EXPO_PUBLIC_ variables are
 *  inlined at build time, so this must be a literal `process.env.EXPO_PUBLIC_…` access. */
export const scoreVitals = createScoreClient({ baseUrl: process.env.EXPO_PUBLIC_API_URL });
