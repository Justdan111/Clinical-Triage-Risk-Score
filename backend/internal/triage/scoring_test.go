package triage

import (
	"fmt"
	"slices"
	"testing"
)

// Expected points in this file come from the RCP NEWS2 Chart 1 (2017), not
// from scoring.go. Every value is a literal, so a mistake in the code cannot
// leak into the expectations.

// driverPoints returns the points the result attributes to param (0 if param
// is not among the drivers).
func driverPoints(res Result, param string) int {
	for _, d := range res.Drivers {
		if d.Parameter == param {
			return d.Points
		}
	}
	return 0
}

// TestScoreParameterBoundaries changes one vital at a time on an otherwise
// normal patient (aggregate 0) and checks the points on both sides of every
// band edge in the chart. Tested through Score, the public entry point, so
// the test survives refactoring of the small scoring functions.
func TestScoreParameterBoundaries(t *testing.T) {
	tests := []struct {
		param  string
		set    func(v *Vitals)
		points int
	}{
		// Respiration rate: <=8 -> 3 | 9-11 -> 1 | 12-20 -> 0 | 21-24 -> 2 | >=25 -> 3
		{FieldRespirationRate, func(v *Vitals) { v.RespirationRate = intPtr(0) }, 3},
		{FieldRespirationRate, func(v *Vitals) { v.RespirationRate = intPtr(8) }, 3},
		{FieldRespirationRate, func(v *Vitals) { v.RespirationRate = intPtr(9) }, 1},
		{FieldRespirationRate, func(v *Vitals) { v.RespirationRate = intPtr(11) }, 1},
		{FieldRespirationRate, func(v *Vitals) { v.RespirationRate = intPtr(12) }, 0},
		{FieldRespirationRate, func(v *Vitals) { v.RespirationRate = intPtr(20) }, 0},
		{FieldRespirationRate, func(v *Vitals) { v.RespirationRate = intPtr(21) }, 2},
		{FieldRespirationRate, func(v *Vitals) { v.RespirationRate = intPtr(24) }, 2},
		{FieldRespirationRate, func(v *Vitals) { v.RespirationRate = intPtr(25) }, 3},
		{FieldRespirationRate, func(v *Vitals) { v.RespirationRate = intPtr(80) }, 3},

		// SpO2 Scale 1: <=91 -> 3 | 92-93 -> 2 | 94-95 -> 1 | >=96 -> 0
		{FieldSpO2, func(v *Vitals) { v.SpO2 = intPtr(50) }, 3},
		{FieldSpO2, func(v *Vitals) { v.SpO2 = intPtr(91) }, 3},
		{FieldSpO2, func(v *Vitals) { v.SpO2 = intPtr(92) }, 2},
		{FieldSpO2, func(v *Vitals) { v.SpO2 = intPtr(93) }, 2},
		{FieldSpO2, func(v *Vitals) { v.SpO2 = intPtr(94) }, 1},
		{FieldSpO2, func(v *Vitals) { v.SpO2 = intPtr(95) }, 1},
		{FieldSpO2, func(v *Vitals) { v.SpO2 = intPtr(96) }, 0},
		{FieldSpO2, func(v *Vitals) { v.SpO2 = intPtr(100) }, 0},

		// Air or oxygen: air -> 0 | oxygen -> 2
		{FieldOnSupplementalOxygen, func(v *Vitals) { v.OnSupplementalOxygen = boolPtr(false) }, 0},
		{FieldOnSupplementalOxygen, func(v *Vitals) { v.OnSupplementalOxygen = boolPtr(true) }, 2},

		// Systolic BP: <=90 -> 3 | 91-100 -> 2 | 101-110 -> 1 | 111-219 -> 0 | >=220 -> 3
		{FieldSystolicBP, func(v *Vitals) { v.SystolicBP = intPtr(40) }, 3},
		{FieldSystolicBP, func(v *Vitals) { v.SystolicBP = intPtr(90) }, 3},
		{FieldSystolicBP, func(v *Vitals) { v.SystolicBP = intPtr(91) }, 2},
		{FieldSystolicBP, func(v *Vitals) { v.SystolicBP = intPtr(100) }, 2},
		{FieldSystolicBP, func(v *Vitals) { v.SystolicBP = intPtr(101) }, 1},
		{FieldSystolicBP, func(v *Vitals) { v.SystolicBP = intPtr(110) }, 1},
		{FieldSystolicBP, func(v *Vitals) { v.SystolicBP = intPtr(111) }, 0},
		{FieldSystolicBP, func(v *Vitals) { v.SystolicBP = intPtr(219) }, 0},
		{FieldSystolicBP, func(v *Vitals) { v.SystolicBP = intPtr(220) }, 3},
		{FieldSystolicBP, func(v *Vitals) { v.SystolicBP = intPtr(300) }, 3},

		// Pulse: <=40 -> 3 | 41-50 -> 1 | 51-90 -> 0 | 91-110 -> 1 | 111-130 -> 2 | >=131 -> 3
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(0) }, 3},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(40) }, 3},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(41) }, 1},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(50) }, 1},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(51) }, 0},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(90) }, 0},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(91) }, 1},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(110) }, 1},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(111) }, 2},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(130) }, 2},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(131) }, 3},
		{FieldPulse, func(v *Vitals) { v.Pulse = intPtr(300) }, 3},

		// Consciousness: Alert -> 0 | new Confusion, Voice, Pain, Unresponsive -> 3
		{FieldConsciousness, func(v *Vitals) { v.Consciousness = ConsciousnessAlert }, 0},
		{FieldConsciousness, func(v *Vitals) { v.Consciousness = ConsciousnessNewConfusion }, 3},
		{FieldConsciousness, func(v *Vitals) { v.Consciousness = ConsciousnessVoice }, 3},
		{FieldConsciousness, func(v *Vitals) { v.Consciousness = ConsciousnessPain }, 3},
		{FieldConsciousness, func(v *Vitals) { v.Consciousness = ConsciousnessUnresponsive }, 3},

		// Temperature: <=35.0 -> 3 | 35.1-36.0 -> 1 | 36.1-38.0 -> 0 | 38.1-39.0 -> 1 | >=39.1 -> 2
		{FieldTemperature, func(v *Vitals) { v.Temperature = floatPtr(25.0) }, 3},
		{FieldTemperature, func(v *Vitals) { v.Temperature = floatPtr(35.0) }, 3},
		{FieldTemperature, func(v *Vitals) { v.Temperature = floatPtr(35.1) }, 1},
		{FieldTemperature, func(v *Vitals) { v.Temperature = floatPtr(36.0) }, 1},
		{FieldTemperature, func(v *Vitals) { v.Temperature = floatPtr(36.1) }, 0},
		{FieldTemperature, func(v *Vitals) { v.Temperature = floatPtr(38.0) }, 0},
		{FieldTemperature, func(v *Vitals) { v.Temperature = floatPtr(38.1) }, 1},
		{FieldTemperature, func(v *Vitals) { v.Temperature = floatPtr(39.0) }, 1},
		{FieldTemperature, func(v *Vitals) { v.Temperature = floatPtr(39.1) }, 2},
		{FieldTemperature, func(v *Vitals) { v.Temperature = floatPtr(45.0) }, 2},
	}

	for _, tc := range tests {
		v := validVitals()
		tc.set(&v)
		t.Run(tc.param+"="+formatValue(v, tc.param), func(t *testing.T) {
			res, err := Score(v)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got := driverPoints(res, tc.param); got != tc.points {
				t.Errorf("points = %d, want %d", got, tc.points)
			}
			// Only this parameter was changed from an all-zero patient, so
			// the aggregate must equal its points.
			if res.Total != tc.points {
				t.Errorf("total = %d, want %d", res.Total, tc.points)
			}
		})
	}
}

// formatValue renders the changed field for the subtest name, e.g. "pulse=40".
func formatValue(v Vitals, param string) string {
	for _, d := range []struct {
		name string
		val  any
	}{
		{FieldRespirationRate, *v.RespirationRate}, {FieldSpO2, *v.SpO2},
		{FieldOnSupplementalOxygen, *v.OnSupplementalOxygen}, {FieldSystolicBP, *v.SystolicBP},
		{FieldPulse, *v.Pulse}, {FieldConsciousness, v.Consciousness},
		{FieldTemperature, *v.Temperature},
	} {
		if d.name == param {
			return fmt.Sprint(d.val)
		}
	}
	return "?"
}

// TestScoreBands covers every branch of the band precedence. Each case lists
// how its total is built from chart points, so it can be checked by hand.
func TestScoreBands(t *testing.T) {
	tests := []struct {
		name      string
		set       func(v *Vitals)
		wantTotal int
		wantBand  Band
		wantNote  string
	}{
		{"all normal: total 0 is Low with minimal note",
			func(v *Vitals) {}, 0, BandLow, NoteMinimal},
		{"oxygen alone: 2 -> Low",
			func(v *Vitals) { v.OnSupplementalOxygen = boolPtr(true) }, 2, BandLow, ""},
		{"total 1 -> Low",
			func(v *Vitals) { v.Pulse = intPtr(95) }, 1, BandLow, ""},
		{"total 4 without a 3 -> Low (RR 22 = 2, pulse 115 = 2)",
			func(v *Vitals) { v.RespirationRate, v.Pulse = intPtr(22), intPtr(115) }, 4, BandLow, ""},

		{"total 3 from respiration 8 alone -> Red-flagged",
			func(v *Vitals) { v.RespirationRate = intPtr(8) }, 3, BandRedFlagged, ""},
		{"total 3 from consciousness alone -> Red-flagged",
			func(v *Vitals) { v.Consciousness = ConsciousnessVoice }, 3, BandRedFlagged, ""},
		{"total 4 with a 3 -> Red-flagged (SpO2 91 = 3, pulse 95 = 1)",
			func(v *Vitals) { v.SpO2, v.Pulse = intPtr(91), intPtr(95) }, 4, BandRedFlagged, ""},

		{"total 5 without a 3 -> Medium (RR 22 = 2, pulse 115 = 2, temp 38.5 = 1)",
			func(v *Vitals) {
				v.RespirationRate, v.Pulse, v.Temperature = intPtr(22), intPtr(115), floatPtr(38.5)
			}, 5, BandMedium, ""},
		{"total 5 with a 3 -> Medium, not Red-flagged (RR 8 = 3, oxygen = 2)",
			func(v *Vitals) { v.RespirationRate, v.OnSupplementalOxygen = intPtr(8), boolPtr(true) }, 5, BandMedium, ""},
		{"total 6 with a 3 -> Medium (SBP 90 = 3, pulse 115 = 2, temp 35.5 = 1)",
			func(v *Vitals) {
				v.SystolicBP, v.Pulse, v.Temperature = intPtr(90), intPtr(115), floatPtr(35.5)
			}, 6, BandMedium, ""},
		{"total 6 without a 3 -> Medium (RR 22 = 2, oxygen = 2, temp 39.1 = 2)",
			func(v *Vitals) {
				v.RespirationRate, v.OnSupplementalOxygen, v.Temperature = intPtr(22), boolPtr(true), floatPtr(39.1)
			}, 6, BandMedium, ""},

		{"total 7 without a 3 -> High (RR 22, pulse 115, oxygen = 2 each; temp 38.5 = 1)",
			func(v *Vitals) {
				v.RespirationRate, v.Pulse, v.OnSupplementalOxygen, v.Temperature =
					intPtr(22), intPtr(115), boolPtr(true), floatPtr(38.5)
			}, 7, BandHigh, ""},
		{"total 7 with a 3 -> High (RR 25 = 3, oxygen = 2, pulse 115 = 2)",
			func(v *Vitals) {
				v.RespirationRate, v.OnSupplementalOxygen, v.Pulse = intPtr(25), boolPtr(true), intPtr(115)
			}, 7, BandHigh, ""},
		{"worst possible: 3+3+2+3+3+3+3 = 20 -> High",
			func(v *Vitals) {
				v.RespirationRate, v.SpO2, v.OnSupplementalOxygen = intPtr(5), intPtr(85), boolPtr(true)
				v.SystolicBP, v.Pulse, v.Consciousness, v.Temperature =
					intPtr(80), intPtr(140), ConsciousnessUnresponsive, floatPtr(34.0)
			}, 20, BandHigh, ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := validVitals()
			tc.set(&v)
			res, err := Score(v)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Total != tc.wantTotal {
				t.Errorf("total = %d, want %d", res.Total, tc.wantTotal)
			}
			if res.Band != tc.wantBand {
				t.Errorf("band = %q, want %q", res.Band, tc.wantBand)
			}
			if res.Note != tc.wantNote {
				t.Errorf("note = %q, want %q", res.Note, tc.wantNote)
			}
		})
	}
}

// TestScoreDrivers checks the drivers list: only parameters above zero,
// highest points first, chart order among ties, with the causing value.
func TestScoreDrivers(t *testing.T) {
	t.Run("medium with a red parameter keeps it, first", func(t *testing.T) {
		// RR 8 = 3, pulse 115 = 2 -> total 5: Medium, yet RR still listed (first).
		v := validVitals()
		v.RespirationRate, v.Pulse = intPtr(8), intPtr(115)
		res, err := Score(v)
		if err != nil {
			t.Fatal(err)
		}
		if res.Band != BandMedium {
			t.Fatalf("band = %q, want medium", res.Band)
		}
		want := []Driver{
			{FieldRespirationRate, 8, 3},
			{FieldPulse, 115, 2},
		}
		if !slices.Equal(res.Drivers, want) {
			t.Errorf("drivers = %+v, want %+v", res.Drivers, want)
		}
	})

	t.Run("sorted by points, ties in chart order", func(t *testing.T) {
		// temp 38.5 = 1, pulse 115 = 2, oxygen = 2, SBP 85 = 3.
		// Chart order: oxygen comes before pulse, so the 2-point tie is oxygen, pulse.
		v := validVitals()
		v.Temperature, v.Pulse, v.OnSupplementalOxygen, v.SystolicBP =
			floatPtr(38.5), intPtr(115), boolPtr(true), intPtr(85)
		res, err := Score(v)
		if err != nil {
			t.Fatal(err)
		}
		want := []Driver{
			{FieldSystolicBP, 85, 3},
			{FieldOnSupplementalOxygen, true, 2},
			{FieldPulse, 115, 2},
			{FieldTemperature, 38.5, 1},
		}
		if !slices.Equal(res.Drivers, want) {
			t.Errorf("drivers = %+v, want %+v", res.Drivers, want)
		}
	})

	t.Run("consciousness driver carries its level", func(t *testing.T) {
		v := validVitals()
		v.Consciousness = ConsciousnessNewConfusion
		res, _ := Score(v)
		want := []Driver{{FieldConsciousness, ConsciousnessNewConfusion, 3}}
		if !slices.Equal(res.Drivers, want) {
			t.Errorf("drivers = %+v, want %+v", res.Drivers, want)
		}
	})

	t.Run("no drivers is an empty, non-nil slice", func(t *testing.T) {
		res, _ := Score(validVitals())
		if res.Drivers == nil || len(res.Drivers) != 0 {
			t.Errorf("drivers = %#v, want empty non-nil slice", res.Drivers)
		}
	})
}

// TestScoreRejectsInvalid checks that Score refuses to score bad input
// instead of panicking on a nil pointer.
func TestScoreRejectsInvalid(t *testing.T) {
	_, err := Score(Vitals{})
	if got := fieldNames(t, err); len(got) != 7 {
		t.Errorf("error fields = %v, want all 7 fields", got)
	}
}
