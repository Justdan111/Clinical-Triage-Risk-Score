// Package triage holds the clinical domain model: the vitals a client sends
// and the rules for what counts as a usable set of vitals. It knows nothing
// about HTTP, so it can be tested and reused (by the Day 2 scorer) on its own.
package triage

import (
	"fmt"
	"strconv"
	"strings"
)

// Consciousness is the patient's level of consciousness on the ACVPU scale.
// It is a distinct string type, not a plain string, so the compiler stops us
// from passing an arbitrary string where a consciousness level is expected.
type Consciousness string

// The ACVPU levels accepted by the API. Anything else is rejected by Validate.
const (
	ConsciousnessAlert        Consciousness = "alert"
	ConsciousnessNewConfusion Consciousness = "new_confusion" // NEWS2 counts *new* confusion only
	ConsciousnessVoice        Consciousness = "voice"
	ConsciousnessPain         Consciousness = "pain"
	ConsciousnessUnresponsive Consciousness = "unresponsive"
)

// valid reports whether c is one of the known ACVPU levels.
func (c Consciousness) valid() bool {
	switch c {
	case ConsciousnessAlert, ConsciousnessNewConfusion, ConsciousnessVoice,
		ConsciousnessPain, ConsciousnessUnresponsive:
		return true
	}
	return false
}

// JSON field names. They are used both in the struct tags below and in error
// messages, so a client always sees the same name it sent.
const (
	FieldRespirationRate      = "respiration_rate"
	FieldSpO2                 = "spo2"
	FieldSystolicBP           = "systolic_bp"
	FieldPulse                = "pulse"
	FieldConsciousness        = "consciousness"
	FieldTemperature          = "temperature"
	FieldOnSupplementalOxygen = "on_supplemental_oxygen"
)

// Vitals is one set of observations for a single patient.
//
// Numeric fields and the oxygen flag are pointers so that "missing" (nil)
// can be told apart from a real zero/false. With a plain int, a client that
// forgot to send spo2 would silently get spo2 = 0.
type Vitals struct {
	RespirationRate      *int          `json:"respiration_rate"` // breaths per minute
	SpO2                 *int          `json:"spo2"`             // oxygen saturation, %
	SystolicBP           *int          `json:"systolic_bp"`      // mmHg
	Pulse                *int          `json:"pulse"`            // beats per minute
	Consciousness        Consciousness `json:"consciousness"`    // "" means missing
	Temperature          *float64      `json:"temperature"`      // degrees Celsius, at most 1 decimal place
	OnSupplementalOxygen *bool         `json:"on_supplemental_oxygen"`
}

// Accepted ranges. These reject values that are physiologically impossible or
// almost certainly a typo, a wrong unit or a faulty device. They do NOT reject
// abnormal values: the abnormal ones are exactly what NEWS2 needs to score.
// Every lower bound sits well inside the band that already scores 3, so a
// tighter floor never changes a patient's score.
const (
	// 0 (apnoea / no palpable pulse) is accepted on purpose: it scores 3, and
	// rejecting it would hide the most urgent patients behind a 400 error.
	MinRespirationRate = 0
	MaxRespirationRate = 80
	MinSpO2            = 50 // pulse oximeters are not calibrated much below ~70
	MaxSpO2            = 100
	MinSystolicBP      = 40 // below this a cuff generally cannot record a pressure
	MaxSystolicBP      = 300
	MinPulse           = 0
	MaxPulse           = 300
	MinTemperature     = 25.0 // also catches readings entered in Fahrenheit (e.g. 98.6)
	MaxTemperature     = 45.0
)

// FieldError describes one problem with one field.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidationError collects every FieldError found in one request, so a client
// can fix all problems in one round trip instead of one per request.
type ValidationError struct {
	Errors []FieldError
}

// Error implements the error interface.
func (e *ValidationError) Error() string {
	msgs := make([]string, len(e.Errors))
	for i, fe := range e.Errors {
		msgs[i] = fe.Field + ": " + fe.Message
	}
	return "invalid vitals: " + strings.Join(msgs, "; ")
}

// Validate checks that every field is present and within a plausible range.
// It returns nil if v is usable, or a *ValidationError listing every problem.
func (v Vitals) Validate() error {
	var errs []FieldError
	add := func(field, msg string) {
		errs = append(errs, FieldError{Field: field, Message: msg})
	}

	checkInt := func(field string, val *int, lo, hi int, unit string) {
		switch {
		case val == nil:
			add(field, "is required")
		case *val < lo || *val > hi:
			add(field, fmt.Sprintf("must be between %d and %d %s, got %d", lo, hi, unit, *val))
		}
	}
	checkInt(FieldRespirationRate, v.RespirationRate, MinRespirationRate, MaxRespirationRate, "breaths/min")
	checkInt(FieldSpO2, v.SpO2, MinSpO2, MaxSpO2, "%")
	checkInt(FieldSystolicBP, v.SystolicBP, MinSystolicBP, MaxSystolicBP, "mmHg")
	checkInt(FieldPulse, v.Pulse, MinPulse, MaxPulse, "beats/min")

	switch {
	case v.Consciousness == "":
		add(FieldConsciousness, "is required")
	case !v.Consciousness.valid():
		add(FieldConsciousness, fmt.Sprintf(
			"must be one of %q, %q, %q, %q, %q; got %q",
			ConsciousnessAlert, ConsciousnessNewConfusion, ConsciousnessVoice,
			ConsciousnessPain, ConsciousnessUnresponsive, v.Consciousness))
	}

	switch t := v.Temperature; {
	case t == nil:
		add(FieldTemperature, "is required")
	case *t < MinTemperature || *t > MaxTemperature:
		add(FieldTemperature, fmt.Sprintf("must be between %.1f and %.1f °C, got %v",
			MinTemperature, MaxTemperature, *t))
	case decimalPlaces(*t) > 1:
		add(FieldTemperature, fmt.Sprintf("must have at most one decimal place, got %v", *t))
	}

	if v.OnSupplementalOxygen == nil {
		add(FieldOnSupplementalOxygen, "is required")
	}

	if len(errs) > 0 {
		return &ValidationError{Errors: errs}
	}
	return nil
}

// decimalPlaces counts the digits after the decimal point in the shortest
// decimal string that represents f exactly as a float64. For a value parsed
// from JSON "36.1" that string is "36.1", so this inspects what the client
// actually typed and avoids an epsilon-based float comparison.
func decimalPlaces(f float64) int {
	s := strconv.FormatFloat(f, 'f', -1, 64)
	if i := strings.IndexByte(s, '.'); i >= 0 {
		return len(s) - i - 1
	}
	return 0
}
