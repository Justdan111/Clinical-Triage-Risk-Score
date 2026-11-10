# NEWS2 Triage: mobile app

> [!WARNING]
> **Not for clinical use.** This is a portfolio demo, not a medical device, and it has not
> been validated for clinical use. The app shows this disclaimer on every screen.

An Expo (SDK 58, React Native 0.88) client for the Go API in [`../backend`](../backend). You
enter a patient's vitals, the app sends them to `POST /score`, and the result screen shows
the NEWS2 band, the total and which vitals drove the score.

## Setup

Requires Node 22.13+, 24.3+ or 26+. Odd-numbered Node versions are not supported by SDK 58.

```sh
cd mobile
npm install
cp .env.example .env.local    # then set EXPO_PUBLIC_API_URL (see Networking)
npx expo start
```

Scan the QR code with **Expo Go** (version 58.x from the App Store or Play Store) or with
the iOS Camera app. Start the backend first: `cd backend && go run ./cmd/server`.

`EXPO_PUBLIC_API_URL` is **inlined into the bundle when Metro builds it**; it is not read
at runtime. After changing it, restart Expo with `npx expo start --clear`. A plain reload
keeps the old value. `.env.local` is git-ignored, so your LAN IP stays out of the repo.

## Networking

The address in `EXPO_PUBLIC_API_URL` depends on where the app runs:

| App running on | `EXPO_PUBLIC_API_URL` | Why |
|---|---|---|
| iOS Simulator | `http://localhost:8080` | The simulator shares your Mac's network. |
| Android Emulator | `http://10.0.2.2:8080` | Inside the emulator, `localhost` is the emulator itself; `10.0.2.2` is your computer. |
| Physical phone (Expo Go) | `http://<your computer's LAN IP>:8080`, e.g. `http://192.168.1.20:8080` | The phone must be on the **same Wi-Fi** as your computer. Find the IP with `ipconfig getifaddr en0` (macOS). |
| Deployed backend (Render) | `https://<your-service>.onrender.com` | Use **https**. |

**Plain `http` is fine during development**, because Expo Go allows it. A standalone
**release build blocks plain http by default** (Android blocks cleartext traffic and iOS
App Transport Security blocks insecure loads), so a release build must point at the
https Render URL.

If the app says it **can't reach the server**: check that the backend is running, that
the IP and port are right, that your phone is on the same network, and that the macOS
firewall allows incoming connections to the Go binary.

## Error handling

The API client (`src/api/client.ts`) never throws. Every call returns exactly one of these
outcomes, and each one gets its own message on screen:

| Outcome | When | What the user sees |
|---|---|---|
| `ok` | 200 with a valid result | Result screen |
| `validation` | 400 with `fields` | Each server message under the matching input |
| `network` | No response (server down, wrong address, no Wi-Fi) | "Can't reach the server at …" |
| `timeout` | No complete response within 10 s (aborted via `AbortController`) | "The server didn't respond within 10 seconds" |
| `server` | A JSON error without fields (400 `invalid_json`, 413, 415, 500) | The server's message |
| `unexpected` | A non-JSON body (the backend's plain-text 404/405), or a 200 that isn't a valid result | "Unexpected response from the server (HTTP …)" |
| `config` | `EXPO_PUBLIC_API_URL` not set | How to set it |

The server is the source of truth for validation. The app only checks for empty fields,
text that isn't a number, and an unchosen consciousness level. Ranges, whole numbers and
the one-decimal temperature rule all come back from the server and appear next to the
matching input.

## Scripts

```sh
npx tsc --noEmit    # typecheck (strict, no `any`)
npx expo lint       # ESLint with eslint-config-expo
npm test            # Jest (jest-expo): API client, response parsing, labels, form
```

`jest.watchman` is set to `false` in `package.json`. A broken Watchman install can make
Jest exit 0 **without running any tests**; Jest doesn't need Watchman outside watch mode.

## Structure

```
src/
  app/_layout.tsx      Expo Router stack (two screens)
  app/index.tsx        Vitals form
  app/result.tsx       Result: band, total, drivers
  api/types.ts         TypeScript mirror of the Go JSON contract
  api/parse.ts         Runtime validation of response JSON
  api/client.ts        POST /score with timeout and typed outcomes
  triage/form.ts       Form values to request, with light client checks
  triage/labels.ts     Readable names, units, band colours and icons
  components/disclaimer.tsx
```
