package lookups

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
)

type Handlers struct {
	svc *Service
}

func NewHandlers(svc *Service) *Handlers {
	return &Handlers{svc: svc}
}

// Register monta los endpoints del dominio bajo /lookups/* protegidos con RequireAuth.
func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	operacional := auth.RequirePermission(auth.PermOperacional)

	// Lectura unificada: GET /lookups/:name
	g.GET("/lookups/:name", h.Get, mw)

	// Mutaciones: cada recurso CRUDable bajo su path semántico.
	// Se gestionan desde el formulario de registro de vuelo (Operacional).
	g.POST("/lookups/departure-arrival-places", h.AddDepartureArrivalPlace, mw, operacional)
	g.DELETE("/lookups/departure-arrival-places/:id", h.DeleteDepartureArrivalPlace, mw, operacional)

	g.POST("/lookups/aircrafts", h.AddAircraft, mw, operacional)
	g.DELETE("/lookups/aircrafts/:id", h.DeleteAircraft, mw, operacional)
	g.PATCH("/lookups/aircrafts/:id", h.UpdateAircraftCurrentFlag, mw, operacional)

	// Asignaciones de capacidades básicas (capba) de la escuadrilla.
	g.POST("/lookups/escuadrilla-capbas", h.AddEscuadrillaCapba, mw, operacional)
	g.PATCH("/lookups/escuadrilla-capbas/:id", h.UpdateEscuadrillaCapba, mw, operacional)
	g.DELETE("/lookups/escuadrilla-capbas/:id", h.DeleteEscuadrillaCapba, mw, operacional)

	// NB: POST/DELETE de eventos vivían aquí hasta Lote 2; ahora están en /events.
}

// ============================================================================
// GET /lookups/:name
// ============================================================================

func (h *Handlers) Get(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	esc := int32(user.EscuadrillaID)
	ctx := c.Request().Context()

	name := c.Param("name")
	var (
		data any
		err  error
	)
	switch name {
	// Lookups con RLS por escuadrilla
	case "aircrafts":
		data, err = h.svc.Aircrafts(ctx, esc)
	case "aircrafts-manage":
		data, err = h.svc.AircraftsManage(ctx, esc)
	case "pilots":
		data, err = h.svc.Pilots(ctx, esc)
	case "crew":
		data, err = h.svc.Crew(ctx, esc)
	case "papeletas":
		data, err = h.svc.Papeletas(ctx, esc)
	case "ground-school-papeletas":
		data, err = h.svc.GroundSchoolPapeletas(ctx, esc)
	case "capbas":
		data, err = h.svc.Capbas(ctx, esc)
	case "escuadrilla-capbas":
		data, err = h.svc.EscuadrillaCapbas(ctx, esc)
	case "recent-comisiones":
		data, err = h.svc.RecentComisiones(ctx, esc)
	case "persons-for-comision":
		data, err = h.svc.PersonsForComision(ctx, esc)
	case "persons":
		data, err = h.svc.Persons(ctx, esc)
	case "persons-nk":
		data, err = h.svc.PersonsNk(ctx, esc)

	// Lookups globales (sin escuadrilla)
	case "departure-arrival-places":
		data, err = h.svc.DepartureArrivalPlaces(ctx)
	case "events-manage":
		data, err = h.svc.EventsManage(ctx)
	case "events":
		data, err = h.svc.Events(ctx)
	case "authorities":
		data, err = h.svc.Authorities(ctx)
	case "capba-catalog":
		data, err = h.svc.CapbaCatalog(ctx)
	case "passenger-types":
		data, err = h.svc.PassengerTypes(ctx)
	case "comision-types":
		data, err = h.svc.ComisionTypes(ctx)
	case "comision-lugares":
		data, err = h.svc.ComisionLugares(ctx)

	// Lookups planos (vector de strings)
	case "event-names":
		data, err = h.svc.EventNames(ctx)
	case "papeleta-bloques":
		data, err = h.svc.PapeletaBloques(ctx)
	case "papeleta-planes":
		data, err = h.svc.PapeletaPlanes(ctx)
	case "person-especialidades":
		data, err = h.svc.PersonEspecialidades(ctx)
	case "person-empleos":
		data, err = h.svc.PersonEmpleos(ctx)
	case "person-divisiones":
		data, err = h.svc.PersonDivisiones(ctx)
	case "person-roles":
		data, err = h.svc.PersonRoles(ctx)

	default:
		return echo.NewHTTPError(http.StatusNotFound, "unknown lookup: "+name)
	}

	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, data)
}

// ============================================================================
// Mutaciones
// ============================================================================

func (h *Handlers) AddDepartureArrivalPlace(c echo.Context) error {
	var req AddDepartureArrivalPlaceReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	return mapErrToHTTP(h.svc.AddDepartureArrivalPlace(c.Request().Context(), req),
		map[error]int{ErrUniqueCode: http.StatusConflict, ErrUniqueName: http.StatusConflict, ErrInvalidInput: http.StatusBadRequest},
		http.StatusCreated)
}

func (h *Handlers) DeleteDepartureArrivalPlace(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return err
	}
	return mapErrToHTTP(h.svc.DeleteDepartureArrivalPlace(c.Request().Context(), id),
		map[error]int{ErrNotFound: http.StatusNotFound, ErrInUse: http.StatusConflict},
		http.StatusNoContent)
}

func (h *Handlers) AddAircraft(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req AddAircraftReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	return mapErrToHTTP(h.svc.AddAircraft(c.Request().Context(), int32(user.EscuadrillaID), req),
		map[error]int{ErrUniqueCode: http.StatusConflict, ErrUniqueName: http.StatusConflict, ErrInvalidInput: http.StatusBadRequest},
		http.StatusCreated)
}

func (h *Handlers) DeleteAircraft(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, err := parseID(c)
	if err != nil {
		return err
	}
	return mapErrToHTTP(h.svc.DeleteAircraft(c.Request().Context(), int32(user.EscuadrillaID), id),
		map[error]int{ErrNotFound: http.StatusNotFound, ErrInUse: http.StatusConflict},
		http.StatusNoContent)
}

func (h *Handlers) UpdateAircraftCurrentFlag(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, err := parseID(c)
	if err != nil {
		return err
	}
	var req UpdateAircraftCurrentFlagReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	persisted, serr := h.svc.UpdateAircraftCurrentFlag(c.Request().Context(), int32(user.EscuadrillaID), id, req.CurrentFlag)
	if errors.Is(serr, ErrNotFound) {
		return echo.NewHTTPError(http.StatusNotFound)
	}
	if serr != nil {
		return serr
	}
	return c.JSON(http.StatusOK, map[string]bool{"aircraft_current_flag": persisted})
}

func (h *Handlers) AddEscuadrillaCapba(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req AddEscuadrillaCapbaReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	return mapErrToHTTP(h.svc.AddEscuadrillaCapba(c.Request().Context(), int32(user.EscuadrillaID), req),
		map[error]int{ErrCapbaAlreadyAssigned: http.StatusConflict, ErrInvalidInput: http.StatusBadRequest},
		http.StatusCreated)
}

func (h *Handlers) UpdateEscuadrillaCapba(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, err := parseID(c)
	if err != nil {
		return err
	}
	var req UpdateEscuadrillaCapbaReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	return mapErrToHTTP(h.svc.UpdateEscuadrillaCapba(c.Request().Context(), int32(user.EscuadrillaID), id, req),
		map[error]int{ErrNotFound: http.StatusNotFound, ErrInvalidInput: http.StatusBadRequest},
		http.StatusNoContent)
}

func (h *Handlers) DeleteEscuadrillaCapba(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, err := parseID(c)
	if err != nil {
		return err
	}
	return mapErrToHTTP(h.svc.DeleteEscuadrillaCapba(c.Request().Context(), int32(user.EscuadrillaID), id),
		map[error]int{ErrNotFound: http.StatusNotFound, ErrInUse: http.StatusConflict},
		http.StatusNoContent)
}

// ============================================================================
// Util
// ============================================================================

func parseID(c echo.Context) (int32, error) {
	raw := c.Param("id")
	n, err := strconv.ParseInt(raw, 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return int32(n), nil
}

func mapErrToHTTP(err error, m map[error]int, successCode int) error {
	if err == nil {
		// echo.NoContent / 201 sin cuerpo
		return nil
	}
	for sentinel, code := range m {
		if errors.Is(err, sentinel) {
			return echo.NewHTTPError(code, err.Error())
		}
	}
	return err
}
