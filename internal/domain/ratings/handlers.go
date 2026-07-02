package ratings

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/httpx"
)

// ============================================================
// Handlers
// ============================================================

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	// Operacional califica tripulaciones (táctica, liderazgo, modelo);
	// Administrativo califica mantenimiento. Los endpoints crew/not-crew
	// están compartidos entre ambas páginas, así que se permiten ambos roles.
	gestor := auth.RequirePermission(auth.PermOperacional, auth.PermAdministrativo)
	g.POST("/ratings/crew", h.AddCrew, mw, gestor)
	g.DELETE("/ratings/crew/:id", h.DeleteCrew, mw, gestor)
	g.POST("/ratings/not-crew", h.AddNotCrew, mw, gestor)
	g.DELETE("/ratings/not-crew/:id", h.DeleteNotCrew, mw, gestor)
	g.GET("/ratings/model", h.Model, mw)
	g.GET("/ratings/operational", h.Operational, mw)
	g.GET("/ratings/general-tactical", h.GeneralTactical, mw)
	g.GET("/ratings/leadership", h.Leadership, mw)
	g.GET("/ratings/maintenance", h.Maintenance, mw)
}

func (h *Handlers) AddCrew(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req AddCrewRatingReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	id, err := h.svc.AddCrewRating(c.Request().Context(), esc, req)
	return respondCreated(c, map[string]int32{"id": id}, err)
}

func (h *Handlers) DeleteCrew(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := httpx.IDParam(c, "id")
	if herr != nil {
		return herr
	}
	return respondNoContent(c, h.svc.DeleteCrewRating(c.Request().Context(), esc, id))
}

func (h *Handlers) AddNotCrew(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req AddNotCrewRatingReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	id, err := h.svc.AddNotCrewRating(c.Request().Context(), esc, req)
	return respondCreated(c, map[string]int32{"id": id}, err)
}

func (h *Handlers) DeleteNotCrew(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := httpx.IDParam(c, "id")
	if herr != nil {
		return herr
	}
	return respondNoContent(c, h.svc.DeleteNotCrewRating(c.Request().Context(), esc, id))
}

func (h *Handlers) Model(c echo.Context) error           { return getResult(c, h.svc.Model) }
func (h *Handlers) Operational(c echo.Context) error     { return getResult(c, h.svc.Operational) }
func (h *Handlers) GeneralTactical(c echo.Context) error { return getResult(c, h.svc.GeneralTactical) }
func (h *Handlers) Leadership(c echo.Context) error      { return getResult(c, h.svc.Leadership) }
func (h *Handlers) Maintenance(c echo.Context) error     { return getResult(c, h.svc.Maintenance) }

// ============================================================
// Helpers
// ============================================================

func currentEsc(c echo.Context) (int32, bool) {
	u := auth.CurrentUser(c)
	if u == nil {
		return 0, false
	}
	return int32(u.EscuadrillaID), true
}

func parseOptionalDate(s string) (pgtype.Date, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return pgtype.Date{}, nil // NULL
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return pgtype.Date{}, err
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func parseOptionalTimestamp(s string) (pgtype.Timestamptz, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return pgtype.Timestamptz{}, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return pgtype.Timestamptz{}, err
	}
	return pgtype.Timestamptz{Time: t, Valid: true}, nil
}

func numericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return 0
	}
	return f.Float64
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func respondCreated(c echo.Context, payload any, err error) error {
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrDuplicate):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(http.StatusCreated, payload)
}

func respondNoContent(c echo.Context, err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func getResult[T any](c echo.Context, fn func(context.Context, int32) (T, error)) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	res, err := fn(c.Request().Context(), esc)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}
