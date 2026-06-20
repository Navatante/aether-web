// Package hours implementa sp_get_personNH90PeriodHours.
//
// El rango de fechas se resuelve en Go (mismo set de keys que dashboard).
// El handler acepta time_range predefinido o custom_start_date/custom_end_date.
package hours

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/daterange"
	"github.com/14esc/aether-web/internal/queries"
)

// ============================================================
// Request (interno; no es contrato JSON, ver dto.go para el response)
// ============================================================

type Request struct {
	TimeRange       string   // predefined key (vacío + customs vacíos → "ultimos-7-dias")
	PersonRoles     []string // CSV recibido en query, ya partido
	CustomStartDate string   // YYYY-MM-DD
	CustomEndDate   string   // YYYY-MM-DD
	IncludeExtra    bool     // modo "Totales": suma operations.extra_hour (arrastre)
}

// ============================================================
// Range parser (adaptador sobre internal/daterange)
// ============================================================

// defaultHistoricStart es el ancla de respaldo para el rango "histórico".
// Fuente única: daterange.DefaultHistoricStart.
var defaultHistoricStart = daterange.DefaultHistoricStart

type dateRange struct{ from, to time.Time }

// resolveRange adapta el Request a internal/daterange: modo custom si viene
// alguna de las dos fechas (ambas obligatorias), si no clave predefinida.
func resolveRange(req Request, today, historicStart time.Time) (dateRange, error) {
	if req.CustomStartDate != "" || req.CustomEndDate != "" {
		if req.CustomStartDate == "" || req.CustomEndDate == "" {
			return dateRange{}, errors.New("custom_start_date y custom_end_date deben ir juntos")
		}
		r, err := daterange.Custom(req.CustomStartDate, req.CustomEndDate)
		if err != nil {
			return dateRange{}, err
		}
		return dateRange{from: r.From, to: r.To}, nil
	}
	r, err := daterange.Predefined(req.TimeRange, today, historicStart)
	if err != nil {
		return dateRange{}, err
	}
	return dateRange{from: r.From, to: r.To}, nil
}

// ============================================================
// Service
// ============================================================

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

func (s *Service) NH90PeriodHours(ctx context.Context, esc int32, req Request) (Result, error) {
	// El inicio del rango "histórico" se ancla en la fecha de creación de la
	// escuadrilla de la sesión, no en una constante.
	historicStart := defaultHistoricStart
	if d, err := s.q.EscuadrillaCreationDate(ctx, esc); err != nil {
		return Result{}, err
	} else if d.Valid {
		historicStart = d.Time
	}
	r, err := resolveRange(req, time.Time{}, historicStart)
	if err != nil {
		return Result{}, err
	}
	rows, err := s.q.NH90PeriodHours(ctx, queries.NH90PeriodHoursParams{
		FlightDate:          pgtype.Date{Time: r.from, Valid: true},
		FlightDate_2:        pgtype.Date{Time: r.to, Valid: true},
		PersonEscuadrillaFk: esc,
		Column4:             req.PersonRoles,
		Column5:             req.IncludeExtra,
	})
	if err != nil {
		return Result{}, err
	}
	tripulantes := make([]Tripulante, 0, len(rows))
	for _, r := range rows {
		nk := ""
		if r.PersonNk != nil {
			nk = *r.PersonNk
		}
		tripulantes = append(tripulantes, Tripulante{
			PersonNk:          nk,
			RealDayHourQty:    numericToFloat(r.RealDayHourQty),
			SimDayHourQty:     numericToFloat(r.SimDayHourQty),
			TotalDayHourQty:   numericToFloat(r.TotalDayHourQty),
			RealNightHourQty:  numericToFloat(r.RealNightHourQty),
			SimNightHourQty:   numericToFloat(r.SimNightHourQty),
			TotalNightHourQty: numericToFloat(r.TotalNightHourQty),
			RealGvnHourQty:    numericToFloat(r.RealGvnHourQty),
			SimGvnHourQty:     numericToFloat(r.SimGvnHourQty),
			TotalGvnHourQty:   numericToFloat(r.TotalGvnHourQty),
		})
	}
	return Result{
		StartDate:   r.from.Format("2006-01-02"),
		EndDate:     r.to.Format("2006-01-02"),
		Tripulantes: tripulantes,
	}, nil
}

func (s *Service) FormationPeriodHours(ctx context.Context, esc int32, req Request) (FormationResult, error) {
	// Mismo anclaje del rango "histórico" que NH90PeriodHours.
	historicStart := defaultHistoricStart
	if d, err := s.q.EscuadrillaCreationDate(ctx, esc); err != nil {
		return FormationResult{}, err
	} else if d.Valid {
		historicStart = d.Time
	}
	r, err := resolveRange(req, time.Time{}, historicStart)
	if err != nil {
		return FormationResult{}, err
	}
	rows, err := s.q.FormationPeriodHours(ctx, queries.FormationPeriodHoursParams{
		FlightDate:          pgtype.Date{Time: r.from, Valid: true},
		FlightDate_2:        pgtype.Date{Time: r.to, Valid: true},
		PersonEscuadrillaFk: esc,
		Column4:             req.PersonRoles,
		Column5:             req.IncludeExtra,
	})
	if err != nil {
		return FormationResult{}, err
	}
	tripulantes := make([]FormationTripulante, 0, len(rows))
	for _, row := range rows {
		nk := ""
		if row.PersonNk != nil {
			nk = *row.PersonNk
		}
		tripulantes = append(tripulantes, FormationTripulante{
			PersonNk:   nk,
			DayHourQty: numericToFloat(row.DayHourQty),
			GvnHourQty: numericToFloat(row.GvnHourQty),
		})
	}
	return FormationResult{
		StartDate:   r.from.Format("2006-01-02"),
		EndDate:     r.to.Format("2006-01-02"),
		Tripulantes: tripulantes,
	}, nil
}

func (s *Service) GvntypeHours(ctx context.Context, esc int32, req Request) (GvntypeResult, error) {
	// Mismo anclaje del rango "histórico" que NH90PeriodHours.
	historicStart := defaultHistoricStart
	if d, err := s.q.EscuadrillaCreationDate(ctx, esc); err != nil {
		return GvntypeResult{}, err
	} else if d.Valid {
		historicStart = d.Time
	}
	r, err := resolveRange(req, time.Time{}, historicStart)
	if err != nil {
		return GvntypeResult{}, err
	}
	rows, err := s.q.GvntypeHours(ctx, queries.GvntypeHoursParams{
		FlightDate:          pgtype.Date{Time: r.from, Valid: true},
		FlightDate_2:        pgtype.Date{Time: r.to, Valid: true},
		PersonEscuadrillaFk: esc,
		Column4:             req.PersonRoles,
	})
	if err != nil {
		return GvntypeResult{}, err
	}
	tripulantes := make([]GvntypeTripulante, 0, len(rows))
	for _, row := range rows {
		nk := ""
		if row.PersonNk != nil {
			nk = *row.PersonNk
		}
		tripulantes = append(tripulantes, GvntypeTripulante{
			PersonNk:     nk,
			IitHourQty:   numericToFloat(row.IitHourQty),
			AnvisHourQty: numericToFloat(row.AnvisHourQty),
		})
	}
	return GvntypeResult{
		StartDate:   r.from.Format("2006-01-02"),
		EndDate:     r.to.Format("2006-01-02"),
		Tripulantes: tripulantes,
	}, nil
}

func (s *Service) IftHours(ctx context.Context, esc int32, req Request) (IftResult, error) {
	// Mismo anclaje del rango "histórico" que NH90PeriodHours.
	historicStart := defaultHistoricStart
	if d, err := s.q.EscuadrillaCreationDate(ctx, esc); err != nil {
		return IftResult{}, err
	} else if d.Valid {
		historicStart = d.Time
	}
	r, err := resolveRange(req, time.Time{}, historicStart)
	if err != nil {
		return IftResult{}, err
	}
	rows, err := s.q.IftHours(ctx, queries.IftHoursParams{
		FlightDate:          pgtype.Date{Time: r.from, Valid: true},
		FlightDate_2:        pgtype.Date{Time: r.to, Valid: true},
		PersonEscuadrillaFk: esc,
		Column4:             req.PersonRoles,
		Column5:             req.IncludeExtra,
	})
	if err != nil {
		return IftResult{}, err
	}
	tripulantes := make([]IftTripulante, 0, len(rows))
	for _, row := range rows {
		nk := ""
		if row.PersonNk != nil {
			nk = *row.PersonNk
		}
		tripulantes = append(tripulantes, IftTripulante{
			PersonNk:   nk,
			IftHourQty: numericToFloat(row.IftHourQty),
		})
	}
	return IftResult{
		StartDate:   r.from.Format("2006-01-02"),
		EndDate:     r.to.Format("2006-01-02"),
		Tripulantes: tripulantes,
	}, nil
}

func (s *Service) InstructorHours(ctx context.Context, esc int32, req Request) (InstructorResult, error) {
	// Mismo anclaje del rango "histórico" que NH90PeriodHours.
	historicStart := defaultHistoricStart
	if d, err := s.q.EscuadrillaCreationDate(ctx, esc); err != nil {
		return InstructorResult{}, err
	} else if d.Valid {
		historicStart = d.Time
	}
	r, err := resolveRange(req, time.Time{}, historicStart)
	if err != nil {
		return InstructorResult{}, err
	}
	rows, err := s.q.InstructorHours(ctx, queries.InstructorHoursParams{
		FlightDate:          pgtype.Date{Time: r.from, Valid: true},
		FlightDate_2:        pgtype.Date{Time: r.to, Valid: true},
		PersonEscuadrillaFk: esc,
		Column4:             req.PersonRoles,
	})
	if err != nil {
		return InstructorResult{}, err
	}
	tripulantes := make([]InstructorTripulante, 0, len(rows))
	for _, row := range rows {
		nk := ""
		if row.PersonNk != nil {
			nk = *row.PersonNk
		}
		tripulantes = append(tripulantes, InstructorTripulante{
			PersonNk:          nk,
			InstructorHourQty: numericToFloat(row.InstructorHourQty),
		})
	}
	return InstructorResult{
		StartDate:   r.from.Format("2006-01-02"),
		EndDate:     r.to.Format("2006-01-02"),
		Tripulantes: tripulantes,
	}, nil
}

func (s *Service) CtaHours(ctx context.Context, esc int32, req Request) (CtaResult, error) {
	// Mismo anclaje del rango "histórico" que NH90PeriodHours.
	historicStart := defaultHistoricStart
	if d, err := s.q.EscuadrillaCreationDate(ctx, esc); err != nil {
		return CtaResult{}, err
	} else if d.Valid {
		historicStart = d.Time
	}
	r, err := resolveRange(req, time.Time{}, historicStart)
	if err != nil {
		return CtaResult{}, err
	}
	rows, err := s.q.CtaHours(ctx, queries.CtaHoursParams{
		FlightDate:          pgtype.Date{Time: r.from, Valid: true},
		FlightDate_2:        pgtype.Date{Time: r.to, Valid: true},
		PersonEscuadrillaFk: esc,
		Column4:             req.PersonRoles,
		Column5:             req.IncludeExtra,
	})
	if err != nil {
		return CtaResult{}, err
	}
	tripulantes := make([]CtaTripulante, 0, len(rows))
	for _, row := range rows {
		nk := ""
		if row.PersonNk != nil {
			nk = *row.PersonNk
		}
		tripulantes = append(tripulantes, CtaTripulante{
			PersonNk:   nk,
			CtaHourQty: numericToFloat(row.CtaHourQty),
		})
	}
	return CtaResult{
		StartDate:   r.from.Format("2006-01-02"),
		EndDate:     r.to.Format("2006-01-02"),
		Tripulantes: tripulantes,
	}, nil
}

func (s *Service) WtHours(ctx context.Context, esc int32, req Request) (WtResult, error) {
	// Mismo anclaje del rango "histórico" que NH90PeriodHours.
	historicStart := defaultHistoricStart
	if d, err := s.q.EscuadrillaCreationDate(ctx, esc); err != nil {
		return WtResult{}, err
	} else if d.Valid {
		historicStart = d.Time
	}
	r, err := resolveRange(req, time.Time{}, historicStart)
	if err != nil {
		return WtResult{}, err
	}
	rows, err := s.q.WtHours(ctx, queries.WtHoursParams{
		FlightDate:          pgtype.Date{Time: r.from, Valid: true},
		FlightDate_2:        pgtype.Date{Time: r.to, Valid: true},
		PersonEscuadrillaFk: esc,
		Column4:             req.PersonRoles,
	})
	if err != nil {
		return WtResult{}, err
	}
	tripulantes := make([]WtTripulante, 0, len(rows))
	for _, row := range rows {
		nk := ""
		if row.PersonNk != nil {
			nk = *row.PersonNk
		}
		tripulantes = append(tripulantes, WtTripulante{
			PersonNk:  nk,
			WtHourQty: numericToFloat(row.WtHourQty),
		})
	}
	return WtResult{
		StartDate:   r.from.Format("2006-01-02"),
		EndDate:     r.to.Format("2006-01-02"),
		Tripulantes: tripulantes,
	}, nil
}

// ============================================================
// Handlers
// ============================================================

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	g.GET("/hours/nh90-period", h.NH90PeriodHours, auth.RequireAuth(authSvc))
	g.GET("/hours/formation-period", h.FormationPeriodHours, auth.RequireAuth(authSvc))
	g.GET("/hours/gvntype", h.GvntypeHours, auth.RequireAuth(authSvc))
	g.GET("/hours/ift", h.IftHours, auth.RequireAuth(authSvc))
	g.GET("/hours/instructor", h.InstructorHours, auth.RequireAuth(authSvc))
	g.GET("/hours/cta", h.CtaHours, auth.RequireAuth(authSvc))
	g.GET("/hours/wt", h.WtHours, auth.RequireAuth(authSvc))
}

func (h *Handlers) NH90PeriodHours(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	req := Request{
		TimeRange:       c.QueryParam("time_range"),
		PersonRoles:     splitCSV(c.QueryParam("person_rol")),
		CustomStartDate: c.QueryParam("custom_start_date"),
		CustomEndDate:   c.QueryParam("custom_end_date"),
		IncludeExtra:    c.QueryParam("include_extra") == "true",
	}
	res, err := h.svc.NH90PeriodHours(c.Request().Context(), int32(u.EscuadrillaID), req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) FormationPeriodHours(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	req := Request{
		TimeRange:       c.QueryParam("time_range"),
		PersonRoles:     splitCSV(c.QueryParam("person_rol")),
		CustomStartDate: c.QueryParam("custom_start_date"),
		CustomEndDate:   c.QueryParam("custom_end_date"),
		IncludeExtra:    c.QueryParam("include_extra") == "true",
	}
	res, err := h.svc.FormationPeriodHours(c.Request().Context(), int32(u.EscuadrillaID), req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) GvntypeHours(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	req := Request{
		TimeRange:       c.QueryParam("time_range"),
		PersonRoles:     splitCSV(c.QueryParam("person_rol")),
		CustomStartDate: c.QueryParam("custom_start_date"),
		CustomEndDate:   c.QueryParam("custom_end_date"),
	}
	res, err := h.svc.GvntypeHours(c.Request().Context(), int32(u.EscuadrillaID), req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) IftHours(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	req := Request{
		TimeRange:       c.QueryParam("time_range"),
		PersonRoles:     splitCSV(c.QueryParam("person_rol")),
		CustomStartDate: c.QueryParam("custom_start_date"),
		CustomEndDate:   c.QueryParam("custom_end_date"),
		IncludeExtra:    c.QueryParam("include_extra") == "true",
	}
	res, err := h.svc.IftHours(c.Request().Context(), int32(u.EscuadrillaID), req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) InstructorHours(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	req := Request{
		TimeRange:       c.QueryParam("time_range"),
		PersonRoles:     splitCSV(c.QueryParam("person_rol")),
		CustomStartDate: c.QueryParam("custom_start_date"),
		CustomEndDate:   c.QueryParam("custom_end_date"),
	}
	res, err := h.svc.InstructorHours(c.Request().Context(), int32(u.EscuadrillaID), req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) CtaHours(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	req := Request{
		TimeRange:       c.QueryParam("time_range"),
		PersonRoles:     splitCSV(c.QueryParam("person_rol")),
		CustomStartDate: c.QueryParam("custom_start_date"),
		CustomEndDate:   c.QueryParam("custom_end_date"),
		IncludeExtra:    c.QueryParam("include_extra") == "true",
	}
	res, err := h.svc.CtaHours(c.Request().Context(), int32(u.EscuadrillaID), req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) WtHours(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	req := Request{
		TimeRange:       c.QueryParam("time_range"),
		PersonRoles:     splitCSV(c.QueryParam("person_rol")),
		CustomStartDate: c.QueryParam("custom_start_date"),
		CustomEndDate:   c.QueryParam("custom_end_date"),
	}
	res, err := h.svc.WtHours(c.Request().Context(), int32(u.EscuadrillaID), req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}

// ============================================================
// Helpers
// ============================================================

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
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
