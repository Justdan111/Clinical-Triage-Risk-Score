package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sort"
	"strconv"

	"clinicaltriage/backend/internal/triage"
)

// Decoding happens in two steps so that every problem in a request is
// reported together:
//
//  1. readObject reads exactly one JSON object into a lenient shape:
//     key -> raw JSON value. Only the JSON syntax is checked here, so a field
//     of the wrong type cannot stop the others from being read.
//  2. vitalsFrom converts each known field with explicit checks written in
//     this file. Fields that fail are left unset and their problem recorded;
//     Validate then reports them as missing, and mergeProblems replaces that
//     "is required" message with the real reason.
//
// Nothing here depends on how encoding/json reports type errors or treats
// duplicate keys, both of which differ between its implementations.

// requestError is a problem with the request as a whole (not one field).
type requestError struct {
	status int
	resp   ErrorResponse
}

func badJSON(msg string) *requestError {
	return &requestError{http.StatusBadRequest, ErrorResponse{Error: msg, Code: CodeInvalidJSON}}
}

// classifyReadError turns an error from reading the body into a response.
func classifyReadError(err error) *requestError {
	var maxErr *http.MaxBytesError
	if errors.As(err, &maxErr) {
		return &requestError{http.StatusRequestEntityTooLarge,
			ErrorResponse{Error: "request body is too large", Code: CodeBodyTooLarge}}
	}
	return badJSON("request body is not valid JSON")
}

// knownFields are the request fields, in the order Validate reports them.
var knownFields = []string{
	triage.FieldRespirationRate, triage.FieldSpO2, triage.FieldSystolicBP, triage.FieldPulse,
	triage.FieldConsciousness, triage.FieldTemperature, triage.FieldOnSupplementalOxygen,
}

func isKnownField(name string) bool {
	for _, f := range knownFields {
		if f == name {
			return true
		}
	}
	return false
}

// readObject reads exactly one JSON object from body. It returns the raw
// value of each key, plus per-field problems found while reading (currently
// only duplicated known fields). Unknown keys are kept but later ignored.
func readObject(body io.Reader) (map[string]json.RawMessage, map[string]string, *requestError) {
	dec := json.NewDecoder(body)

	tok, err := dec.Token()
	if errors.Is(err, io.EOF) {
		return nil, nil, badJSON("request body is empty")
	}
	if err != nil {
		return nil, nil, classifyReadError(err)
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		// null, an array, a string, a number...
		return nil, nil, badJSON("request body must be a JSON object")
	}

	fields := map[string]json.RawMessage{}
	problems := map[string]string{}
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return nil, nil, classifyReadError(err)
		}
		key, ok := keyTok.(string)
		if !ok {
			return nil, nil, badJSON("request body is not valid JSON")
		}
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			return nil, nil, classifyReadError(err)
		}
		if _, seen := fields[key]; seen && isKnownField(key) {
			// Two values for one vital is ambiguous; never silently pick one.
			problems[key] = "must appear only once"
		}
		fields[key] = raw
	}
	if _, err := dec.Token(); err != nil { // the closing '}'
		return nil, nil, classifyReadError(err)
	}

	// Anything after the object (another value, or junk) is rejected.
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return nil, nil, classifyReadError(err)
		}
		return nil, nil, badJSON("request body must contain a single JSON object")
	}

	for key := range problems {
		delete(fields, key) // a duplicated field is treated as unusable
	}
	return fields, problems, nil
}

// vitalsFrom converts the raw fields into Vitals. A field that is absent or
// null is left unset (Validate reports it as required). A field of the wrong
// type is left unset and its reason added to problems.
func vitalsFrom(fields map[string]json.RawMessage, problems map[string]string) triage.Vitals {
	var v triage.Vitals
	present := func(name string) (string, bool) {
		raw, ok := fields[name]
		if !ok {
			return "", false
		}
		s := string(bytes.TrimSpace(raw))
		return s, s != "null"
	}

	wholeNumber := func(name string) *int {
		s, ok := present(name)
		if !ok {
			return nil
		}
		if !isNumberLiteral(s) {
			problems[name] = "must be a whole number"
			return nil
		}
		n, err := strconv.Atoi(s) // rejects 16.5 and 1e2
		if errors.Is(err, strconv.ErrRange) {
			problems[name] = "is out of range"
			return nil
		}
		if err != nil {
			problems[name] = "must be a whole number"
			return nil
		}
		return &n
	}

	v.RespirationRate = wholeNumber(triage.FieldRespirationRate)
	v.SpO2 = wholeNumber(triage.FieldSpO2)
	v.SystolicBP = wholeNumber(triage.FieldSystolicBP)
	v.Pulse = wholeNumber(triage.FieldPulse)

	if s, ok := present(triage.FieldTemperature); ok {
		if !isNumberLiteral(s) {
			problems[triage.FieldTemperature] = "must be a number"
		} else if f, err := strconv.ParseFloat(s, 64); err != nil {
			problems[triage.FieldTemperature] = "is out of range"
		} else {
			v.Temperature = &f
		}
	}

	if s, ok := present(triage.FieldConsciousness); ok {
		var str string
		if s[0] != '"' || json.Unmarshal([]byte(s), &str) != nil {
			problems[triage.FieldConsciousness] = "must be a string"
		} else {
			v.Consciousness = triage.Consciousness(str)
		}
	}

	if s, ok := present(triage.FieldOnSupplementalOxygen); ok {
		switch s {
		case "true", "false":
			b := s == "true"
			v.OnSupplementalOxygen = &b
		default:
			problems[triage.FieldOnSupplementalOxygen] = "must be true or false"
		}
	}
	return v
}

// isNumberLiteral reports whether s (already known to be valid JSON) is a
// JSON number rather than a string, bool, object or array.
func isNumberLiteral(s string) bool {
	return s != "" && (s[0] == '-' || (s[0] >= '0' && s[0] <= '9'))
}

// mergeProblems combines Validate's field errors with the problems found
// while decoding. A field that could not be decoded is unset, so Validate
// reports it as "is required"; the decoding problem is the real reason and
// replaces that message. Any problem Validate did not mention (which should
// not happen) is appended, so nothing is ever dropped.
func mergeProblems(validation []triage.FieldError, problems map[string]string) []triage.FieldError {
	merged := make([]triage.FieldError, 0, len(validation)+len(problems))
	used := map[string]bool{}
	for _, fe := range validation {
		if msg, ok := problems[fe.Field]; ok {
			fe.Message = msg
			used[fe.Field] = true
		}
		merged = append(merged, fe)
	}
	var rest []string
	for field := range problems {
		if !used[field] {
			rest = append(rest, field)
		}
	}
	sort.Strings(rest)
	for _, field := range rest {
		merged = append(merged, triage.FieldError{Field: field, Message: problems[field]})
	}
	return merged
}
