package comisiones

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
	administrativo := auth.RequirePermission(auth.PermAdministrativo)

	// Comisión
	g.GET("/comisiones", h.List, mw)
	g.GET("/comisiones/with-people", h.ListWithPeople, mw)
	g.GET("/comisiones/dias", h.DiasComision, mw)
	g.POST("/comisiones", h.Create, mw, administrativo)
	g.PUT("/comisiones/:id", h.Update, mw, administrativo)
	g.DELETE("/comisiones/:id", h.Delete, mw, administrativo)

	// person→comisión
	g.POST("/comisiones/:id/people", h.AssignPeople, mw, administrativo)
	g.DELETE("/comisiones/:id/people/:personId", h.RemovePerson, mw, administrativo)
	g.DELETE("/person-comisiones/:id", h.DeletePersonComisionBySk, mw, administrativo)

	// comision_lugar (catálogo global)
	g.POST("/comision-lugares", h.CreateLugar, mw, administrativo)
	g.PUT("/comision-lugares/:id", h.UpdateLugar, mw, administrativo)
	g.DELETE("/comision-lugares/:id", h.DeleteLugar, mw, administrativo)
}

// ----- Helpers de handler -----

func currentEsc(c echo.Context) (int32, bool) {
	u := auth.CurrentUser(c)
	if u == nil {
		return 0, false
	}
	return int32(u.EscuadrillaID), true
}

func parseIDParam(c echo.Context, key string) (int32, error) {
	n, err := strconv.ParseInt(c.Param(key), 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return int32(n), nil
}

// ----- Listing -----

func parseQueryParams(c echo.Context) QueryParams {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	offset, _ := strconv.Atoi(c.QueryParam("offset"))
	sk, _ := strconv.Atoi(c.QueryParam("comision_sk"))
	return QueryParams{
		Limit:      int32(limit),
		Offset:     int32(offset),
		ComisionSk: int32(sk),
		DateFrom:   c.QueryParam("date_from"),
		DateTo:     c.QueryParam("date_to"),
	}
}

func (h *Handlers) List(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	res, err := h.svc.List(c.Request().Context(), esc, parseQueryParams(c))
	if errors.Is(err, ErrInvalidInput) {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) ListWithPeople(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	res, err := h.svc.ListWithPeople(c.Request().Context(), esc, parseQueryParams(c))
	if errors.Is(err, ErrInvalidInput) {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) DiasComision(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	items, err := h.svc.DiasComision(c.Request().Context(), esc, c.QueryParam("fechaFin"))
	if errors.Is(err, ErrInvalidInput) {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]any{"items": items})
}

// ----- Mutations -----

func (h *Handlers) Create(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var data ComisionFormData
	if err := c.Bind(&data); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	res, err := h.svc.Create(c.Request().Context(), esc, data)
	return respondMutation(c, http.StatusCreated, res, err)
}

func (h *Handlers) Update(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseIDParam(c, "id")
	if herr != nil {
		return herr
	}
	var data ComisionFormData
	if err := c.Bind(&data); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	err := h.svc.Update(c.Request().Context(), esc, id, data)
	return respondNoContent(c, err)
}

func (h *Handlers) Delete(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseIDParam(c, "id")
	if herr != nil {
		return herr
	}
	err := h.svc.Delete(c.Request().Context(), esc, id)
	return respondNoContent(c, err)
}

// ----- person→comisión -----

func (h *Handlers) AssignPeople(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	comisionSk, herr := parseIDParam(c, "id")
	if herr != nil {
		return herr
	}

	// Acepta dos shapes para compatibilidad:
	//   1. {"personas": ["1","2","3"]}  (Rust original, strings)
	//   2. {"personas": [1, 2, 3]}      (idiomático)
	var raw struct {
		Personas []any `json:"personas"`
	}
	if err := c.Bind(&raw); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	if len(raw.Personas) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "personas is empty")
	}
	personSks := make([]int32, 0, len(raw.Personas))
	for _, v := range raw.Personas {
		switch x := v.(type) {
		case float64:
			personSks = append(personSks, int32(x))
		case string:
			n, err := strconv.ParseInt(x, 10, 32)
			if err != nil {
				return echo.NewHTTPError(http.StatusBadRequest, "invalid person id: "+x)
			}
			personSks = append(personSks, int32(n))
		default:
			return echo.NewHTTPError(http.StatusBadRequest, "invalid persona entry")
		}
	}

	res, err := h.svc.AssignPeopleToComision(c.Request().Context(), esc, comisionSk, personSks)
	var verr *ValidationError
	switch {
	case errors.As(err, &verr):
		return c.JSON(http.StatusUnprocessableEntity, map[string]any{"errors": verr.Errors})
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(http.StatusCreated, res)
}

func (h *Handlers) RemovePerson(c echo.Context) error {
	if _, ok := currentEsc(c); !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	comisionSk, herr := parseIDParam(c, "id")
	if herr != nil {
		return herr
	}
	personSk, herr := parseIDParam(c, "personId")
	if herr != nil {
		return herr
	}
	err := h.svc.DeletePersonFromComision(c.Request().Context(), comisionSk, personSk)
	return respondNoContent(c, err)
}

func (h *Handlers) DeletePersonComisionBySk(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseIDParam(c, "id")
	if herr != nil {
		return herr
	}
	err := h.svc.DeletePersonComisionBySk(c.Request().Context(), esc, id)
	return respondNoContent(c, err)
}

// ----- Lugar -----

func (h *Handlers) CreateLugar(c echo.Context) error {
	if _, ok := currentEsc(c); !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req LugarCreateReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	res, err := h.svc.CreateLugar(c.Request().Context(), req.ComisionName)
	return respondMutation(c, http.StatusCreated, res, err)
}

func (h *Handlers) UpdateLugar(c echo.Context) error {
	if _, ok := currentEsc(c); !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseIDParam(c, "id")
	if herr != nil {
		return herr
	}
	var req LugarUpdateReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	err := h.svc.UpdateLugar(c.Request().Context(), id, req.Name)
	return respondNoContent(c, err)
}

func (h *Handlers) DeleteLugar(c echo.Context) error {
	if _, ok := currentEsc(c); !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseIDParam(c, "id")
	if herr != nil {
		return herr
	}
	err := h.svc.DeleteLugar(c.Request().Context(), id)
	return respondNoContent(c, err)
}

// ----- Response helpers -----

func respondMutation(c echo.Context, successCode int, payload any, err error) error {
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrDuplicate):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case errors.Is(err, ErrUnknownType), errors.Is(err, ErrUnknownLugar):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrInUse):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(successCode, payload)
}

func respondNoContent(c echo.Context, err error) error {
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrDuplicate):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case errors.Is(err, ErrUnknownType), errors.Is(err, ErrUnknownLugar):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrInUse):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}
