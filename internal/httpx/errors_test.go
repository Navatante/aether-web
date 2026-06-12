package httpx

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func runHandler(t *testing.T, err error) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/x", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	NewHTTPErrorHandler(logger)(err, c)
	return rec
}

func TestHTTPErrorsArePreserved(t *testing.T) {
	rec := runHandler(t, echo.NewHTTPError(http.StatusNotFound, "festivo: not found"))
	if rec.Code != http.StatusNotFound {
		t.Errorf("status: got %d, want 404", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "festivo: not found") {
		t.Errorf("el mensaje seguro del 4xx debería conservarse, body: %s", rec.Body.String())
	}
}

func TestInternalErrorsAreNotLeaked(t *testing.T) {
	leaky := errors.New(`ERROR: insert into detall.flight violates constraint "chk_no_overlap" (SQLSTATE 23514)`)
	rec := runHandler(t, leaky)
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status: got %d, want 500", rec.Code)
	}
	body := rec.Body.String()
	if strings.Contains(body, "detall.flight") || strings.Contains(body, "SQLSTATE") {
		t.Errorf("el 500 filtra detalle interno: %s", body)
	}
	if !strings.Contains(body, "internal server error") {
		t.Errorf("el 500 debería llevar mensaje genérico, body: %s", body)
	}
}

func TestWrapped5xxHTTPErrorsAreGeneric(t *testing.T) {
	rec := runHandler(t, echo.NewHTTPError(http.StatusInternalServerError, "pgx: connection refused host=10.0.0.7"))
	if strings.Contains(rec.Body.String(), "10.0.0.7") {
		t.Errorf("un *echo.HTTPError 5xx tampoco debe filtrar detalle: %s", rec.Body.String())
	}
}
