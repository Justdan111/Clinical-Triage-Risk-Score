package triage

import (
	"errors"
	"slices"
	"testing"
)

func intPtr(v int) *int           { return &v }
func floatPtr(v float64) *float64 { return &v }
func boolPtr(v bool) *bool        { return &v }

// validVitals returns a fully valid, normal set of observations. Each test
// case starts from this and changes only the thing it is testing.
func validVitals() Vitals {
	return Vitals{
		RespirationRate:      intPtr(16),
		SpO2:                 intPtr(97),
		SystolicBP:           intPtr(120),
		Pulse:                intPtr(72),
		Consciousness:        ConsciousnessAlert,
		Temperature:          floatPtr(36.8),
		OnSupplementalOxygen: boolPtr(false),
	}
}

// fieldNames extracts the field names from a Validate error (nil if err is nil).
func fieldNames(t *testing.T, err error) []string {
	t.Helper()
	if err == nil {
		return nil
	}
	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("expected *ValidationError, got %T: %v", err, err)
	}
	names := make([]string, len(ve.Errors))
	for i, fe := range ve.Errors {
		names[i] = fe.Field
	}
	return names
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name       string
		mutate     func(v *Vitals)
		wantFields []string // nil means "expect no error"
	}{
		{"valid normal vitals", func(v *Vitals) {}, nil},

		// Missing fields.
		{"missing respiration_rate", func(v *Vitals) { v.RespirationRate = nil }, []string{FieldRespirationRate}},
		{"missing spo2", func(v *Vitals) { v.SpO2 = nil }, []string{FieldSpO2}},
		{"missing systolic_bp", func(v *Vitals) { v.SystolicBP = nil }, []string{FieldSystolicBP}},
		{"missing pulse", func(v *Vitals) { v.Pulse = nil }, []string{FieldPulse}},
		{"missing consciousness", func(v *Vitals) { v.Consciousness = "" }, []string{FieldConsciousness}},
		{"missing temperature", func(v *Vitals) { v.Temperature = nil }, []string{FieldTemperature}},
		{"missing on_supplemental_oxygen", func(v *Vitals) { v.OnSupplementalOxygen = nil }, []string{FieldOnSupplementalOxygen}},
		{"everything missing", func(v *Vitals) { *v = Vitals{} }, []string{
			FieldRespirationRate, FieldSpO2, FieldSystolicBP, FieldPulse,
			FieldConsciousness, FieldTemperature, FieldOnSupplementalOxygen,
		}},

		// Range boundaries: the limit itself is accepted, one step past it is not.
		{"respiration_rate at min", func(v *Vitals) { v.RespirationRate = intPtr(MinRespirationRate) }, nil},
		{"respiration_rate below min", func(v *Vitals) { v.RespirationRate = intPtr(MinRespirationRate - 1) }, []string{FieldRespirationRate}},
		{"respiration_rate at max", func(v *Vitals) { v.RespirationRate = intPtr(MaxRespirationRate) }, nil},
		{"respiration_rate above max", func(v *Vitals) { v.RespirationRate = intPtr(MaxRespirationRate + 1) }, []string{FieldRespirationRate}},
		{"spo2 at min", func(v *Vitals) { v.SpO2 = intPtr(MinSpO2) }, nil},
		{"spo2 below min", func(v *Vitals) { v.SpO2 = intPtr(MinSpO2 - 1) }, []string{FieldSpO2}},
		{"spo2 at max", func(v *Vitals) { v.SpO2 = intPtr(MaxSpO2) }, nil},
		{"spo2 above max", func(v *Vitals) { v.SpO2 = intPtr(MaxSpO2 + 1) }, []string{FieldSpO2}},
		{"systolic_bp at min", func(v *Vitals) { v.SystolicBP = intPtr(MinSystolicBP) }, nil},
		{"systolic_bp below min", func(v *Vitals) { v.SystolicBP = intPtr(MinSystolicBP - 1) }, []string{FieldSystolicBP}},
		{"systolic_bp at max", func(v *Vitals) { v.SystolicBP = intPtr(MaxSystolicBP) }, nil},
		{"systolic_bp above max", func(v *Vitals) { v.SystolicBP = intPtr(MaxSystolicBP + 1) }, []string{FieldSystolicBP}},
		{"pulse at min", func(v *Vitals) { v.Pulse = intPtr(MinPulse) }, nil},
		{"pulse below min", func(v *Vitals) { v.Pulse = intPtr(MinPulse - 1) }, []string{FieldPulse}},
		{"pulse at max", func(v *Vitals) { v.Pulse = intPtr(MaxPulse) }, nil},
		{"pulse above max", func(v *Vitals) { v.Pulse = intPtr(MaxPulse + 1) }, []string{FieldPulse}},
		{"temperature at min", func(v *Vitals) { v.Temperature = floatPtr(MinTemperature) }, nil},
		{"temperature below min", func(v *Vitals) { v.Temperature = floatPtr(24.9) }, []string{FieldTemperature}},
		{"temperature at max", func(v *Vitals) { v.Temperature = floatPtr(MaxTemperature) }, nil},
		{"temperature above max", func(v *Vitals) { v.Temperature = floatPtr(45.1) }, []string{FieldTemperature}},
		{"temperature in fahrenheit", func(v *Vitals) { v.Temperature = floatPtr(98.6) }, []string{FieldTemperature}},

		// Zero is a real (critical) reading for these two and must be scored,
		// not rejected. Literal values, so a change to the constants can't
		// silently move the floor.
		{"respiration_rate 0 accepted", func(v *Vitals) { v.RespirationRate = intPtr(0) }, nil},
		{"respiration_rate -1 rejected", func(v *Vitals) { v.RespirationRate = intPtr(-1) }, []string{FieldRespirationRate}},
		{"pulse 0 accepted", func(v *Vitals) { v.Pulse = intPtr(0) }, nil},
		{"pulse -1 rejected", func(v *Vitals) { v.Pulse = intPtr(-1) }, []string{FieldPulse}},

		// Abnormal-but-possible values must pass: they are what NEWS2 scores.
		{"zero is a valid oxygen flag", func(v *Vitals) { v.OnSupplementalOxygen = boolPtr(false) }, nil},
		{"on oxygen", func(v *Vitals) { v.OnSupplementalOxygen = boolPtr(true) }, nil},
		{"very sick but plausible", func(v *Vitals) {
			v.RespirationRate, v.SpO2, v.SystolicBP, v.Pulse = intPtr(35), intPtr(85), intPtr(70), intPtr(150)
			v.Temperature = floatPtr(40.2)
			v.Consciousness = ConsciousnessUnresponsive
		}, nil},

		// Temperature precision.
		{"temperature whole number", func(v *Vitals) { v.Temperature = floatPtr(37.0) }, nil},
		{"temperature one decimal", func(v *Vitals) { v.Temperature = floatPtr(36.1) }, nil},
		{"temperature two decimals", func(v *Vitals) { v.Temperature = floatPtr(36.05) }, []string{FieldTemperature}},
		{"temperature many decimals", func(v *Vitals) { v.Temperature = floatPtr(38.000001) }, []string{FieldTemperature}},

		// Consciousness values.
		{"consciousness new_confusion", func(v *Vitals) { v.Consciousness = ConsciousnessNewConfusion }, nil},
		{"consciousness voice", func(v *Vitals) { v.Consciousness = ConsciousnessVoice }, nil},
		{"consciousness pain", func(v *Vitals) { v.Consciousness = ConsciousnessPain }, nil},
		{"consciousness unresponsive", func(v *Vitals) { v.Consciousness = ConsciousnessUnresponsive }, nil},
		{"consciousness unknown", func(v *Vitals) { v.Consciousness = "drowsy" }, []string{FieldConsciousness}},
		{"consciousness wrong case", func(v *Vitals) { v.Consciousness = "Alert" }, []string{FieldConsciousness}},

		// Several problems are all reported together, in field order.
		{"multiple bad fields", func(v *Vitals) {
			v.SpO2 = intPtr(101)
			v.Temperature = floatPtr(36.25)
		}, []string{FieldSpO2, FieldTemperature}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := validVitals()
			tc.mutate(&v)
			got := fieldNames(t, v.Validate())
			if !slices.Equal(got, tc.wantFields) {
				t.Errorf("error fields = %v, want %v", got, tc.wantFields)
			}
		})
	}
}
