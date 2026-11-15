package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"clinicaltriage/backend/internal/triage"
)

// Raw JSON for a valid, normal patient, one entry per field in Validate order.
var baseFields = [][2]string{
	{"respiration_rate", "16"},
	{"spo2", "97"},
	{"systolic_bp", "120"},
	{"pulse", "72"},
	{"consciousness", `"alert"`},
	{"temperature", "36.8"},
	{"on_supplemental_oxygen", "false"},
}

// vitalsJSON builds a request body from baseFields. over replaces a field's
// raw JSON value; a value of "-" drops the field. Extra keys in over that are
// not base fields are appended (e.g. unknown fields).
func vitalsJSON(over map[string]string) string {
	var parts []string
	used := map[string]bool{}
	for _, f := range baseFields {
		val := f[1]
		if o, ok := over[f[0]]; ok {
			used[f[0]] = true
			if o == "-" {
				continue
			}
			val = o
		}
		parts = append(parts, `"`+f[0]+`":`+val)
	}
	for k, v := range over {
		if !used[k] {
			parts = append(parts, `"`+k+`":`+v)
		}
	}
	return "{" + strings.Join(parts, ",") + "}"
}

type malformedCase struct {
	name        string
	method      string // default POST
	path        string // default /score
	contentType string // default application/json; "none" sends no header
	body        string
	wantStatus  int
	wantCode    string   // "" for a 200
	wantFields  []string // exact field names in order (nil = none)
	wantBand    string   // checked on 200
	wantTotal   int      // checked on 200
	wantAllow   string   // checked on 405
}

func runMalformed(t *testing.T, tc malformedCase) {
	t.Helper()
	method, path := tc.method, tc.path
	if method == "" {
		method = http.MethodPost
	}
	if path == "" {
		path = "/score"
	}
	req := httptest.NewRequest(method, path, strings.NewReader(tc.body))
	switch tc.contentType {
	case "":
		req.Header.Set("Content-Type", "application/json")
	case "none":
	default:
		req.Header.Set("Content-Type", tc.contentType)
	}
	rec := httptest.NewRecorder()
	newTestRouter().ServeHTTP(rec, req)

	if rec.Code != tc.wantStatus {
		t.Fatalf("status = %d, want %d; body: %s", rec.Code, tc.wantStatus, rec.Body)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json (every response is JSON)", ct)
	}
	if tc.wantAllow != "" && rec.Header().Get("Allow") != tc.wantAllow {
		t.Errorf("Allow = %q, want %q", rec.Header().Get("Allow"), tc.wantAllow)
	}

	if tc.wantStatus == http.StatusOK {
		var res struct {
			Total int    `json:"total"`
			Band  string `json:"band"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("200 body is not JSON: %v", err)
		}
		if tc.wantBand != "" && (res.Band != tc.wantBand || res.Total != tc.wantTotal) {
			t.Errorf("band/total = %s/%d, want %s/%d", res.Band, res.Total, tc.wantBand, tc.wantTotal)
		}
		return
	}

	var resp ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("error body is not JSON: %v; body: %s", err, rec.Body)
	}
	if resp.Code != tc.wantCode {
		t.Errorf("code = %q, want %q", resp.Code, tc.wantCode)
	}
	if resp.Error == "" {
		t.Error("error message is empty")
	}
	var got []string
	for _, f := range resp.Fields {
		got = append(got, f.Field)
		if f.Message == "" {
			t.Errorf("field %q has an empty message", f.Field)
		}
	}
	if !slices.Equal(got, tc.wantFields) {
		t.Errorf("fields = %v, want %v", got, tc.wantFields)
	}
}

// pad returns a valid body padded with trailing spaces to exactly n bytes.
func pad(n int) string {
	b := vitalsJSON(nil)
	return b + strings.Repeat(" ", n-len(b))
}

func TestMalformedBodies(t *testing.T) {
	tests := []malformedCase{
		// Not one JSON object.
		{name: "empty body", body: ``, wantStatus: 400, wantCode: CodeInvalidJSON},
		{name: "whitespace only", body: "  \n\t ", wantStatus: 400, wantCode: CodeInvalidJSON},
		{name: "null", body: `null`, wantStatus: 400, wantCode: CodeInvalidJSON},
		{name: "array", body: `[` + vitalsJSON(nil) + `]`, wantStatus: 400, wantCode: CodeInvalidJSON},
		{name: "bare string", body: `"hello"`, wantStatus: 400, wantCode: CodeInvalidJSON},
		{name: "bare number", body: `42`, wantStatus: 400, wantCode: CodeInvalidJSON},
		{name: "truncated object", body: `{"pulse": 72`, wantStatus: 400, wantCode: CodeInvalidJSON},
		{name: "syntax error inside", body: `{"pulse": 72,}`, wantStatus: 400, wantCode: CodeInvalidJSON},

		// Trailing data.
		{name: "second object after the first", body: vitalsJSON(nil) + `{"pulse":200}`, wantStatus: 400, wantCode: CodeInvalidJSON},
		{name: "junk after the object", body: vitalsJSON(nil) + ` junk`, wantStatus: 400, wantCode: CodeInvalidJSON},
		{name: "trailing whitespace is fine", body: vitalsJSON(nil) + "\n\n  ", wantStatus: 200},

		// Size limit, at the exact boundary.
		{name: "body exactly at the limit", body: pad(maxBodyBytes), wantStatus: 200},
		{name: "body one byte over the limit", body: pad(maxBodyBytes + 1), wantStatus: 413, wantCode: CodeBodyTooLarge},
		{name: "huge field value", body: vitalsJSON(map[string]string{"note": `"` + strings.Repeat("a", 10_000) + `"`}), wantStatus: 413, wantCode: CodeBodyTooLarge},

		// Content-Type.
		{name: "text/plain", contentType: "text/plain", body: vitalsJSON(nil), wantStatus: 415, wantCode: CodeUnsupportedMediaType},
		{name: "form encoded (curl -d default)", contentType: "application/x-www-form-urlencoded", body: vitalsJSON(nil), wantStatus: 415, wantCode: CodeUnsupportedMediaType},
		{name: "unparseable content type", contentType: "application/json; charset", body: vitalsJSON(nil), wantStatus: 415, wantCode: CodeUnsupportedMediaType},
		{name: "json with charset", contentType: "application/json; charset=utf-8", body: vitalsJSON(nil), wantStatus: 200},
		{name: "no content type", contentType: "none", body: vitalsJSON(nil), wantStatus: 200},

		// Unknown and duplicate fields.
		{name: "unknown field is ignored", body: vitalsJSON(map[string]string{"ward": `"7B"`}), wantStatus: 200},
		{name: "unknown field does not hide a missing one", body: vitalsJSON(map[string]string{"sp02": "97", "spo2": "-"}),
			wantStatus: 400, wantCode: CodeValidationFailed, wantFields: []string{"spo2"}},
		{name: "duplicate known field", body: strings.Replace(vitalsJSON(nil), `"pulse":72`, `"pulse":72,"pulse":200`, 1),
			wantStatus: 400, wantCode: CodeValidationFailed, wantFields: []string{"pulse"}},
		{name: "duplicate unknown field is ignored",
			body:       strings.Replace(vitalsJSON(map[string]string{"ward": `"7B"`}), `"ward":"7B"`, `"ward":"7B","ward":"8C"`, 1),
			wantStatus: 200},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) { runMalformed(t, tc) })
	}
}

func TestFieldTypeErrors(t *testing.T) {
	type c = malformedCase
	bad := func(name, field, raw string) c {
		return c{name: name, body: vitalsJSON(map[string]string{field: raw}),
			wantStatus: 400, wantCode: CodeValidationFailed, wantFields: []string{field}}
	}
	tests := []c{
		bad("integer field as 16.5", "respiration_rate", "16.5"),
		bad("integer field as 16.0", "respiration_rate", "16.0"),
		bad("integer field in exponent form", "spo2", "1e2"),
		bad("integer field overflowing int", "systolic_bp", "99999999999999999999999"),
		bad("respiration_rate as string", "respiration_rate", `"fast"`),
		bad("spo2 as numeric string", "spo2", `"97"`),
		bad("systolic_bp as bool", "systolic_bp", "true"),
		bad("pulse as string", "pulse", `"fast"`),
		bad("pulse as object", "pulse", `{"value":72}`),
		bad("pulse as array", "pulse", `[72]`),
		bad("temperature with two decimals", "temperature", "36.85"),
		bad("temperature as string", "temperature", `"36.8"`),
		bad("consciousness as number", "consciousness", "3"),
		bad("consciousness unknown value", "consciousness", `"drowsy"`),
		bad("oxygen as string", "on_supplemental_oxygen", `"true"`),
		bad("oxygen as 1", "on_supplemental_oxygen", "1"),
		bad("null field counts as missing", "pulse", "null"),
		{
			// The Day 1 limitation: a type error used to hide every other problem.
			name: "type errors and validation errors reported together",
			body: vitalsJSON(map[string]string{
				"spo2": "101", "pulse": `"fast"`, "consciousness": "-", "temperature": "36.85",
				"on_supplemental_oxygen": `"yes"`,
			}),
			wantStatus: 400, wantCode: CodeValidationFailed,
			wantFields: []string{"spo2", "pulse", "consciousness", "temperature", "on_supplemental_oxygen"},
		},
		{
			name:       "every field wrong type",
			body:       `{"respiration_rate":"a","spo2":"b","systolic_bp":"c","pulse":"d","consciousness":1,"temperature":"e","on_supplemental_oxygen":"f"}`,
			wantStatus: 400, wantCode: CodeValidationFailed,
			wantFields: []string{"respiration_rate", "spo2", "systolic_bp", "pulse", "consciousness", "temperature", "on_supplemental_oxygen"},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) { runMalformed(t, tc) })
	}
}

func TestExtremeAcceptedValues(t *testing.T) {
	ok := func(field, raw, band string, total int) malformedCase {
		return malformedCase{name: field + "=" + raw, body: vitalsJSON(map[string]string{field: raw}),
			wantStatus: 200, wantBand: band, wantTotal: total}
	}
	reject := func(field, raw string) malformedCase {
		return malformedCase{name: field + "=" + raw + " rejected", body: vitalsJSON(map[string]string{field: raw}),
			wantStatus: 400, wantCode: CodeValidationFailed, wantFields: []string{field}}
	}
	tests := []malformedCase{
		ok("respiration_rate", "0", "red_flagged", 3),
		ok("respiration_rate", "80", "red_flagged", 3),
		ok("pulse", "0", "red_flagged", 3),
		ok("pulse", "300", "red_flagged", 3),
		reject("respiration_rate", "-1"),
		reject("respiration_rate", "81"),
		reject("pulse", "-1"),
		reject("pulse", "301"),
		ok("respiration_rate", "-0", "red_flagged", 3), // valid JSON for zero
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) { runMalformed(t, tc) })
	}
}

func TestRoutingErrorsAreJSON(t *testing.T) {
	tests := []malformedCase{
		{name: "unknown path", method: http.MethodGet, path: "/nope", wantStatus: 404, wantCode: CodeNotFound},
		{name: "unknown path with POST", path: "/scores", body: vitalsJSON(nil), wantStatus: 404, wantCode: CodeNotFound},
		{name: "GET /score", method: http.MethodGet, wantStatus: 405, wantCode: CodeMethodNotAllowed, wantAllow: "POST"},
		{name: "DELETE /score", method: http.MethodDelete, wantStatus: 405, wantCode: CodeMethodNotAllowed, wantAllow: "POST"},
		{name: "POST /health", path: "/health", body: `{}`, wantStatus: 405, wantCode: CodeMethodNotAllowed, wantAllow: "GET, HEAD"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) { runMalformed(t, tc) })
	}
}

// scoreErrorBody posts body to /score and returns the decoded error.
func scoreErrorBody(t *testing.T, body string) ErrorResponse {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/score", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	newTestRouter().ServeHTTP(rec, req)
	var resp ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("error body is not JSON: %v; body: %s", err, rec.Body)
	}
	return resp
}

func fieldMessage(t *testing.T, resp ErrorResponse, field string) string {
	t.Helper()
	for _, f := range resp.Fields {
		if f.Field == field {
			return f.Message
		}
	}
	t.Fatalf("no error for field %q in %+v", field, resp.Fields)
	return ""
}

// These compare our messages with each other rather than with fixed text, so
// the wording can change freely while the distinctions the client relies on
// are still checked.
func TestErrorMessagesDistinguishCauses(t *testing.T) {
	missing := fieldMessage(t, scoreErrorBody(t, vitalsJSON(map[string]string{"pulse": "-"})), "pulse")

	t.Run("null is reported exactly like an omitted field", func(t *testing.T) {
		got := fieldMessage(t, scoreErrorBody(t, vitalsJSON(map[string]string{"pulse": "null"})), "pulse")
		if got != missing {
			t.Errorf("null pulse message %q differs from missing pulse message %q", got, missing)
		}
	})

	t.Run("a wrong type is not reported as missing", func(t *testing.T) {
		for _, raw := range []string{`"fast"`, "72.5", "true"} {
			got := fieldMessage(t, scoreErrorBody(t, vitalsJSON(map[string]string{"pulse": raw})), "pulse")
			if got == missing {
				t.Errorf("pulse=%s reported as %q, the same as a missing field", raw, got)
			}
		}
	})

	t.Run("a wrong type is not reported as out of range", func(t *testing.T) {
		outOfRange := fieldMessage(t, scoreErrorBody(t, vitalsJSON(map[string]string{"pulse": "301"})), "pulse")
		got := fieldMessage(t, scoreErrorBody(t, vitalsJSON(map[string]string{"pulse": `"fast"`})), "pulse")
		if got == outOfRange {
			t.Errorf("type error and range error share the message %q", got)
		}
	})

	t.Run("an empty body has its own message", func(t *testing.T) {
		empty := scoreErrorBody(t, "").Error
		syntax := scoreErrorBody(t, `{"pulse":`).Error
		if empty == syntax {
			t.Errorf("empty body and syntax error share the message %q", empty)
		}
	})
}

func TestMergeProblems(t *testing.T) {
	validation := []triage.FieldError{
		{Field: "spo2", Message: "out of range"},
		{Field: "pulse", Message: "is required"},
	}
	problems := map[string]string{"pulse": "must be a whole number", "zeta": "z", "alpha": "a"}
	got := mergeProblems(validation, problems)
	want := []triage.FieldError{
		{Field: "spo2", Message: "out of range"},
		{Field: "pulse", Message: "must be a whole number"}, // replaced, keeps its position
		{Field: "alpha", Message: "a"},                      // not in validation: appended, sorted
		{Field: "zeta", Message: "z"},
	}
	if !slices.Equal(got, want) {
		t.Errorf("mergeProblems = %+v, want %+v", got, want)
	}
}
