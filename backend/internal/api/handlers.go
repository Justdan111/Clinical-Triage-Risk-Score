// Package api is the HTTP layer: it turns requests into domain calls and
// domain results (or errors) into HTTP responses. Clinical rules live in the
// triage package, not here.
package api

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"reflect"

	"clinicaltriage/backend/internal/triage"
)

// maxBodyBytes caps the /score request body. A complete vitals object is
// about 200 bytes; 4 KiB leaves room for whitespace while stopping a client
// from making the server read megabytes of junk.
const maxBodyBytes = 4 << 10

// Machine-readable error codes. Clients should branch on these, not on the
// human-readable "error" text, which may be reworded.
const (
	CodeInvalidJSON          = "invalid_json"
	CodeValidationFailed     = "validation_failed"
	CodeBodyTooLarge         = "body_too_large"
	CodeUnsupportedMediaType = "unsupported_media_type"
	CodeInternal             = "internal"
)

// ErrorResponse is the JSON body of every non-2xx response.
type ErrorResponse struct {
	Error  string              `json:"error"`
	Code   string              `json:"code"`
	Fields []triage.FieldError `json:"fields,omitempty"`
}

// NewRouter builds the HTTP routes. Returning an http.Handler (rather than
// starting a server) lets tests exercise the real routing table without a
// network listener.
func NewRouter(logger *slog.Logger) http.Handler {
	h := &handlers{logger: logger}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("POST /score", h.score)
	return mux
}

// handlers holds the dependencies the handler functions share.
type handlers struct {
	logger *slog.Logger
}

// health reports that the process is up and serving requests.
func (h *handlers) health(w http.ResponseWriter, r *http.Request) {
	h.writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// score decodes a Vitals body and returns its NEWS2 Result (200), or a 4xx
// ErrorResponse naming what was wrong with the request.
func (h *handlers) score(w http.ResponseWriter, r *http.Request) {
	if ct := r.Header.Get("Content-Type"); ct != "" {
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			h.writeError(w, http.StatusUnsupportedMediaType, ErrorResponse{
				Error: "Content-Type must be application/json",
				Code:  CodeUnsupportedMediaType,
			})
			return
		}
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	var v triage.Vitals
	if status, resp, ok := decodeJSON(r.Body, &v); !ok {
		h.logger.Info("score request rejected", "code", resp.Code, "status", status)
		h.writeError(w, status, resp)
		return
	}

	// Score validates before scoring, so there is one call and no way to score
	// unvalidated input.
	res, err := triage.Score(v)
	if err != nil {
		var ve *triage.ValidationError
		if !errors.As(err, &ve) {
			// Score only fails with *ValidationError; anything else is a bug.
			h.logger.Error("unexpected validation error", "err", err)
			h.writeError(w, http.StatusInternalServerError, ErrorResponse{
				Error: "internal error", Code: CodeInternal,
			})
			return
		}
		h.logger.Info("score request rejected", "code", CodeValidationFailed, "fields", len(ve.Errors))
		h.writeError(w, http.StatusBadRequest, ErrorResponse{
			Error:  "one or more vitals are missing or invalid",
			Code:   CodeValidationFailed,
			Fields: ve.Errors,
		})
		return
	}

	// Log the outcome, never the vitals themselves (patient data).
	h.logger.Info("scored", "band", res.Band, "total", res.Total)
	h.writeJSON(w, http.StatusOK, res)
}

// decodeJSON reads exactly one JSON object from body into dst. On failure it
// returns the HTTP status and error body to send, and ok == false.
//
// It inspects error *types* (never error text), because the wording of
// encoding/json errors is not stable across Go versions.
func decodeJSON(body io.Reader, dst any) (status int, resp ErrorResponse, ok bool) {
	dec := json.NewDecoder(body)
	err := dec.Decode(dst)
	if err == nil {
		// Reject trailing data such as `{...}{...}` or `{...} junk`.
		if dec.Decode(&struct{}{}) != io.EOF {
			return http.StatusBadRequest, ErrorResponse{
				Error: "request body must contain a single JSON object",
				Code:  CodeInvalidJSON,
			}, false
		}
		return 0, ErrorResponse{}, true
	}

	var maxErr *http.MaxBytesError
	var typeErr *json.UnmarshalTypeError
	switch {
	case errors.As(err, &maxErr):
		return http.StatusRequestEntityTooLarge, ErrorResponse{
			Error: "request body is too large",
			Code:  CodeBodyTooLarge,
		}, false
	case errors.Is(err, io.EOF):
		return http.StatusBadRequest, ErrorResponse{
			Error: "request body is empty",
			Code:  CodeInvalidJSON,
		}, false
	case errors.As(err, &typeErr) && typeErr.Field != "":
		// e.g. {"pulse": "fast"}: the JSON is well-formed but a value has the
		// wrong type. typeErr.Field is the JSON name, so we can report it.
		return http.StatusBadRequest, ErrorResponse{
			Error: "one or more vitals have the wrong type",
			Code:  CodeValidationFailed,
			Fields: []triage.FieldError{{
				Field:   typeErr.Field,
				Message: "has the wrong type; expected " + describeType(typeErr.Type),
			}},
		}, false
	default:
		// Syntax errors, a top-level value that is not an object, etc.
		return http.StatusBadRequest, ErrorResponse{
			Error: "request body is not valid JSON",
			Code:  CodeInvalidJSON,
		}, false
	}
}

// describeType names a Go type in API terms, so clients see "a whole number"
// rather than Go type names like "triage.Consciousness". Pointers (our
// optional fields) are unwrapped to the type they point to.
func describeType(t reflect.Type) string {
	for t != nil && t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	if t == nil {
		return "a different type"
	}
	switch t.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return "a whole number"
	case reflect.Float32, reflect.Float64:
		return "a number"
	case reflect.Bool:
		return "true or false"
	case reflect.String:
		return "a string"
	}
	return "a different type"
}

// writeError writes an ErrorResponse with the given status.
func (h *handlers) writeError(w http.ResponseWriter, status int, resp ErrorResponse) {
	h.writeJSON(w, status, resp)
}

// writeJSON sets the JSON content type, writes the status, then the body.
// Headers must be set before WriteHeader; after that they are ignored.
func (h *handlers) writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		// The status is already sent, so all we can do is log it.
		h.logger.Error("writing response body", "err", err)
	}
}
