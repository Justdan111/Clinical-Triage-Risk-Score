import { createScoreClient, type FetchLike, type ScoreOutcome } from './client';
import type { VitalsRequest } from './types';

const VITALS: VitalsRequest = {
  respiration_rate: 8,
  spo2: 97,
  systolic_bp: 120,
  pulse: 72,
  consciousness: 'alert',
  temperature: 36.8,
  on_supplemental_oxygen: false,
};

type Call = { url: string; init: Parameters<FetchLike>[1] };

/** A fake fetch that answers every request with `status` and raw body text. */
function fakeFetch(status: number, body: string): { fn: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return { status, text: async () => body };
  };
  return { fn, calls };
}

function scoreWith(status: number, body: string): Promise<ScoreOutcome> {
  return createScoreClient({ baseUrl: 'http://api.test', fetchFn: fakeFetch(status, body).fn })(VITALS);
}

// Response bodies captured verbatim from the running Go backend (Day 2 curl run).
const EXAMPLES = {
  low: '{"total":1,"band":"low","drivers":[{"parameter":"pulse","value":95,"points":1}]}\n',
  red_flagged: '{"total":3,"band":"red_flagged","drivers":[{"parameter":"respiration_rate","value":8,"points":3}]}\n',
  medium:
    '{"total":5,"band":"medium","drivers":[{"parameter":"spo2","value":91,"points":3},{"parameter":"on_supplemental_oxygen","value":true,"points":2}]}\n',
  high: '{"total":7,"band":"high","drivers":[{"parameter":"respiration_rate","value":25,"points":3},{"parameter":"spo2","value":93,"points":2},{"parameter":"pulse","value":120,"points":2}]}\n',
} as const;

describe('successful responses', () => {
  it.each(Object.entries(EXAMPLES))('parses the %s example', async (band, body) => {
    const outcome = await scoreWith(200, body);
    expect(outcome).toEqual({ kind: 'ok', result: JSON.parse(body) });
    if (outcome.kind === 'ok') expect(outcome.result.band).toBe(band);
  });

  it('parses a minimal result with a note and empty drivers', async () => {
    const outcome = await scoreWith(200, '{"total":0,"band":"low","drivers":[],"note":"minimal: no parameter scored above zero"}');
    expect(outcome).toEqual({
      kind: 'ok',
      result: { total: 0, band: 'low', drivers: [], note: 'minimal: no parameter scored above zero' },
    });
  });

  it('parses a consciousness driver whose value is a string', async () => {
    const outcome = await scoreWith(
      200,
      '{"total":3,"band":"red_flagged","drivers":[{"parameter":"consciousness","value":"new_confusion","points":3}]}',
    );
    expect(outcome.kind).toBe('ok');
  });
});

describe('request', () => {
  it('POSTs JSON to /score, tolerating a trailing slash in the base URL', async () => {
    const { fn, calls } = fakeFetch(200, EXAMPLES.low);
    await createScoreClient({ baseUrl: 'http://192.168.1.20:8080/', fetchFn: fn })(VITALS);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://192.168.1.20:8080/score');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0].init.body)).toEqual(VITALS);
  });
});

describe('400 with field errors', () => {
  it('maps a range/missing validation error to fieldErrors by field name', async () => {
    const body =
      '{"error":"one or more vitals are missing or invalid","code":"validation_failed","fields":[{"field":"spo2","message":"must be between 50 and 100 %, got 101"},{"field":"on_supplemental_oxygen","message":"is required"}]}';
    expect(await scoreWith(400, body)).toEqual({
      kind: 'validation',
      message: 'one or more vitals are missing or invalid',
      fieldErrors: { spo2: 'must be between 50 and 100 %, got 101', on_supplemental_oxygen: 'is required' },
    });
  });

  it('maps a wrong-type error to the named field', async () => {
    const body =
      '{"error":"one or more vitals have the wrong type","code":"validation_failed","fields":[{"field":"pulse","message":"has the wrong type; expected a whole number"}]}';
    const outcome = await scoreWith(400, body);
    expect(outcome.kind).toBe('validation');
    if (outcome.kind === 'validation') expect(Object.keys(outcome.fieldErrors)).toEqual(['pulse']);
  });
});

describe('JSON errors without field errors', () => {
  it.each([
    [400, '{"error":"request body is not valid JSON","code":"invalid_json"}', 'request body is not valid JSON'],
    [413, '{"error":"request body is too large","code":"body_too_large"}', 'request body is too large'],
    [415, '{"error":"Content-Type must be application/json","code":"unsupported_media_type"}', 'Content-Type must be application/json'],
    [500, '{"error":"internal error","code":"internal"}', 'internal error'],
  ])('HTTP %d is a server error with the server message', async (status, body, message) => {
    expect(await scoreWith(status, body)).toEqual({ kind: 'server', status, message });
  });
});

describe('non-JSON or unreadable responses', () => {
  it.each([
    [404, '404 page not found\n'], // Go ServeMux, wrong path
    [405, 'Method Not Allowed\n'], // Go ServeMux, wrong method
    [502, '<html><body>Bad Gateway</body></html>'], // a proxy in front of the API
    [500, ''], // empty body
  ])('HTTP %d with a non-JSON body is unexpected, not a crash', async (status, body) => {
    const outcome = await scoreWith(status, body);
    expect(outcome.kind).toBe('unexpected');
    if (outcome.kind === 'unexpected') {
      expect(outcome.status).toBe(status);
      expect(outcome.message).toContain(String(status));
    }
  });

  it.each([
    [404, '{"error":"not found","code":"not_found"}'],
    [405, '{"error":"method not allowed","code":"method_not_allowed"}'],
  ])('a JSON routing error (HTTP %d) is unexpected: the URL is wrong', async (status, body) => {
    const outcome = await scoreWith(status, body);
    expect(outcome.kind).toBe('unexpected');
    if (outcome.kind === 'unexpected') expect(outcome.message).toContain('EXPO_PUBLIC_API_URL');
  });

  it('a JSON error body of the wrong shape is unexpected', async () => {
    expect((await scoreWith(400, '{"message":"nope"}')).kind).toBe('unexpected');
  });

  it.each([
    ['not JSON', 'OK'],
    ['unknown band', '{"total":9,"band":"critical","drivers":[]}'],
    ['drivers null', '{"total":0,"band":"low","drivers":null}'],
    ['driver value is an object', '{"total":1,"band":"low","drivers":[{"parameter":"pulse","value":{},"points":1}]}'],
  ])('a 200 that is not a valid result (%s) is unexpected', async (_name, body) => {
    expect((await scoreWith(200, body)).kind).toBe('unexpected');
  });
});

describe('network failure and timeout', () => {
  it('a rejected fetch is a network error that names the URL', async () => {
    const failing: FetchLike = async () => {
      throw new TypeError('Network request failed');
    };
    const outcome = await createScoreClient({ baseUrl: 'http://10.0.2.2:8080', fetchFn: failing })(VITALS);
    expect(outcome.kind).toBe('network');
    if (outcome.kind === 'network') expect(outcome.message).toContain('http://10.0.2.2:8080');
  });

  it('a request with no response before the deadline times out and is aborted', async () => {
    let aborted = false;
    const hanging: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('aborted'));
        });
      });
    const outcome = await createScoreClient({ baseUrl: 'http://api.test', timeoutMs: 20, fetchFn: hanging })(VITALS);
    expect(outcome.kind).toBe('timeout');
    expect(aborted).toBe(true);
  });

  it('a body that stalls after the headers also times out', async () => {
    const stalledBody: FetchLike = async (_url, init) => ({
      status: 200,
      text: () =>
        new Promise<string>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    });
    const outcome = await createScoreClient({ baseUrl: 'http://api.test', timeoutMs: 20, fetchFn: stalledBody })(VITALS);
    expect(outcome.kind).toBe('timeout');
  });
});

describe('configuration', () => {
  it.each([undefined, '', '   '])('a missing base URL (%p) is a config error and makes no request', async (baseUrl) => {
    const { fn, calls } = fakeFetch(200, EXAMPLES.low);
    const outcome = await createScoreClient({ baseUrl, fetchFn: fn })(VITALS);
    expect(outcome.kind).toBe('config');
    expect(calls).toHaveLength(0);
  });
});
