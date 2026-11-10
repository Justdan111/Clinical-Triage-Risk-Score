package triage

import (
	"math"
	"slices"
)

// This file implements NEWS2 Scale 1 as published by the Royal College of
// Physicians (Chart 1: The NEWS scoring system, and Chart 2: NEWS thresholds
// and triggers, RCP 2017). Scale 2 (for patients with a prescribed
// hypercapnic oxygen target) is deliberately not implemented.
//
// Each scoreX function is pure: same input, same output, no I/O, no globals.
// Its switch reads top to bottom like the row of the RCP chart. Validate
// guarantees integers and one-decimal temperatures, so "case v <= 11" after
// "case v <= 8" means exactly the 9-11 band: there are no gaps between cases.

// scoreRespirationRate: <=8 -> 3, 9-11 -> 1, 12-20 -> 0, 21-24 -> 2, >=25 -> 3.
func scoreRespirationRate(perMin int) int {
	switch {
	case perMin <= 8:
		return 3
	case perMin <= 11:
		return 1
	case perMin <= 20:
		return 0
	case perMin <= 24:
		return 2
	default:
		return 3
	}
}

// scoreSpO2Scale1: <=91 -> 3, 92-93 -> 2, 94-95 -> 1, >=96 -> 0.
func scoreSpO2Scale1(percent int) int {
	switch {
	case percent <= 91:
		return 3
	case percent <= 93:
		return 2
	case percent <= 95:
		return 1
	default:
		return 0
	}
}

// scoreSupplementalOxygen: oxygen -> 2, air -> 0.
func scoreSupplementalOxygen(onOxygen bool) int {
	if onOxygen {
		return 2
	}
	return 0
}

// scoreSystolicBP: <=90 -> 3, 91-100 -> 2, 101-110 -> 1, 111-219 -> 0, >=220 -> 3.
func scoreSystolicBP(mmHg int) int {
	switch {
	case mmHg <= 90:
		return 3
	case mmHg <= 100:
		return 2
	case mmHg <= 110:
		return 1
	case mmHg <= 219:
		return 0
	default:
		return 3
	}
}

// scorePulse: <=40 -> 3, 41-50 -> 1, 51-90 -> 0, 91-110 -> 1, 111-130 -> 2, >=131 -> 3.
func scorePulse(perMin int) int {
	switch {
	case perMin <= 40:
		return 3
	case perMin <= 50:
		return 1
	case perMin <= 90:
		return 0
	case perMin <= 110:
		return 1
	case perMin <= 130:
		return 2
	default:
		return 3
	}
}

// scoreConsciousness: Alert -> 0; new Confusion, Voice, Pain, Unresponsive -> 3.
func scoreConsciousness(c Consciousness) int {
	if c == ConsciousnessAlert {
		return 0
	}
	return 3
}

// scoreTemperature: <=35.0 -> 3, 35.1-36.0 -> 1, 36.1-38.0 -> 0, 38.1-39.0 -> 1, >=39.1 -> 2.
//
// It compares whole tenths of a degree (36.1 -> 361) rather than floats, so
// band edges are exact integer comparisons with no floating-point surprises.
func scoreTemperature(celsius float64) int {
	tenths := int(math.Round(celsius * 10))
	switch {
	case tenths <= 350:
		return 3
	case tenths <= 360:
		return 1
	case tenths <= 380:
		return 0
	case tenths <= 390:
		return 1
	default:
		return 2
	}
}

// Band is the NEWS2 clinical-risk band for an aggregate result.
type Band string

const (
	BandLow        Band = "low"         // aggregate 0-4, no single 3
	BandRedFlagged Band = "red_flagged" // a single 3 with aggregate 0-4 (RCP: "low-medium")
	BandMedium     Band = "medium"      // aggregate 5-6
	BandHigh       Band = "high"        // aggregate >= 7
)

// NoteMinimal is attached to a Low result whose aggregate is 0.
const NoteMinimal = "minimal: no parameter scored above zero"

// Driver is one parameter that contributed points, with the value that caused them.
type Driver struct {
	Parameter string `json:"parameter"` // JSON field name, e.g. "respiration_rate"
	Value     any    `json:"value"`     // the value as received: number, string or bool
	Points    int    `json:"points"`
}

// Result is the outcome of scoring one set of vitals.
type Result struct {
	Total   int      `json:"total"`
	Band    Band     `json:"band"`
	Drivers []Driver `json:"drivers"` // never nil, so it encodes as [] not null
	Note    string   `json:"note,omitempty"`
}

// Score validates v and, if it is valid, computes its NEWS2 Scale 1 result.
// An invalid v returns the *ValidationError from Validate and a zero Result.
//
// Validating here, not only in the handler, means no caller can ever score
// unchecked vitals (which would also dereference nil pointers and panic).
func Score(v Vitals) (Result, error) {
	if err := v.Validate(); err != nil {
		return Result{}, err
	}

	// Every parameter, in RCP chart order. That order is also the tie-break
	// for drivers with equal points, so output is deterministic.
	all := []Driver{
		{FieldRespirationRate, *v.RespirationRate, scoreRespirationRate(*v.RespirationRate)},
		{FieldSpO2, *v.SpO2, scoreSpO2Scale1(*v.SpO2)},
		{FieldOnSupplementalOxygen, *v.OnSupplementalOxygen, scoreSupplementalOxygen(*v.OnSupplementalOxygen)},
		{FieldSystolicBP, *v.SystolicBP, scoreSystolicBP(*v.SystolicBP)},
		{FieldPulse, *v.Pulse, scorePulse(*v.Pulse)},
		{FieldConsciousness, v.Consciousness, scoreConsciousness(v.Consciousness)},
		{FieldTemperature, *v.Temperature, scoreTemperature(*v.Temperature)},
	}

	res := Result{Drivers: []Driver{}}
	maxSingle := 0
	for _, d := range all {
		res.Total += d.Points
		maxSingle = max(maxSingle, d.Points)
		if d.Points > 0 {
			res.Drivers = append(res.Drivers, d)
		}
	}

	// Highest points first; the stable sort keeps chart order among ties.
	slices.SortStableFunc(res.Drivers, func(a, b Driver) int {
		return b.Points - a.Points
	})

	res.Band = bandFor(res.Total, maxSingle)
	if res.Total == 0 {
		res.Note = NoteMinimal
	}
	return res, nil
}

// bandFor applies the band precedence from PROJECT.md. Order matters: each
// case is only reached if every case above it was false.
//
//  1. aggregate >= 7               -> High
//  2. aggregate 5-6                -> Medium (even if a single parameter
//     scored 3; that parameter still appears in the drivers)
//  3. any single parameter scored 3 -> Red-flagged (urgent review despite a
//     low total, e.g. total 3 from respiration rate 8)
//  4. otherwise (aggregate 0-4)    -> Low
func bandFor(total, maxSingle int) Band {
	switch {
	case total >= 7:
		return BandHigh
	case total >= 5:
		return BandMedium
	case maxSingle >= 3:
		return BandRedFlagged
	default:
		return BandLow
	}
}
