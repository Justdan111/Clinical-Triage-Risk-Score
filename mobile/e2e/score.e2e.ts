/**
 * @jest-environment node
 *
 * End-to-end check: sends the four example patients through the app's real
 * API client to a running backend and asserts band and total.
 *
 *   cd backend && go run ./cmd/server          # terminal 1
 *   cd mobile && npm run e2e                   # terminal 2
 *
 * Set E2E_API_URL to test another server (default http://localhost:8080).
 * Not part of `npm test`: the file name doesn't match Jest's default pattern.
 */
import http from 'node:http';
import https from 'node:https';

import { createScoreClient, type FetchLike } from '@/api/client';
import type { Band, VitalsRequest } from '@/api/types';

const BASE_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';

// jest-expo replaces global fetch with a mock, so make real requests with
// node:http(s). Same FetchLike shape the app's client already accepts.
const nodeFetch: FetchLike = (url, init) =>
  new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.request(url, { method: init.method, headers: init.headers, signal: init.signal }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text: async () => Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(init.body);
  });

const score = createScoreClient({ baseUrl: BASE_URL, fetchFn: nodeFetch });

const NORMAL: VitalsRequest = {
  respiration_rate: 16,
  spo2: 97,
  systolic_bp: 120,
  pulse: 72,
  consciousness: 'alert',
  temperature: 36.8,
  on_supplemental_oxygen: false,
};

// The four example patients from the Day 2 curl examples and the README.
const PATIENTS: { name: string; vitals: VitalsRequest; band: Band; total: number; drivers: string[] }[] = [
  {
    name: 'Low',
    vitals: { ...NORMAL, respiration_rate: 18, spo2: 96, systolic_bp: 115, pulse: 95, temperature: 37.2 },
    band: 'low',
    total: 1,
    drivers: ['pulse'],
  },
  {
    name: 'Red-flagged',
    vitals: { ...NORMAL, respiration_rate: 8 },
    band: 'red_flagged',
    total: 3,
    drivers: ['respiration_rate'],
  },
  {
    name: 'Medium',
    vitals: { ...NORMAL, spo2: 91, on_supplemental_oxygen: true },
    band: 'medium',
    total: 5,
    drivers: ['spo2', 'on_supplemental_oxygen'],
  },
  {
    name: 'High',
    vitals: { ...NORMAL, respiration_rate: 25, spo2: 93, pulse: 120 },
    band: 'high',
    total: 7,
    drivers: ['respiration_rate', 'spo2', 'pulse'],
  },
];

beforeAll(async () => {
  // Fail once, clearly, if no server is running, instead of four timeouts.
  const health = await new Promise<number>((resolve) => {
    const lib = BASE_URL.startsWith('https:') ? https : http;
    lib
      .get(`${BASE_URL.replace(/\/+$/, '')}/health`, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      })
      .on('error', () => resolve(0));
  });
  if (health !== 200) {
    throw new Error(`No healthy API at ${BASE_URL} (GET /health -> ${health || 'no response'}). Start it with: cd backend && go run ./cmd/server`);
  }
});

describe(`POST ${BASE_URL}/score`, () => {
  it.each(PATIENTS)('$name patient -> $band, total $total', async ({ vitals, band, total, drivers }) => {
    const outcome = await score(vitals);
    if (outcome.kind !== 'ok') throw new Error(`expected ok, got ${outcome.kind}: ${outcome.message}`);
    expect(outcome.result.band).toBe(band);
    expect(outcome.result.total).toBe(total);
    expect(outcome.result.drivers.map((d) => d.parameter)).toEqual(drivers);
  });

  it('invalid vitals come back as field errors', async () => {
    const outcome = await score({ ...NORMAL, spo2: 101, temperature: 36.85 });
    if (outcome.kind !== 'validation') throw new Error(`expected validation, got ${outcome.kind}`);
    expect(Object.keys(outcome.fieldErrors)).toEqual(['spo2', 'temperature']);
  });
});
