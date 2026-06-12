package dashboard

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
)

type Handlers struct {
	svc *Service
}

func NewHandlers(svc *Service) *Handlers {
	return &Handlers{svc: svc}
}

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	g.GET("/dashboard/static-stats", h.StaticStats, auth.RequireAuth(authSvc))
	g.POST("/dashboard/dynamic-stats", h.DynamicStats, auth.RequireAuth(authSvc))
}

func (h *Handlers) StaticStats(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	stats, err := h.svc.StaticStats(c.Request().Context(), user.EscuadrillaID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, stats)
}

func (h *Handlers) DynamicStats(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req Request
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	rng, err := ResolveRange(req, time.Time{})
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	stats, err := h.svc.DynamicStats(c.Request().Context(), user.EscuadrillaID, rng)
	if err != nil {
		if errors.Is(err, errInvalidRange) {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, stats)
}

// Reservado para futuro: marker para distinguir errores de rango de errores de BD.
var errInvalidRange = errors.New("dashboard: invalid range")
