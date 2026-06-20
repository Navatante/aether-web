// Package landings implementa la vista de tomas y aproximaciones por piloto.
//
// El rango de fechas se resuelve en Go (mismo set de keys que hours/dashboard).
// El handler acepta time_range predefinido o custom_start_date/custom_end_date.
package landings

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

func (s *Service) LandingsApproaches(ctx context.Context, esc int32, req Request) (Result, error) {
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
	rows, err := s.q.LandingsApproachesByPilot(ctx, queries.LandingsApproachesByPilotParams{
		FlightDate:          pgtype.Date{Time: r.from, Valid: true},
		FlightDate_2:        pgtype.Date{Time: r.to, Valid: true},
		PersonEscuadrillaFk: esc,
		Column4:             req.PersonRoles,
	})
	if err != nil {
		return Result{}, err
	}
	pilotos := make([]PilotLandingsApproaches, 0, len(rows))
	for _, row := range rows {
		nk := ""
		if row.PersonNk != nil {
			nk = *row.PersonNk
		}
		pilotos = append(pilotos, PilotLandingsApproaches{
			PersonNk:             nk,
			TierraDayQty:         int(row.TierraDayQty),
			TierraNightQty:       int(row.TierraNightQty),
			TierraGvnQty:         int(row.TierraGvnQty),
			MonoDayQty:           int(row.MonoDayQty),
			MonoNightQty:         int(row.MonoNightQty),
			MonoGvnQty:           int(row.MonoGvnQty),
			MultiDayQty:          int(row.MultiDayQty),
			MultiNightQty:        int(row.MultiNightQty),
			MultiGvnQty:          int(row.MultiGvnQty),
			CarrierDayQty:        int(row.CarrierDayQty),
			CarrierNightQty:      int(row.CarrierNightQty),
			CarrierGvnQty:        int(row.CarrierGvnQty),
			AppPrecisionQty:      int(row.AppPrecisionQty),
			AppNoPrecisionQty:    int(row.AppNoPrecisionQty),
			AppTransitionDownQty: int(row.AppTransitionDownQty),
			AppSearchPatternQty:  int(row.AppSearchPatternQty),
		})
	}
	return Result{
		StartDate: r.from.Format("2006-01-02"),
		EndDate:   r.to.Format("2006-01-02"),
		Pilotos:   pilotos,
	}, nil
}

// ============================================================
// Handlers
// ============================================================

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	g.GET("/landings/pilotos", h.LandingsApproaches, auth.RequireAuth(authSvc))
}

func (h *Handlers) LandingsApproaches(c echo.Context) error {
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
	res, err := h.svc.LandingsApproaches(c.Request().Context(), int32(u.EscuadrillaID), req)
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
