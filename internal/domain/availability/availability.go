// Package availability implementa get_availability + CRUD de detall.absence.
// Contrato JSON espejo de sp_get_availability (3 listas anidadas).
// RLS: el month/year vienen como query params, escuadrilla_fk se inyecta
// desde la sesión en TODAS las queries y mutaciones.
package availability

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/queries"
)

// ===== DTOs =====

type AvailabilityResult struct {
	Persons         []PersonItem   `json:"persons"`
	Absences        []AbsenceItem  `json:"absenses"` // sic: typo del SP original
	PersonComisions []ComisionItem `json:"person_comisions"`
}

type PersonItem struct {
	PersonSk  int32  `json:"person_sk"`
	FullName  string `json:"full_name"`
	PersonRol string `json:"person_rol"`
	Escala    string `json:"escala"`
}

type AbsenceItem struct {
	AbsenceSk        int32   `json:"absence_sk"`
	AbsenceStartDate string  `json:"absence_start_date"`
	AbsenceEndDate   string  `json:"absence_end_date"`
	AbsenceDias      int32   `json:"absence_dias"`
	AbsencePersonFk  int32   `json:"absence_person_fk"`
	AbsenceReason    string  `json:"absence_reason"`
	AbsenceRemark    *string `json:"absence_remark"`
}

type ComisionItem struct {
	PersonComisionSk  int32  `json:"person_comision_sk"`
	PersonFk          int32  `json:"person_fk"`
	ComisionStartDate string `json:"comision_start_date"`
	ComisionEndDate   string `json:"comision_end_date"`
	ComisionDias      int32  `json:"comision_dias"`
	ComisionLugar     string `json:"comision_lugar"`
}

// AbsenceWriteReq espeja AbsenceFormData / AbsenceUpdateData del Rust.
type AbsenceWriteReq struct {
	PersonFk      int32   `json:"person_fk"`
	StartDate     string  `json:"start_date"` // YYYY-MM-DD
	EndDate       string  `json:"end_date"`
	AbsenceReason string  `json:"absence_reason"` // nombre o ID
	Remark        *string `json:"remark"`
}

type AbsenceInsertResult struct {
	AbsenceSk int32  `json:"absence_sk"`
	Success   bool   `json:"success"`
	Message   string `json:"message"`
}

// ===== Sentinel errors =====

var (
	ErrNotFound      = errors.New("availability: not found")
	ErrInvalidInput  = errors.New("availability: invalid input")
	ErrUnknownReason = errors.New("availability: unknown absence_reason")
)

// ===== Service =====

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

// Get devuelve persons + absences + comisiones del mes dado. Month/Year a 0
// => mes/año actual (espeja el default del SP original).
func (s *Service) Get(ctx context.Context, esc int32, month, year int) (AvailabilityResult, error) {
	if month == 0 {
		month = int(time.Now().Month())
	}
	if year == 0 {
		year = time.Now().Year()
	}
	if month < 1 || month > 12 {
		return AvailabilityResult{}, ErrInvalidInput
	}
	if year < 1900 || year > 2100 {
		return AvailabilityResult{}, ErrInvalidInput
	}

	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, -1) // último día del mes
	pgStart := pgtype.Date{Time: start, Valid: true}
	pgEnd := pgtype.Date{Time: end, Valid: true}

	persons, err := s.q.AvailabilityPersons(ctx, esc)
	if err != nil {
		return AvailabilityResult{}, err
	}
	// Cuidado: sqlc nombra los param fields por la columna comparada en el
	// WHERE (a.absence_start_date <= $2, a.absence_end_date >= $1), NO por
	// la semántica del valor. El binding real es: $1 = AbsenceEndDate field,
	// $2 = AbsenceStartDate field. Por eso pasamos pgStart en EndDate y
	// pgEnd en StartDate — invertido respecto al nombre del campo.
	absRows, err := s.q.AvailabilityAbsences(ctx, queries.AvailabilityAbsencesParams{
		AbsenceEndDate:       pgStart, // $1 = month_start
		AbsenceStartDate:     pgEnd,   // $2 = month_end
		AbsenceEscuadrillaFk: esc,
	})
	if err != nil {
		return AvailabilityResult{}, err
	}
	comRows, err := s.q.AvailabilityComisiones(ctx, queries.AvailabilityComisionesParams{
		ComisionEndDate:       pgStart, // $1 = month_start
		ComisionStartDate:     pgEnd,   // $2 = month_end
		ComisionEscuadrillaFk: esc,
	})
	if err != nil {
		return AvailabilityResult{}, err
	}

	res := AvailabilityResult{
		Persons:         make([]PersonItem, 0, len(persons)),
		Absences:        make([]AbsenceItem, 0, len(absRows)),
		PersonComisions: make([]ComisionItem, 0, len(comRows)),
	}
	for _, p := range persons {
		res.Persons = append(res.Persons, PersonItem{
			PersonSk: p.PersonSk, FullName: p.FullName,
			PersonRol: p.PersonRol, Escala: p.Escala,
		})
	}
	for _, a := range absRows {
		res.Absences = append(res.Absences, AbsenceItem{
			AbsenceSk:        a.AbsenceSk,
			AbsenceStartDate: a.AbsenceStartDate.Time.Format("2006-01-02"),
			AbsenceEndDate:   a.AbsenceEndDate.Time.Format("2006-01-02"),
			AbsenceDias:      a.AbsenceDias,
			AbsencePersonFk:  a.AbsencePersonFk,
			AbsenceReason:    a.AbsenceReason,
			AbsenceRemark:    a.AbsenceRemark,
		})
	}
	for _, c := range comRows {
		res.PersonComisions = append(res.PersonComisions, ComisionItem{
			PersonComisionSk:  c.PersonComisionSk,
			PersonFk:          c.PersonFk,
			ComisionStartDate: c.ComisionStartDate.Time.Format("2006-01-02"),
			ComisionEndDate:   c.ComisionEndDate.Time.Format("2006-01-02"),
			ComisionDias:      c.ComisionDias,
			ComisionLugar:     c.ComisionLugar,
		})
	}
	return res, nil
}

func (s *Service) CreateAbsence(ctx context.Context, esc int32, req AbsenceWriteReq) (AbsenceInsertResult, error) {
	start, end, reasonFk, err := s.validate(ctx, req)
	if err != nil {
		return AbsenceInsertResult{}, err
	}
	id, err := s.q.InsertAbsence(ctx, queries.InsertAbsenceParams{
		AbsenceStartDate:     start,
		AbsenceEndDate:       end,
		AbsencePersonFk:      req.PersonFk,
		AbsenceReasonFk:      reasonFk,
		AbsenceRemark:        req.Remark,
		AbsenceEscuadrillaFk: esc,
	})
	if err != nil {
		return AbsenceInsertResult{}, err
	}
	return AbsenceInsertResult{
		AbsenceSk: id,
		Success:   true,
		Message:   "Ausencia registrada con ID: " + strconv.Itoa(int(id)),
	}, nil
}

func (s *Service) UpdateAbsence(ctx context.Context, esc int32, id int32, req AbsenceWriteReq) error {
	start, end, reasonFk, err := s.validate(ctx, req)
	if err != nil {
		return err
	}
	n, err := s.q.UpdateAbsence(ctx, queries.UpdateAbsenceParams{
		AbsenceStartDate:     start,
		AbsenceEndDate:       end,
		AbsenceReasonFk:      reasonFk,
		AbsenceRemark:        req.Remark,
		AbsenceSk:            id,
		AbsenceEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) DeleteAbsence(ctx context.Context, esc int32, id int32) error {
	n, err := s.q.DeleteAbsence(ctx, queries.DeleteAbsenceParams{
		AbsenceSk:            id,
		AbsenceEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// validate parsea fechas, resuelve reason name→sk y aplica reglas de fecha.
func (s *Service) validate(ctx context.Context, req AbsenceWriteReq) (pgtype.Date, pgtype.Date, int32, error) {
	start, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, 0, ErrInvalidInput
	}
	end, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, 0, ErrInvalidInput
	}
	if start.After(end) {
		return pgtype.Date{}, pgtype.Date{}, 0, ErrInvalidInput
	}

	// absence_reason puede venir como nombre o como ID numérico.
	if id, perr := strconv.ParseInt(req.AbsenceReason, 10, 32); perr == nil {
		return pgtype.Date{Time: start, Valid: true},
			pgtype.Date{Time: end, Valid: true},
			int32(id), nil
	}
	sk, err := s.q.ResolveAbsenceReason(ctx, req.AbsenceReason)
	if errors.Is(err, pgx.ErrNoRows) {
		return pgtype.Date{}, pgtype.Date{}, 0, ErrUnknownReason
	}
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, 0, err
	}
	return pgtype.Date{Time: start, Valid: true},
		pgtype.Date{Time: end, Valid: true},
		sk, nil
}

// ===== Handlers =====

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	gestor := auth.RequirePermission(auth.PermOperacional, auth.PermAdministrativo)
	g.GET("/availability", h.Get, mw)
	g.POST("/absences", h.CreateAbsence, mw, gestor)
	g.PUT("/absences/:id", h.UpdateAbsence, mw, gestor)
	g.DELETE("/absences/:id", h.DeleteAbsence, mw, gestor)
}

func (h *Handlers) Get(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	month, _ := strconv.Atoi(c.QueryParam("month"))
	year, _ := strconv.Atoi(c.QueryParam("year"))
	res, err := h.svc.Get(c.Request().Context(), int32(user.EscuadrillaID), month, year)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) CreateAbsence(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req AbsenceWriteReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	res, err := h.svc.CreateAbsence(c.Request().Context(), int32(user.EscuadrillaID), req)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrUnknownReason):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(http.StatusCreated, res)
}

func (h *Handlers) UpdateAbsence(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseID(c)
	if herr != nil {
		return herr
	}
	var req AbsenceWriteReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	err := h.svc.UpdateAbsence(c.Request().Context(), int32(user.EscuadrillaID), id, req)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrUnknownReason):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handlers) DeleteAbsence(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseID(c)
	if herr != nil {
		return herr
	}
	err := h.svc.DeleteAbsence(c.Request().Context(), int32(user.EscuadrillaID), id)
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func parseID(c echo.Context) (int32, error) {
	n, err := strconv.ParseInt(c.Param("id"), 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return int32(n), nil
}
