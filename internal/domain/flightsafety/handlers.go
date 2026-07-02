package flightsafety

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/httpx"
)

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

// Register monta los endpoints bajo /flight-safety/*.
//
// La feature es Seguridad-only: tanto las lecturas de página como las escrituras
// exigen el nivel Seguridad (Superusuario pasa por god-mode). La única excepción
// es GET /flight-safety/me, accesible a cualquier autenticado: devuelve solo los
// datos de la propia persona de la sesión.
func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	seguridad := auth.RequirePermission(auth.PermSeguridad)

	// Panel del tripulante: datos propios (cualquier autenticado).
	g.GET("/flight-safety/me", h.Me, mw)

	// Resúmenes por persona (página de seguimiento, Seguridad).
	g.GET("/flight-safety/medical", h.MedicalList, mw, seguridad)
	g.GET("/flight-safety/dunker", h.DunkerList, mw, seguridad)
	g.GET("/flight-safety/hypobaric", h.HypobaricList, mw, seguridad)

	// Historial por persona.
	g.GET("/flight-safety/medical/history/:personSk", h.MedicalHistory, mw, seguridad)
	g.GET("/flight-safety/dunker/history/:personSk", h.DunkerHistory, mw, seguridad)
	g.GET("/flight-safety/hypobaric/history/:personSk", h.HypobaricHistory, mw, seguridad)

	// Altas / completar / borrar.
	g.POST("/flight-safety/medical", h.MedicalInsert, mw, seguridad)
	g.PUT("/flight-safety/medical/:id", h.MedicalUpdate, mw, seguridad)
	g.DELETE("/flight-safety/medical/:id", h.MedicalDelete, mw, seguridad)

	g.POST("/flight-safety/dunker", h.DunkerInsert, mw, seguridad)
	g.PUT("/flight-safety/dunker/:id", h.DunkerUpdate, mw, seguridad)
	g.DELETE("/flight-safety/dunker/:id", h.DunkerDelete, mw, seguridad)

	g.POST("/flight-safety/hypobaric", h.HypobaricInsert, mw, seguridad)
	g.PUT("/flight-safety/hypobaric/:id", h.HypobaricUpdate, mw, seguridad)
	g.DELETE("/flight-safety/hypobaric/:id", h.HypobaricDelete, mw, seguridad)
}

// ============================================================
// Panel del tripulante
// ============================================================

func (h *Handlers) Me(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	res, err := h.svc.Me(c.Request().Context(), int32(u.EscuadrillaID), int32(u.ID))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

// ============================================================
// Resúmenes (página)
// ============================================================

func (h *Handlers) MedicalList(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	items, err := h.svc.MedicalSummary(c.Request().Context(), int32(u.EscuadrillaID), allPersons)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handlers) DunkerList(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	items, err := h.svc.DunkerSummary(c.Request().Context(), int32(u.EscuadrillaID), allPersons)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handlers) HypobaricList(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	items, err := h.svc.HypobaricSummary(c.Request().Context(), int32(u.EscuadrillaID), allPersons)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, items)
}

// ============================================================
// Historial
// ============================================================

func (h *Handlers) MedicalHistory(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	person, err := httpx.IDParam(c, "personSk")
	if err != nil {
		return err
	}
	items, err := h.svc.MedicalHistory(c.Request().Context(), int32(u.EscuadrillaID), person)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handlers) DunkerHistory(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	person, err := httpx.IDParam(c, "personSk")
	if err != nil {
		return err
	}
	items, err := h.svc.DunkerHistory(c.Request().Context(), int32(u.EscuadrillaID), person)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handlers) HypobaricHistory(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	person, err := httpx.IDParam(c, "personSk")
	if err != nil {
		return err
	}
	items, err := h.svc.HypobaricHistory(c.Request().Context(), int32(u.EscuadrillaID), person)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, items)
}

// ============================================================
// Altas / completar / borrar — médico
// ============================================================

func (h *Handlers) MedicalInsert(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var p MedicalPayload
	if err := c.Bind(&p); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	res, err := h.svc.InsertMedical(c.Request().Context(), int32(u.EscuadrillaID), p)
	return writeInsert(c, res, err)
}

func (h *Handlers) MedicalUpdate(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, err := httpx.IDParam(c, "id")
	if err != nil {
		return err
	}
	var p MedicalPayload
	if err := c.Bind(&p); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	return mapWrite(c, h.svc.UpdateMedical(c.Request().Context(), int32(u.EscuadrillaID), id, p))
}

func (h *Handlers) MedicalDelete(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, err := httpx.IDParam(c, "id")
	if err != nil {
		return err
	}
	return mapWrite(c, h.svc.DeleteMedical(c.Request().Context(), int32(u.EscuadrillaID), id))
}

// ============================================================
// Altas / completar / borrar — dunker
// ============================================================

func (h *Handlers) DunkerInsert(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var p ExamPayload
	if err := c.Bind(&p); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	res, err := h.svc.InsertDunker(c.Request().Context(), int32(u.EscuadrillaID), p)
	return writeInsert(c, res, err)
}

func (h *Handlers) DunkerUpdate(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, err := httpx.IDParam(c, "id")
	if err != nil {
		return err
	}
	var p ExamPayload
	if err := c.Bind(&p); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	return mapWrite(c, h.svc.UpdateDunker(c.Request().Context(), int32(u.EscuadrillaID), id, p))
}

func (h *Handlers) DunkerDelete(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, err := httpx.IDParam(c, "id")
	if err != nil {
		return err
	}
	return mapWrite(c, h.svc.DeleteDunker(c.Request().Context(), int32(u.EscuadrillaID), id))
}

// ============================================================
// Altas / completar / borrar — hipobárica
// ============================================================

func (h *Handlers) HypobaricInsert(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var p ExamPayload
	if err := c.Bind(&p); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	res, err := h.svc.InsertHypobaric(c.Request().Context(), int32(u.EscuadrillaID), p)
	return writeInsert(c, res, err)
}

func (h *Handlers) HypobaricUpdate(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, err := httpx.IDParam(c, "id")
	if err != nil {
		return err
	}
	var p ExamPayload
	if err := c.Bind(&p); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	return mapWrite(c, h.svc.UpdateHypobaric(c.Request().Context(), int32(u.EscuadrillaID), id, p))
}

func (h *Handlers) HypobaricDelete(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, err := httpx.IDParam(c, "id")
	if err != nil {
		return err
	}
	return mapWrite(c, h.svc.DeleteHypobaric(c.Request().Context(), int32(u.EscuadrillaID), id))
}

// ============================================================
// Util
// ============================================================

// writeInsert mapea el resultado de un alta a HTTP.
func writeInsert(c echo.Context, res InsertResult, err error) error {
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(http.StatusCreated, res)
}

// mapWrite mapea el error de un update/delete a HTTP (204 si nil).
func mapWrite(c echo.Context, err error) error {
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
