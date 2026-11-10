// Command server runs the clinical triage HTTP API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"clinicaltriage/backend/internal/api"
)

const (
	defaultPort     = "8080"
	shutdownTimeout = 10 * time.Second
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("server stopped with error", "err", err)
		os.Exit(1)
	}
}

// run starts the server and blocks until it fails or receives SIGINT/SIGTERM,
// then shuts down gracefully. Keeping this out of main means main has a
// single exit path and every deferred call in run actually executes.
func run(logger *slog.Logger) error {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: api.NewRouter(logger),
		// Timeouts stop slow or stalled clients from holding connections open forever.
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		// Route net/http's own internal errors through slog too.
		ErrorLog: slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}

	// ctx is cancelled when the process receives Ctrl-C (SIGINT) or the
	// SIGTERM that Render, Docker and Kubernetes send before stopping it.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// ListenAndServe blocks, so run it in a goroutine and report its result.
	serverErr := make(chan error, 1)
	go func() {
		logger.Info("server listening", "addr", srv.Addr)
		serverErr <- srv.ListenAndServe()
	}()

	select {
	case err := <-serverErr:
		// The server stopped on its own, e.g. the port is already in use.
		return err
	case <-ctx.Done():
		// Restore default signal handling: a second Ctrl-C now kills immediately.
		stop()
		logger.Info("shutdown signal received, draining connections")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	// After Shutdown, ListenAndServe returns ErrServerClosed: that is success.
	if err := <-serverErr; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	logger.Info("server stopped cleanly")
	return nil
}
