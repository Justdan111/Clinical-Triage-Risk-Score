package api

import (
	"encoding/json"
	"io"
	"log/slog"
	"maps"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
)

// newTestRouter returns the real router with logging discarded, so test
// output stays readable.
func newTestRouter() http.Handler {
	return NewRouter(slog.New(slog.NewTextHandler(io.Discard, nil)))
}

const validBody = `{
	"respiration_rate": 16,
	"spo2": 97,
	"systolic_bp": 120,
	"pulse": 72,
	"consciousness": "alert",
	"temperature": 36.8,
	"on_supplemental_oxygen": false
}`

func TestHealth(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		wantStatus int
	}{
		{"GET returns ok", http.MethodGet, http.StatusOK},
		{"HEAD is allowed", http.MethodHead, http.StatusOK},
		{"POST is not allowed", http.MethodPost, http.StatusMethodNotAllowed},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, "/health", nil)
			rec := httptest.NewRecorder()
			newTestRouter().ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
			if tc.method != http.MethodGet {
				return
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}
			var body map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("response is not JSON: %v", err)
			}
			if body["status"] != "ok" {
				t.Errorf(`body["status"] = %q, want "ok"`, body["status"])
			}
		})
	}
}

func TestScore(t *testing.T) {
	tests := []struct {
		name        string
		method      string
		contentType string
		body        string
		wantStatus  int
		wantCode    string   // "" means no ErrorResponse to check (200, or 405 from the mux)
		wantFields  []string // field names expected in the error, in order
	}{
		{
			name: "valid vitals are scored", body: validBody,
			wantStatus: http.StatusOK, // body shape checked in TestScoreSuccess
		},
		{
			name: "content type with charset is accepted", body: validBody,
			contentType: "application/json; charset=utf-8",
			wantStatus:  http.StatusOK,
		},
		{
			name: "out of range spo2", body: strings.Replace(validBody, `"spo2": 97`, `"spo2": 101`, 1),
			wantStatus: http.StatusBadRequest, wantCode: CodeValidationFailed,
			wantFields: []string{"spo2"},
		},
		{
			name: "missing pulse", body: strings.Replace(validBody, `"pulse": 72,`, ``, 1),
			wantStatus: http.StatusBadRequest, wantCode: CodeValidationFailed,
			wantFields: []string{"pulse"},
		},
		{
			name: "two decimal temperature", body: strings.Replace(validBody, `36.8`, `36.05`, 1),
			wantStatus: http.StatusBadRequest, wantCode: CodeValidationFailed,
			wantFields: []string{"temperature"},
		},
		{
			name: "unknown consciousness", body: strings.Replace(validBody, `"alert"`, `"drowsy"`, 1),
			wantStatus: http.StatusBadRequest, wantCode: CodeValidationFailed,
			wantFields: []string{"consciousness"},
		},
		{
			name: "empty object reports every field", body: `{}`,
			wantStatus: http.StatusBadRequest, wantCode: CodeValidationFailed,
			wantFields: []string{"respiration_rate", "spo2", "systolic_bp", "pulse",
				"consciousness", "temperature", "on_supplemental_oxygen"},
		},
		{
			name: "misspelled field reported as missing", body: strings.Replace(validBody, `"spo2"`, `"sp02"`, 1),
			wantStatus: http.StatusBadRequest, wantCode: CodeValidationFailed,
			wantFields: []string{"spo2"},
		},
		{
			name: "wrong type string for int", body: strings.Replace(validBody, `"pulse": 72`, `"pulse": "fast"`, 1),
			wantStatus: http.StatusBadRequest, wantCode: CodeValidationFailed,
			wantFields: []string{"pulse"},
		},
		{
			name: "wrong type decimal for int", body: strings.Replace(validBody, `"respiration_rate": 16`, `"respiration_rate": 16.5`, 1),
			wantStatus: http.StatusBadRequest, wantCode: CodeValidationFailed,
			wantFields: []string{"respiration_rate"},
		},
		{
			name: "wrong type string for bool", body: strings.Replace(validBody, `false`, `"no"`, 1),
			wantStatus: http.StatusBadRequest, wantCode: CodeValidationFailed,
			wantFields: []string{"on_supplemental_oxygen"},
		},
		{
			name: "malformed JSON", body: `{"pulse": 72,`,
			wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON,
		},
		{
			name: "top-level array", body: `[1, 2, 3]`,
			wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON,
		},
		{
			name: "empty body", body: ``,
			wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON,
		},
		{
			name: "trailing data after object", body: validBody + ` {"pulse": 200}`,
			wantStatus: http.StatusBadRequest, wantCode: CodeInvalidJSON,
		},
		{
			name: "body too large", body: `{"x": "` + strings.Repeat("a", maxBodyBytes) + `"}`,
			wantStatus: http.StatusRequestEntityTooLarge, wantCode: CodeBodyTooLarge,
		},
		{
			name: "wrong content type", body: validBody, contentType: "text/plain",
			wantStatus: http.StatusUnsupportedMediaType, wantCode: CodeUnsupportedMediaType,
		},
		{
			name: "GET is not allowed", method: http.MethodGet,
			wantStatus: http.StatusMethodNotAllowed,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			method := tc.method
			if method == "" {
				method = http.MethodPost
			}
			req := httptest.NewRequest(method, "/score", strings.NewReader(tc.body))
			ct := tc.contentType
			if ct == "" {
				ct = "application/json"
			}
			req.Header.Set("Content-Type", ct)
			rec := httptest.NewRecorder()

			newTestRouter().ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d; body: %s", rec.Code, tc.wantStatus, rec.Body)
			}
			if tc.wantCode == "" {
				return
			}

			var resp ErrorResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("response is not JSON: %v; body: %s", err, rec.Body)
			}
			if resp.Code != tc.wantCode {
				t.Errorf("code = %q, want %q", resp.Code, tc.wantCode)
			}
			if resp.Error == "" {
				t.Error(`"error" message is empty`)
			}
			var gotFields []string
			for _, f := range resp.Fields {
				gotFields = append(gotFields, f.Field)
				if f.Message == "" {
					t.Errorf("field %q has an empty message", f.Field)
				}
			}
			if !slices.Equal(gotFields, tc.wantFields) {
				t.Errorf("fields = %v, want %v", gotFields, tc.wantFields)
			}
		})
	}
}

// TestScoreSuccess checks the 200 response as raw JSON (map[string]any), not
// by decoding into triage.Result: decoding into our own struct would hide a
// wrong JSON tag, because the same tag would be used on both sides.
func TestScoreSuccess(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		wantKeys    []string // top-level keys, sorted
		wantTotal   float64  // JSON numbers decode to float64 in a map
		wantBand    string
		wantDrivers []map[string]any
	}{
		{
			name:        "normal patient: low, empty drivers, minimal note",
			body:        validBody,
			wantKeys:    []string{"band", "drivers", "note", "total"},
			wantTotal:   0,
			wantBand:    "low",
			wantDrivers: []map[string]any{},
		},
		{
			name:      "respiration 8 alone: red_flagged",
			body:      strings.Replace(validBody, `"respiration_rate": 16`, `"respiration_rate": 8`, 1),
			wantKeys:  []string{"band", "drivers", "total"},
			wantTotal: 3,
			wantBand:  "red_flagged",
			wantDrivers: []map[string]any{
				{"parameter": "respiration_rate", "value": float64(8), "points": float64(3)},
			},
		},
		{
			name: "medium with a red parameter: every value type in drivers",
			body: strings.NewReplacer(
				`"consciousness": "alert"`, `"consciousness": "new_confusion"`,
				`"on_supplemental_oxygen": false`, `"on_supplemental_oxygen": true`,
			).Replace(validBody),
			wantKeys:  []string{"band", "drivers", "total"},
			wantTotal: 5,
			wantBand:  "medium",
			wantDrivers: []map[string]any{
				{"parameter": "consciousness", "value": "new_confusion", "points": float64(3)},
				{"parameter": "on_supplemental_oxygen", "value": true, "points": float64(2)},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/score", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			newTestRouter().ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}

			var got map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatalf("response is not a JSON object: %v; body: %s", err, rec.Body)
			}
			keys := slices.Sorted(maps.Keys(got))
			if !slices.Equal(keys, tc.wantKeys) {
				t.Errorf("keys = %v, want %v", keys, tc.wantKeys)
			}
			if got["total"] != tc.wantTotal {
				t.Errorf("total = %v, want %v", got["total"], tc.wantTotal)
			}
			if got["band"] != tc.wantBand {
				t.Errorf("band = %v, want %v", got["band"], tc.wantBand)
			}

			// drivers must be a JSON array (never null), even when empty.
			rawDrivers, ok := got["drivers"].([]any)
			if !ok {
				t.Fatalf("drivers = %#v, want a JSON array", got["drivers"])
			}
			if len(rawDrivers) != len(tc.wantDrivers) {
				t.Fatalf("got %d drivers, want %d: %v", len(rawDrivers), len(tc.wantDrivers), rawDrivers)
			}
			for i, raw := range rawDrivers {
				d, ok := raw.(map[string]any)
				if !ok || !maps.Equal(d, tc.wantDrivers[i]) {
					t.Errorf("drivers[%d] = %v, want %v", i, raw, tc.wantDrivers[i])
				}
			}
		})
	}
}
