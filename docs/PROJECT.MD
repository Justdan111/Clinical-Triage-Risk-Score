# Clinical Triage Risk Score

_Last updated: 2026-11-10 — toolchain refreshed to Expo SDK 58 and Go 1.27; NEWS2 table corrected (see Changelog at the bottom)._

## The real problem
Given a patient's vitals, flag who needs urgent attention before a clinician reviews the full
chart — using a real, published clinical standard (NEWS2), not an invented scoring scheme.

## Scope (MVP — do not exceed)
- Implement NEWS2 **Scale 1** only (the standard scale; Scale 2, for patients with a
  COPD-type prescribed oxygen target, needs clinical context this project doesn't have — state
  that as a limitation, don't build it)
- Six vitals in: respiration rate, SpO2, systolic BP, pulse, consciousness (Alert vs.
  Confused/Voice/Pain/Unresponsive), temperature — plus whether the patient is on supplemental
  oxygen
- Correct NEWS2 scoring per parameter (table below), correct aggregate, **and the red-score
  rule**: any single parameter scoring 3 means urgent, regardless of the total
- Output: total score, the band (Low / Red-flagged / Medium / High), and which specific
  vital(s) drove the result — never a bare number with no explanation
- Go API, RN/Expo mobile client
- Stateless: no patient history, no auth, no persistence — a single vitals-in,
  score-and-reasoning-out call. No database needed for this project.

## NEWS2 Scale 1 scoring (Royal College of Physicians, 2017)

> **Verify before you write tests.** This table was corrected on 2026-11-10 (the previous
> version had several rows shifted by one column). It was cross-checked against a second
> published copy, but the ground truth is the official RCP NEWS2 chart. Before Day 2, open the
> RCP chart yourself and confirm every row below. If anything differs, the RCP chart wins and
> this file gets fixed.

One row per band, so nothing depends on how a markdown table renders.

| Parameter | Value | Points |
|---|---|---|
| Respiration (/min) | ≤ 8 | 3 |
| | 9–11 | 1 |
| | 12–20 | 0 |
| | 21–24 | 2 |
| | ≥ 25 | 3 |
| SpO2 Scale 1 (%) | ≤ 91 | 3 |
| | 92–93 | 2 |
| | 94–95 | 1 |
| | ≥ 96 | 0 |
| Air or oxygen | Air | 0 |
| | Supplemental oxygen | 2 |
| Systolic BP (mmHg) | ≤ 90 | 3 |
| | 91–100 | 2 |
| | 101–110 | 1 |
| | 111–219 | 0 |
| | ≥ 220 | 3 |
| Pulse (/min) | ≤ 40 | 3 |
| | 41–50 | 1 |
| | 51–90 | 0 |
| | 91–110 | 1 |
| | 111–130 | 2 |
| | ≥ 131 | 3 |
| Consciousness | Alert | 0 |
| | Confusion (new), Voice, Pain, Unresponsive (CVPU) | 3 |
| Temperature (°C) | ≤ 35.0 | 3 |
| | 35.1–36.0 | 1 |
| | 36.1–38.0 | 0 |
| | 38.1–39.0 | 1 |
| | ≥ 39.1 | 2 |

The supplemental-oxygen **+2** is its own row, added to the aggregate like any other parameter.
Temperature and pulse have gaps between bands only because of decimal/integer inputs — decide
and document how a value like 36.05 °C is handled (recommended: reject more than one decimal
place at the API boundary, so the bands are exhaustive).

**Bands and precedence** (this is a design decision, so write it into the code comments and
test every branch):
1. Aggregate ≥ 7 → **High** (emergency-level response)
2. Else aggregate 5–6 → **Medium** (urgent clinical review)
3. Else any single parameter scoring 3 → **Red-flagged** (urgent review even though the total is
   low; the RCP's "low-medium" case, e.g. total 3 with respiration rate 8)
4. Else aggregate 1–4 → **Low**; aggregate 0 → **Low** with a "minimal" note

If the aggregate is 5–6 *and* a single parameter scored 3, report **Medium** but still list the
red-flagging parameter in the drivers. The result lists every parameter that scored above zero,
highest points first.

## What's explicitly OUT of scope
- NEWS2 Scale 2 (COPD/hypercapnic patients)
- Any ML/learned risk model — this is a correct implementation of a published rules-based
  standard, not a prediction model
- Patient history, trends over time, auth, persistence
- Real clinical deployment of any kind

## Non-negotiable disclaimer
This is a portfolio project implementing a real clinical scoring standard for demonstration
purposes. It is not a certified medical device and must never be presented as validated for
real clinical use. State this plainly in the README and in the mobile app itself, not just
buried in a doc.

## Stack — re-checked 2026-11-10

### Backend: Go 1.27, standard library `net/http` only
No Gin/Chi/Echo. Go 1.22 added method-based routing and path parameters to `net/http` itself
(`mux.HandleFunc("POST /score", ...)`), which is enough for this API and, for someone still
learning API design, a framework would hide exactly the decisions worth making deliberately.

- **Version:** Go 1.27 was released 2026-08-19; the latest patch at the time of writing is
  1.27.3 (2026-10-19). Go 1.26 (latest 1.26.10) is still supported. Run `go version` and use the
  installed toolchain; `go.mod` must be `go 1.22` or newer. Don't hard-pin a patch version from
  this file — it will go stale.
- **Tests:** standard `testing` package, table-driven tests for every band boundary.
  `testify` is fine if assertion boilerplate gets tedious. Go 1.27 adds
  `httptest.NewTestServer`, but plain `httptest.NewRecorder` is enough here.
- **Logging:** `log/slog`, not `fmt.Println`.
- **Things in Go 1.27 that touch this project:**
  - `encoding/json` is now backed by the new v2 implementation. Behaviour is preserved, but
    **error message text may differ**, so tests must assert on status code and error *field*,
    not on exact JSON-library error strings. Duplicate keys and invalid UTF-8 in request bodies
    are rejected under the v2 defaults.
  - `go vet` now flags `%w` wrapping a pointer-to-error type. Wrap plain `error` values.
  - `gofmt` alignment logic changed, so reformatting may show small whitespace diffs. Run it
    once at the start and commit.
  - `go mod tidy` on a `go 1.27` module groups requires into direct and indirect blocks.
  - Generic methods are now allowed, but this project doesn't need generics. Don't add them.
- **Deploy (Render):** check which Go version Render's native Go runtime supports. If it lags
  1.27, use a small Dockerfile (`golang:1.27` build stage) instead of fighting the buildpack.

### Frontend: Expo SDK 58 (React Native 0.88, React 19.3)
SDK 58 was announced 2026-10-15 and is the current release. The previous version of this file
said SDK 57 was current and 58 was beta-only; that is no longer true.

- `npx create-expo-app@latest` picks up SDK 58.
- **Node:** 22.13+ (22 line), 24.3+ (24 line) or 26+. Odd-numbered Node releases (23, 25) are
  no longer supported — check `node -v` before scaffolding.
- **Expo Go caveat:** at release, the SDK 58 build of Expo Go was "due within a few weeks". Test
  early whether the Expo Go on your phone opens the project. If it doesn't, use a development
  build (`npx expo run:android` / `run:ios`), or fall back to SDK 57 for this project
  (`npx create-expo-app@latest --template default@sdk-57` — confirm the tag name in the Expo
  docs). Don't lose a day to this.
- **iOS:** SDK 58 builds against the iOS 27 SDK and prebuild now generates a
  `SceneDelegate.swift` (scene-based lifecycle). Don't hand-edit the `ios/` folder; let prebuild
  own it.
- **Android:** R8 minification is now on by default for release builds. Test a *release* build
  once before Day 5, not only the dev build.
- **Strict TypeScript API is now the default (React Native 0.87+):** no deep imports from
  `react-native/Libraries/*`, and refs use instance types (e.g. `ViewInstance`).
- **Removed or deprecated in this range, avoid in new code:** `InteractionManager` (use
  `requestIdleCallback`), `StatusBar` props `backgroundColor`/`translucent`, the `animated` prop
  on `Modal`, `ImageBackground` (deprecated).
- **Expo Router (if used):** `expo-router/unstable-native-tabs` became `expo-router/native-tabs`.
  This app is a form plus a result screen, so plain stack navigation is plenty.
- **New Architecture:** mandatory since SDK 55 (carried over from the previous version of this
  file; nothing in the SDK 58 notes changes it). It doesn't affect a form-and-result app.
- Still in flux in SDK 58: Expo Modules 2.0 is beta and the Rust transformer is experimental.
  Don't opt into either.

## Day-by-day
- **Day 1:** Go project setup, API skeleton, vitals input struct/validation, a `/health` route
  — no scoring logic yet, just proving the API plumbing works
- **Day 2:** the actual NEWS2 scoring logic — per-parameter scoring, aggregate, the red-score
  rule, oxygen uplift, and the band precedence above. Test every band boundary explicitly (this
  is exactly the kind of off-by-one-prone table that needs boundary tests, same discipline as
  every project so far). **Start by verifying the table against the official RCP chart.**
- **Day 3:** RN/Expo mobile app — vitals entry form, color-coded result display showing the
  band AND which vitals drove it. First thing: confirm Expo Go (or a dev build) opens an SDK 58
  project on your phone.
- **Day 4:** hardening — physiologically impossible inputs rejected clearly, missing-field
  handling, tests for every documented band boundary and the red-score interaction
  specifically; one release-build run on Android (R8)
- **Day 5:** deploy (Render, same pattern as before) + README with the disclaimer + demo

## Changelog (2026-11-10)
- Expo SDK 57 → **58** (RN 0.86 → 0.88, React 19.2 → 19.3); Node floor and Expo Go caveat added;
  breaking changes relevant to this app listed.
- Go "1.22+, use what's installed" → current is **1.27.3**; added the 1.27 changes that touch an
  API like this (JSON v2 backing, vet `%w` check, gofmt, `go mod tidy`).
- **NEWS2 table corrected.** The old table was misaligned: it scored respiration 21–24 as 1
  (should be 2), systolic 91–100 as 1 and 101–110 as 0 (should be 2 and 1), temperature ≥ 39.1
  as 3 (should be 2), and the pulse row had an extra column. Replaced with a one-band-per-row
  table.
- Band precedence made explicit (it was ambiguous when a total of 5–6 and a single 3 coincide).
- Removed the Hermes/Reanimated note, which only applied to SDK 56.