// Package api is the HTTP layer: it turns requests into domain calls and
// domain results (or errors) into HTTP responses. Clinical rules live in the
// triage package, not here.
package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"mime"
	"net/http"

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
	CodeNotFound             = "not_found"
	CodeMethodNotAllowed     = "method_not_allowed"
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
	return h.jsonRoutingErrors(mux)
}

// handlers holds the dependencies the handler functions share.
type handlers struct {
	logger *slog.Logger
}

// jsonRoutingErrors makes the mux's own 404 and 405 answers use the same JSON
// ErrorResponse as every other error. ServeMux.Handler documents that it
// returns an empty pattern when no route applies; in that case we run the
// mux's handler against a probe to learn its status (404 or 405) and Allow
// header, then answer in JSON ourselves.
func (h *handlers) jsonRoutingErrors(mux *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handler, pattern := mux.Handler(r)
		if pattern != "" {
			mux.ServeHTTP(w, r)
			return
		}

		probe := &statusProbe{header: http.Header{}}
		handler.ServeHTTP(probe, r)

		switch probe.status {
		case http.StatusMethodNotAllowed:
			if allow := probe.header.Get("Allow"); allow != "" {
				w.Header().Set("Allow", allow)
			}
			h.writeError(w, http.StatusMethodNotAllowed, ErrorResponse{
				Error: "method not allowed", Code: CodeMethodNotAllowed,
			})
		case http.StatusNotFound:
			h.writeError(w, http.StatusNotFound, ErrorResponse{Error: "not found", Code: CodeNotFound})
		default:
			// e.g. a redirect for an unclean path: pass it through unchanged.
			mux.ServeHTTP(w, r)
		}
	})
}

// statusProbe is a ResponseWriter that only records the status and headers.
type statusProbe struct {
	header http.Header
	status int
}

func (p *statusProbe) Header() http.Header         { return p.header }
func (p *statusProbe) Write(b []byte) (int, error) { return len(b), nil }
func (p *statusProbe) WriteHeader(status int)      { p.status = status }

// health reports that the process is up and serving requests.
func (h *handlers) health(w http.ResponseWriter, r *http.Request) {
	h.writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// score decodes a Vitals body and returns its NEWS2 Result (200), or a 4xx
// ErrorResponse naming everything that was wrong with the request.
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

	fields, problems, reqErr := readObject(r.Body)
	if reqErr != nil {
		h.logger.Info("score request rejected", "code", reqErr.resp.Code, "status", reqErr.status)
		h.writeError(w, reqErr.status, reqErr.resp)
		return
	}
	v := vitalsFrom(fields, problems)

	// Score validates before scoring, so there is one call and no way to score
	// unvalidated input.
	res, err := triage.Score(v)
	if err != nil || len(problems) > 0 {
		var validation []triage.FieldError
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
			validation = ve.Errors
		}
		fieldErrs := mergeProblems(validation, problems)
		h.logger.Info("score request rejected", "code", CodeValidationFailed, "fields", len(fieldErrs))
		h.writeError(w, http.StatusBadRequest, ErrorResponse{
			Error:  "one or more vitals are missing or invalid",
			Code:   CodeValidationFailed,
			Fields: fieldErrs,
		})
		return
	}

	// Log the outcome, never the vitals themselves (patient data).
	h.logger.Info("scored", "band", res.Band, "total", res.Total)
	h.writeJSON(w, http.StatusOK, res)
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
