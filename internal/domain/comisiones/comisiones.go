// Package comisiones implementa el CRUD de detall.comision +
// detall.comision_lugar + detall.person_comision y los SPs de listado.
//
// Fixes vs Rust:
//   - update/delete_comision: WHERE incluye comision_escuadrilla_fk.
//   - bulk insert person→comision: validación pre-transacción (overlap
//     con otra comisión + overlap con ausencia), insert dentro de TX.
package comisiones

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/queries"
)

// ============================================================
// DTOs
// ============================================================

// ComisionFormData espeja el DTO Rust (camelCase). Para crear/actualizar.
type ComisionFormData struct {
	StartDate       string `json:"fechaInicio"`     // YYYY-MM-DD
	EndDate         string `json:"fechaFin"`        // YYYY-MM-DD
	Tipo            string `json:"tipo"`            // nombre o id
	Lugar           string `json:"lugar"`           // nombre o id
	GeneratesEffort bool   `json:"generaEsfuerzo"`
}

type InsertResult struct {
	ComisionID int32  `json:"comision_id"`
	Success    bool   `json:"success"`
	Message    string `json:"message"`
}

// ComisionListItem es el shape del SP sp_get_comisiones (camelCase mixto).
type ComisionListItem struct {
	ComisionSk    int32                  `json:"comision_sk"`
	FechaInicio   string                 `json:"fecha_inicio"`
	FechaFin      string                 `json:"fecha_fin"`
	Dias          int32                  `json:"dias"`
	Lugar         string                 `json:"lugar"`
	Tipo          string                 `json:"tipo"`
	Esfuerzo      bool                   `json:"esfuerzo"`
	Participantes []ComisionParticipante `json:"personas_participantes"`
}

type ComisionParticipante struct {
	PersonComisionSk int32  `json:"person_comision_sk"`
	Nombre           string `json:"nombre"`
	Orden            int64  `json:"orden"`
}

type ComisionQueryResult struct {
	Items      []ComisionListItem `json:"items"`
	TotalCount int32              `json:"total_count"`
}

// ComisionWithPeopleItem es el shape de db_get_comisiones_with_people (snake_case con people).
type ComisionWithPeopleItem struct {
	ComisionSk             int32     `json:"comision_sk"`
	ComisionDateStart      string    `json:"comision_date_start"`
	ComisionDateEnd        string    `json:"comision_date_end"`
	ComisionType           string    `json:"comision_type"`
	ComisionLocation       string    `json:"comision_location"`
	ComisionGeneratesEffort bool     `json:"comision_generates_effort"`
	People                 []Person  `json:"people"`
}

type Person struct {
	PersonSk        int32   `json:"person_sk"`
	PersonNk        *string `json:"person_nk"`
	PersonRank      string  `json:"person_rank"`
	PersonName      string  `json:"person_name"`
	PersonLastName1 string  `json:"person_last_name_1"`
	PersonLastName2 string  `json:"person_last_name_2"`
}

type ComisionWithPeopleResult struct {
	Items      []ComisionWithPeopleItem `json:"items"`
	TotalCount int32                    `json:"total_count"`
}

// QueryParams = filtros para los dos listados.
type QueryParams struct {
	Limit       int32
	Offset      int32
	ComisionSk  int32
	DateFrom    string
	DateTo      string
}

// PersonToComisionFormData espeja PersonToComisionFormData del Rust.
type PersonToComisionFormData struct {
	Comision string   `json:"comision"`
	Personas []string `json:"personas"`
}

type PersonToComisionInsertResult struct {
	ComisionID         int32  `json:"comision_id"`
	Success            bool   `json:"success"`
	Message            string `json:"message"`
	PersonasInsertadas int32  `json:"personas_insertadas"`
}

// Lugar CRUD
type LugarCreateReq struct {
	ComisionName string `json:"comision_name"`
}
type LugarUpdateReq struct {
	Name string `json:"name"`
}
type LugarResult struct {
	ComisionLugarSk int32  `json:"comision_lugar_sk"`
	ComisionName    string `json:"comision_name"`
}

// DiasComisionItem espeja sp_get_dias_comision.
type DiasComisionItem struct {
	PersonRank             string `json:"person_rank"`
	FullName               string `json:"full_name"`
	PersonRol              string `json:"person_rol"`
	Escala                 string `json:"escala"`
	B1                     bool   `json:"b1"`
	B2                     bool   `json:"b2"`
	LV                     bool   `json:"lv"`
	DiasBaseCortaDuracion  int32  `json:"dias_base_corta_duracion"`
	DiasDespliegues        int32  `json:"dias_despliegues"`
	DiasVoluntarias        int32  `json:"dias_voluntarias"`
	DiasOMP                int32  `json:"dias_OMP"`
	DiasUNADEST            int32  `json:"dias_UNADEST"`
	DiasUNAEMB             int32  `json:"dias_UNAEMB"`
	DiasRancheria          int32  `json:"dias_rancheria"`
}

// ============================================================
// Sentinel errors
// ============================================================

var (
	ErrNotFound       = errors.New("comisiones: not found")
	ErrInvalidInput   = errors.New("comisiones: invalid input")
	ErrInUse          = errors.New("comisiones: referenced by other records")
	ErrDuplicate      = errors.New("comisiones: duplicate")
	ErrUnknownType    = errors.New("comisiones: unknown comision_type")
	ErrUnknownLugar   = errors.New("comisiones: unknown comision_lugar")
)

// ValidationError carries the list of per-person errors for bulk assign.
type ValidationError struct {
	Errors []string
}

func (e *ValidationError) Error() string { return strings.Join(e.Errors, ". ") }

// ============================================================
// Service
// ============================================================

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

// ----- Resolvers -----

func (s *Service) resolveType(ctx context.Context, raw string) (int32, error) {
	if n, err := strconv.ParseInt(raw, 10, 32); err == nil {
		return int32(n), nil
	}
	sk, err := s.q.ResolveComisionType(ctx, raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrUnknownType
	}
	return sk, err
}

func (s *Service) resolveLugar(ctx context.Context, raw string) (int32, error) {
	if n, err := strconv.ParseInt(raw, 10, 32); err == nil {
		return int32(n), nil
	}
	sk, err := s.q.ResolveComisionLugar(ctx, raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrUnknownLugar
	}
	return sk, err
}

// ----- Comisión CRUD -----

func (s *Service) Create(ctx context.Context, esc int32, data ComisionFormData) (InsertResult, error) {
	start, end, err := parseRange(data.StartDate, data.EndDate)
	if err != nil {
		return InsertResult{}, err
	}
	typeFk, err := s.resolveType(ctx, data.Tipo)
	if err != nil {
		return InsertResult{}, err
	}
	lugarFk, err := s.resolveLugar(ctx, data.Lugar)
	if err != nil {
		return InsertResult{}, err
	}
	id, err := s.q.InsertComision(ctx, queries.InsertComisionParams{
		ComisionStartDate:    start,
		ComisionEndDate:      end,
		ComisionTypeFk:       typeFk,
		ComisionLugarFk:      lugarFk,
		ComisionEscuadrillaFk: esc,
		ComisionEsfuerzo:     data.GeneratesEffort,
	})
	if err != nil {
		return InsertResult{}, err
	}
	return InsertResult{
		ComisionID: id,
		Success:    true,
		Message:    fmt.Sprintf("Comision registrada con ID: %d", id),
	}, nil
}

func (s *Service) Update(ctx context.Context, esc int32, id int32, data ComisionFormData) error {
	start, end, err := parseRange(data.StartDate, data.EndDate)
	if err != nil {
		return err
	}
	typeFk, err := s.resolveType(ctx, data.Tipo)
	if err != nil {
		return err
	}
	lugarFk, err := s.resolveLugar(ctx, data.Lugar)
	if err != nil {
		return err
	}
	n, err := s.q.UpdateComision(ctx, queries.UpdateComisionParams{
		ComisionStartDate:    start,
		ComisionEndDate:      end,
		ComisionTypeFk:       typeFk,
		ComisionLugarFk:      lugarFk,
		ComisionEsfuerzo:     data.GeneratesEffort,
		ComisionSk:           id,
		ComisionEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) Delete(ctx context.Context, esc int32, id int32) error {
	n, err := s.q.DeleteComision(ctx, queries.DeleteComisionParams{
		ComisionSk:           id,
		ComisionEscuadrillaFk: esc,
	})
	if err != nil {
		if isFKViolation(err) {
			return ErrInUse
		}
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ----- Comisión listings -----

func (s *Service) List(ctx context.Context, esc int32, p QueryParams) (ComisionQueryResult, error) {
	df, dt, err := parseOptionalDates(p.DateFrom, p.DateTo)
	if err != nil {
		return ComisionQueryResult{}, err
	}
	if p.Limit <= 0 {
		p.Limit = 10
	}

	rows, err := s.q.ListComisiones(ctx, queries.ListComisionesParams{
		ComisionEscuadrillaFk: esc,
		Column2:               p.ComisionSk,
		Column3:               df,
		Column4:               dt,
		Limit:                 p.Limit,
		Offset:                p.Offset,
	})
	if err != nil {
		return ComisionQueryResult{}, err
	}
	total, err := s.q.CountComisiones(ctx, queries.CountComisionesParams{
		ComisionEscuadrillaFk: esc,
		Column2:               p.ComisionSk,
		Column3:               df,
		Column4:               dt,
	})
	if err != nil {
		return ComisionQueryResult{}, err
	}

	items := make([]ComisionListItem, 0, len(rows))
	for _, r := range rows {
		participantes, err := s.listPeople(ctx, r.ComisionSk)
		if err != nil {
			return ComisionQueryResult{}, err
		}
		items = append(items, ComisionListItem{
			ComisionSk:    r.ComisionSk,
			FechaInicio:   r.ComisionStartDate.Time.Format("2006-01-02"),
			FechaFin:      r.ComisionEndDate.Time.Format("2006-01-02"),
			Dias:          r.Dias,
			Lugar:         r.Lugar,
			Tipo:          r.Tipo,
			Esfuerzo:      r.Esfuerzo,
			Participantes: participantes,
		})
	}
	return ComisionQueryResult{Items: items, TotalCount: total}, nil
}

func (s *Service) listPeople(ctx context.Context, comisionSk int32) ([]ComisionParticipante, error) {
	rows, err := s.q.ListComisionPeople(ctx, comisionSk)
	if err != nil {
		return nil, err
	}
	out := make([]ComisionParticipante, 0, len(rows))
	for _, r := range rows {
		out = append(out, ComisionParticipante{
			PersonComisionSk: r.PersonComisionSk,
			Nombre:           r.Nombre,
			Orden:            r.Orden,
		})
	}
	return out, nil
}

func (s *Service) ListWithPeople(ctx context.Context, esc int32, p QueryParams) (ComisionWithPeopleResult, error) {
	// Reutilizamos las queries paginadas pero usamos ListComisionPeopleExpanded
	// para conseguir el shape distinto de "people".
	df, dt, err := parseOptionalDates(p.DateFrom, p.DateTo)
	if err != nil {
		return ComisionWithPeopleResult{}, err
	}
	if p.Limit <= 0 {
		p.Limit = 50
	}

	rows, err := s.q.ListComisiones(ctx, queries.ListComisionesParams{
		ComisionEscuadrillaFk: esc,
		Column2:               p.ComisionSk,
		Column3:               df,
		Column4:               dt,
		Limit:                 p.Limit,
		Offset:                p.Offset,
	})
	if err != nil {
		return ComisionWithPeopleResult{}, err
	}
	total, err := s.q.CountComisiones(ctx, queries.CountComisionesParams{
		ComisionEscuadrillaFk: esc,
		Column2:               p.ComisionSk,
		Column3:               df,
		Column4:               dt,
	})
	if err != nil {
		return ComisionWithPeopleResult{}, err
	}

	items := make([]ComisionWithPeopleItem, 0, len(rows))
	for _, r := range rows {
		people, err := s.q.ListComisionPeopleExpanded(ctx, r.ComisionSk)
		if err != nil {
			return ComisionWithPeopleResult{}, err
		}
		ppl := make([]Person, 0, len(people))
		for _, p := range people {
			ppl = append(ppl, Person{
				PersonSk: p.PersonSk, PersonNk: p.PersonNk,
				PersonRank: p.PersonRank, PersonName: p.PersonName,
				PersonLastName1: p.PersonLastName1, PersonLastName2: p.PersonLastName2,
			})
		}
		items = append(items, ComisionWithPeopleItem{
			ComisionSk:              r.ComisionSk,
			ComisionDateStart:       r.ComisionStartDate.Time.Format("2006-01-02"),
			ComisionDateEnd:         r.ComisionEndDate.Time.Format("2006-01-02"),
			ComisionType:            r.Tipo,
			ComisionLocation:        r.Lugar,
			ComisionGeneratesEffort: r.Esfuerzo,
			People:                  ppl,
		})
	}
	return ComisionWithPeopleResult{Items: items, TotalCount: total}, nil
}

// ----- comision_lugar CRUD -----

func (s *Service) CreateLugar(ctx context.Context, name string) (LugarResult, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return LugarResult{}, ErrInvalidInput
	}
	exists, err := s.q.LugarExistsByName(ctx, name)
	if err != nil {
		return LugarResult{}, err
	}
	if exists {
		return LugarResult{}, ErrDuplicate
	}
	row, err := s.q.InsertComisionLugar(ctx, name)
	if err != nil {
		return LugarResult{}, err
	}
	return LugarResult{ComisionLugarSk: row.ComisionLugarSk, ComisionName: row.ComisionName}, nil
}

func (s *Service) UpdateLugar(ctx context.Context, id int32, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return ErrInvalidInput
	}
	dupe, err := s.q.LugarExistsByNameOther(ctx, queries.LugarExistsByNameOtherParams{
		ComisionName:    name,
		ComisionLugarSk: id,
	})
	if err != nil {
		return err
	}
	if dupe {
		return ErrDuplicate
	}
	n, err := s.q.UpdateComisionLugar(ctx, queries.UpdateComisionLugarParams{
		ComisionName: name, ComisionLugarSk: id,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) DeleteLugar(ctx context.Context, id int32) error {
	used, err := s.q.LugarUsageCount(ctx, id)
	if err != nil {
		return err
	}
	if used > 0 {
		return ErrInUse
	}
	n, err := s.q.DeleteComisionLugar(ctx, id)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ----- person_comision -----

// AssignPeopleToComision: valida primero todas las personas, luego inserta en TX.
func (s *Service) AssignPeopleToComision(ctx context.Context, esc int32, comisionSk int32, personSks []int32) (PersonToComisionInsertResult, error) {
	if len(personSks) == 0 {
		return PersonToComisionInsertResult{}, ErrInvalidInput
	}

	dates, err := s.q.GetComisionDates(ctx, queries.GetComisionDatesParams{
		ComisionSk:           comisionSk,
		ComisionEscuadrillaFk: esc,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return PersonToComisionInsertResult{}, ErrNotFound
	}
	if err != nil {
		return PersonToComisionInsertResult{}, err
	}

	// Fase 1: validar todas, acumular errores.
	verrs := &ValidationError{}
	for _, ps := range personSks {
		name, err := s.q.PersonFullName(ctx, ps)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return PersonToComisionInsertResult{}, err
		}
		if name == "" {
			name = fmt.Sprintf("ID: %d", ps)
		}

		dup, err := s.q.PersonAlreadyInComision(ctx, queries.PersonAlreadyInComisionParams{
			ComisionFk: comisionSk, PersonFk: ps,
		})
		if err != nil {
			return PersonToComisionInsertResult{}, err
		}
		if dup {
			verrs.Errors = append(verrs.Errors, fmt.Sprintf("%s ya esta asignado/a a esta comision", name))
			continue
		}

		overlap, err := s.q.PersonHasOverlapComision(ctx, queries.PersonHasOverlapComisionParams{
			PersonFk: ps, Column2: dates.ComisionStartDate, Column3: dates.ComisionEndDate,
		})
		if err != nil {
			return PersonToComisionInsertResult{}, err
		}
		if overlap {
			verrs.Errors = append(verrs.Errors, fmt.Sprintf("%s ya tiene otra comision en esas fechas", name))
			continue
		}

		abs, err := s.q.PersonHasOverlapAbsence(ctx, queries.PersonHasOverlapAbsenceParams{
			AbsencePersonFk: ps, Column2: dates.ComisionStartDate, Column3: dates.ComisionEndDate,
		})
		if err != nil {
			return PersonToComisionInsertResult{}, err
		}
		if abs {
			verrs.Errors = append(verrs.Errors, fmt.Sprintf("%s tiene una ausencia en esas fechas", name))
		}
	}
	if len(verrs.Errors) > 0 {
		return PersonToComisionInsertResult{}, verrs
	}

	// Fase 2: insertar en transacción.
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return PersonToComisionInsertResult{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(tx)
	var inserted int32
	for _, ps := range personSks {
		if err := qtx.InsertPersonToComision(ctx, queries.InsertPersonToComisionParams{
			ComisionFk: comisionSk, PersonFk: ps,
		}); err != nil {
			return PersonToComisionInsertResult{}, err
		}
		inserted++
	}
	if err := tx.Commit(ctx); err != nil {
		return PersonToComisionInsertResult{}, err
	}

	return PersonToComisionInsertResult{
		ComisionID:         comisionSk,
		Success:            true,
		Message:            fmt.Sprintf("%d persona(s) asignada(s) correctamente a la comision", inserted),
		PersonasInsertadas: inserted,
	}, nil
}

func (s *Service) DeletePersonFromComision(ctx context.Context, comisionSk, personSk int32) error {
	n, err := s.q.DeletePersonFromComision(ctx, queries.DeletePersonFromComisionParams{
		ComisionFk: comisionSk, PersonFk: personSk,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) DeletePersonComisionBySk(ctx context.Context, esc int32, sk int32) error {
	n, err := s.q.DeletePersonComisionBySk(ctx, queries.DeletePersonComisionBySkParams{
		PersonComisionSk:     sk,
		ComisionEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ----- sp_get_dias_comision -----

func (s *Service) DiasComision(ctx context.Context, esc int32, fechaFin string) ([]DiasComisionItem, error) {
	fin := time.Now().UTC()
	if fechaFin != "" {
		t, err := time.Parse("2006-01-02", fechaFin)
		if err != nil {
			return nil, ErrInvalidInput
		}
		fin = t
	}
	rows, err := s.q.DiasComision(ctx, queries.DiasComisionParams{
		Column1:             pgtype.Date{Time: fin, Valid: true},
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, err
	}
	out := make([]DiasComisionItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, DiasComisionItem{
			PersonRank:            r.PersonRank,
			FullName:              r.FullName,
			PersonRol:             r.PersonRol,
			Escala:                r.Escala,
			B1:                    r.B1,
			B2:                    r.B2,
			LV:                    r.Lv,
			DiasBaseCortaDuracion: r.DiasBaseCortaDuracion,
			DiasDespliegues:       r.DiasDespliegues,
			DiasVoluntarias:       r.DiasVoluntarias,
			DiasOMP:               r.DiasOmp,
			DiasUNADEST:           r.DiasUnadest,
			DiasUNAEMB:            r.DiasUnaemb,
			DiasRancheria:         r.DiasRancheria,
		})
	}
	return out, nil
}

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

// ============================================================
// Helpers
// ============================================================

func parseRange(start, end string) (pgtype.Date, pgtype.Date, error) {
	s, err := time.Parse("2006-01-02", start)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, ErrInvalidInput
	}
	e, err := time.Parse("2006-01-02", end)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, ErrInvalidInput
	}
	if s.After(e) {
		return pgtype.Date{}, pgtype.Date{}, ErrInvalidInput
	}
	return pgtype.Date{Time: s, Valid: true}, pgtype.Date{Time: e, Valid: true}, nil
}

func parseOptionalDates(from, to string) (pgtype.Date, pgtype.Date, error) {
	var df, dt pgtype.Date
	if from != "" {
		t, err := time.Parse("2006-01-02", from)
		if err != nil {
			return df, dt, ErrInvalidInput
		}
		df = pgtype.Date{Time: t, Valid: true}
	}
	if to != "" {
		t, err := time.Parse("2006-01-02", to)
		if err != nil {
			return df, dt, ErrInvalidInput
		}
		dt = pgtype.Date{Time: t, Valid: true}
	}
	return df, dt, nil
}

func isFKViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
