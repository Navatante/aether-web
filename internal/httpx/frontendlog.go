package httpx

import (
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"
)

// Límites defensivos: el endpoint es público (la página de login también
// loguea), así que se acota el tamaño de lo que se acepta.
const (
	maxLogMessageLen = 2000
	maxLogContextLen = 200
)

type frontendLogReq struct {
	Level   string `json:"level"`
	Message string `json:"message"`
	Context string `json:"context"`
}

// RegisterFrontendLogs monta POST /logs: recibe logs del frontend
// (web/src/lib/logger.ts) y los reemite por slog para que acaben en journald
// junto a los del backend.
func RegisterFrontendLogs(g *echo.Group, logger *slog.Logger) {
	g.POST("/logs", func(c echo.Context) error {
		var req frontendLogReq
		if err := c.Bind(&req); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
		}
		if req.Message == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "message is required")
		}
		if len(req.Message) > maxLogMessageLen {
			req.Message = req.Message[:maxLogMessageLen]
		}
		if len(req.Context) > maxLogContextLen {
			req.Context = req.Context[:maxLogContextLen]
		}

		var lvl slog.Level
		switch req.Level {
		case "error":
			lvl = slog.LevelError
		case "warn":
			lvl = slog.LevelWarn
		case "debug", "trace":
			lvl = slog.LevelDebug
		default:
			lvl = slog.LevelInfo
		}

		logger.LogAttrs(c.Request().Context(), lvl, req.Message,
			slog.String("source", "frontend"),
			slog.String("context", req.Context),
			slog.String("remote_ip", c.RealIP()),
			slog.String("request_id", c.Response().Header().Get(echo.HeaderXRequestID)),
		)
		return c.NoContent(http.StatusNoContent)
	})
}
