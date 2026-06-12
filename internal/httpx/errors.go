// Package httpx contiene helpers HTTP transversales (manejo central de
// errores, etc.) que no pertenecen a ningún dominio concreto.
package httpx

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"
)

// NewHTTPErrorHandler devuelve el manejador central de errores de Echo.
//
// Contrato con los handlers de dominio:
//   - Errores esperables (validación, not found, duplicado...) se devuelven
//     como *echo.HTTPError con código 4xx y mensaje seguro: se respetan tal cual.
//   - Cualquier otro error (pgx, IO, bugs) se devuelve sin envolver; aquí se
//     loguea con el request ID y se responde un 500 genérico para no filtrar
//     detalles internos (SQL, nombres de tablas, constraints) al navegador.
func NewHTTPErrorHandler(logger *slog.Logger) echo.HTTPErrorHandler {
	return func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}

		code := http.StatusInternalServerError
		msg := "internal server error"
		var he *echo.HTTPError
		if errors.As(err, &he) {
			code = he.Code
			if m, ok := he.Message.(string); ok {
				msg = m
			} else {
				msg = http.StatusText(code)
			}
		}
		// Nunca exponer detalle interno en 5xx, venga de donde venga.
		if code >= http.StatusInternalServerError {
			msg = "internal server error"
			logger.Error("request failed",
				slog.String("request_id", c.Response().Header().Get(echo.HeaderXRequestID)),
				slog.String("method", c.Request().Method),
				slog.String("path", c.Request().URL.Path),
				slog.Int("status", code),
				slog.Any("err", err),
			)
		}

		var werr error
		if c.Request().Method == http.MethodHead {
			werr = c.NoContent(code)
		} else {
			werr = c.JSON(code, map[string]string{"message": msg})
		}
		if werr != nil {
			logger.Error("failed to write error response",
				slog.String("request_id", c.Response().Header().Get(echo.HeaderXRequestID)),
				slog.Any("err", werr),
			)
		}
	}
}
