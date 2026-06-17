package groundschool

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
	g.GET("/ground-school", h.List, mw)
	g.POST("/ground-school", h.Insert, mw, operacional)
	g.DELETE("/ground-school/:id", h.Delete, mw, operacional)
}

func (h *Handlers) Insert(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var data GroundSchoolFormData
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
	p := ListQueryParams{}
	if n, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
		p.Limit = int32(n)
	}
	if n, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
		p.Offset = int32(n)
	}
	if n, err := strconv.Atoi(c.QueryParam("ground_school_sk")); err == nil {
		p.GroundSchoolSk = int32(n)
	}
	res, err := h.svc.List(c.Request().Context(), int32(u.EscuadrillaID), p)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func parseIDParam(c echo.Context) (int32, error) {
	n, err := strconv.ParseInt(c.Param("id"), 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return int32(n), nil
}
