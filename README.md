# Clinical Triage Risk Score

> [!WARNING]
> **Not for clinical use.** This is a portfolio project that implements a published
> clinical scoring standard for demonstration purposes only. It is **not a certified
> medical device**, has **not been clinically validated**, and must **never** be used to
> make decisions about real patients. If you are worried about a patient, follow your
> local escalation policy and ask a clinician.

Given a patient's vital signs, this API calculates their **NEWS2** (National Early Warning
Score 2) and explains which vitals drove the result, to show who needs urgent attention
first. It implements a real, published standard from the Royal College of Physicians
rather than an invented score.

## What it does

`POST /score` takes seven observations and returns:

- **total**: the aggregate NEWS2 score
- **band**: `low`, `red_flagged`, `medium` or `high`
- **drivers**: every parameter that scored above zero, highest points first, with the
  value that caused the points. The API never returns a bare number without the reasons
  behind it.

### Bands

Bands are checked in this order, and the first one that matches wins:

| Order | Condition | Band | RCP clinical risk |
|---|---|---|---|
| 1 | Aggregate ≥ 7 | `high` | High: urgent or emergency response |
| 2 | Aggregate 5–6 | `medium` | Medium: key threshold for urgent response |
| 3 | Any single parameter scored 3 | `red_flagged` | Low–medium: urgent ward-based response |
| 4 | Otherwise (aggregate 0–4) | `low` | Low: ward-based response |

The RCP chart doesn't say what to do when an aggregate of 5–6 includes a single 3. This
project reports `medium`, the more urgent response, and still lists the parameter that
scored 3 in the drivers. An aggregate of 0 adds a `"minimal"` note.

## Scope and limitations

- **NEWS2 Scale 1 only.** Scale 2 is for patients with a prescribed lower oxygen-saturation
  target (for example hypercapnic respiratory failure in COPD). It needs clinical context
  this API doesn't have, so it isn't implemented. Scoring a Scale 2 patient on Scale 1 can
  overstate their risk.
- **Adults only.** NEWS2 is not intended for children or pregnant women.
- **Stateless.** There's no patient history, no trends, no authentication and no storage.
  Each request is scored on its own.
- **No machine learning.** This is a rules-based implementation of a published table, not
  a prediction model.
- **Consciousness** uses ACVPU. `new_confusion` means *new* confusion only, not a
  patient's long-standing baseline.

## Source

Scoring follows the Royal College of Physicians,
[*National Early Warning Score (NEWS) 2*](https://www.rcp.ac.uk/resources/national-early-warning-score-news-2/)
(2017): Chart 1, *The NEWS scoring system*, and Chart 2, *NEWS thresholds and triggers*.
NEWS2 © Royal College of Physicians. The scoring table in the code was checked row by row
against the official Chart 1 PDF.

## API

### `GET /health`

```json
{"status":"ok"}
```

### `POST /score`

Request (`Content-Type: application/json`, every field required):

```json
{
  "respiration_rate": 25,
  "spo2": 93,
  "systolic_bp": 120,
  "pulse": 120,
  "consciousness": "alert",
  "temperature": 36.8,
  "on_supplemental_oxygen": false
}
```

| Field | Type | Accepted range |
|---|---|---|
| `respiration_rate` | integer, breaths/min | 0–80 |
| `spo2` | integer, % | 50–100 |
| `systolic_bp` | integer, mmHg | 40–300 |
| `pulse` | integer, beats/min | 0–300 |
| `consciousness` | string | `alert`, `new_confusion`, `voice`, `pain`, `unresponsive` |
| `temperature` | number, °C, at most one decimal place | 25.0–45.0 |
| `on_supplemental_oxygen` | boolean | `true` / `false` |

The ranges reject values that are physically impossible or very likely typos or unit
mistakes, such as a temperature entered in Fahrenheit. They never reject a value that is
abnormal but possible: those are exactly the values NEWS2 needs to score.

Response `200 OK`:

```json
{
  "total": 7,
  "band": "high",
  "drivers": [
    {"parameter": "respiration_rate", "value": 25, "points": 3},
    {"parameter": "spo2", "value": 93, "points": 2},
    {"parameter": "pulse", "value": 120, "points": 2}
  ]
}
```

`drivers` is always an array. It is `[]` when nothing scored.

### Errors

Every error uses the same JSON shape. Clients should branch on `code` and `fields`, not on
the human-readable `error` text, which may change.

```json
{
  "error": "one or more vitals are missing or invalid",
  "code": "validation_failed",
  "fields": [
    {"field": "spo2", "message": "must be between 50 and 100 %, got 101"},
    {"field": "on_supplemental_oxygen", "message": "is required"}
  ]
}
```

| Status | `code` | Cause |
|---|---|---|
| 400 | `validation_failed` | Missing field, out-of-range value, or wrong type (`fields` names each one) |
| 400 | `invalid_json` | Malformed or empty body, or extra data after the JSON object |
| 413 | `body_too_large` | Body over 4 KiB |
| 415 | `unsupported_media_type` | `Content-Type` is not `application/json` |

A wrong HTTP method returns `405` and an unknown path returns `404`. Both come from Go's
router and are plain text, not JSON.

## Running locally

Requires Go 1.25 or newer. The API uses only the standard library, with no third-party
dependencies.

```sh
cd backend
go run ./cmd/server           # listens on :8080; set PORT to change it
```

```sh
curl localhost:8080/health

curl -X POST localhost:8080/score \
  -H 'Content-Type: application/json' \
  -d '{"respiration_rate":8,"spo2":97,"systolic_bp":120,"pulse":72,"consciousness":"alert","temperature":36.8,"on_supplemental_oxygen":false}'
# {"total":3,"band":"red_flagged","drivers":[{"parameter":"respiration_rate","value":8,"points":3}]}
```

### Tests

```sh
cd backend
gofmt -l . && go vet ./... && go test ./...
```

The tests check both sides of every band edge in the RCP chart, every band-precedence
branch, and the exact JSON response shape. Their expected values were taken from the
chart, not from the code. A planted-bug run (25 deliberate off-by-one and wrong-row bugs)
caught 24. The one survivor provably can't change the result for any input the API
accepts.

## Project structure

```
backend/
  cmd/server/main.go         HTTP server: PORT config, timeouts, graceful shutdown
  internal/api/              HTTP layer: routing, JSON decoding, error responses
  internal/triage/           Domain: Vitals validation and NEWS2 scoring (no HTTP)
docs/PROJECT.MD              Project plan and scope
```

## Status

- [x] Go API skeleton and input validation
- [x] NEWS2 Scale 1 scoring
- [ ] React Native / Expo mobile client
- [ ] Hardening
- [ ] Deployment

## Disclaimer (again)

This software is provided for educational and demonstration purposes only. It is not a
medical device, has not been reviewed by any regulator, and comes with no warranty of
correctness or fitness for any purpose. Do not use it for real patient care.
