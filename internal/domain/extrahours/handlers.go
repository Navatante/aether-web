package extrahours

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
)

// ============================================================
// Handlers
// ============================================================

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	operacional := auth.RequirePermission(auth.PermOperacional)
	g.GET("/extra-hours", h.List, mw)
	g.GET("/extra-hours/person/:id", h.ListByPerson, mw)
	g.POST("/extra-hours", h.Insert, mw, operacional)
	g.PUT("/extra-hours/:id", h.Update, mw, operacional)
	g.DELETE("/extra-hours/:id", h.Delete, mw, operacional)
}

func (h *Handlers) Insert(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var data ExtraHourFormData
	if err := c.Bind(&data); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	res, err := h.svc.Insert(c.Request().Context(), int32(u.EscuadrillaID), data)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(http.StatusCreated, res)
}

func (h *Handlers) Update(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseIDParam(c)
	if herr != nil {
		return herr
	}
	var data ExtraHourFormData
	if err := c.Bind(&data); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	err := h.svc.Update(c.Request().Context(), int32(u.EscuadrillaID), id, data)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handlers) Delete(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseIDParam(c)
	if herr != nil {
		return herr
	}
	err := h.svc.Delete(c.Request().Context(), int32(u.EscuadrillaID), id)
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handlers) List(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	p := ListQueryParams{Search: c.QueryParam("q")}
	if n, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
		p.Limit = int32(n)
	}
	if n, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
		p.Offset = int32(n)
	}
	res, err := h.svc.ListPersonTotals(c.Request().Context(), int32(u.EscuadrillaID), p)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) ListByPerson(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	personSk, herr := parseIDParam(c)
	if herr != nil {
		return herr
	}
	items, err := h.svc.ListByPerson(c.Request().Context(), int32(u.EscuadrillaID), personSk)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, items)
}

func parseIDParam(c echo.Context) (int32, error) {
	n, err := strconv.ParseInt(c.Param("id"), 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return int32(n), nil
}
