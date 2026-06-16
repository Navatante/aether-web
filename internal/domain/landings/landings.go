// Package landings implementa la vista de tomas y aproximaciones por piloto.
//
// El rango de fechas se resuelve en Go (mismo set de keys que hours/dashboard).
// El handler acepta time_range predefinido o custom_start_date/custom_end_date.
package landings

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
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
// Range parser (espejo de dashboard.ResolveRange, sin acoplar)
// ============================================================

// defaultHistoricStart es el ancla de respaldo para el rango "histórico"
// cuando no se puede leer escuadrilla_creation_date (no debería ocurrir).
var defaultHistoricStart = time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)

type dateRange struct{ from, to time.Time }

func resolveRange(req Request, today, historicStart time.Time) (dateRange, error) {
	if today.IsZero() {
		today = time.Now().UTC()
	}
	today = startOfDay(today)

	// 1) Custom — ambos o nada
	if req.CustomStartDate != "" || req.CustomEndDate != "" {
		if req.CustomStartDate == "" || req.CustomEndDate == "" {
			return dateRange{}, errors.New("custom_start_date y custom_end_date deben ir juntos")
		}
		from, err := time.Parse("2006-01-02", req.CustomStartDate)
		if err != nil {
			return dateRange{}, fmt.Errorf("custom_start_date inválido: %w", err)
		}
		to, err := time.Parse("2006-01-02", req.CustomEndDate)
		if err != nil {
			return dateRange{}, fmt.Errorf("custom_end_date inválido: %w", err)
		}
		if from.After(to) {
			return dateRange{}, errors.New("custom_start_date posterior a custom_end_date")
		}
		return dateRange{from: from, to: to}, nil
	}

	// 2) Predefined
	key := req.TimeRange
	if key == "" {
		key = "ultimos-7-dias"
	}
	switch key {
	case "ultimos-7-dias":
		return dateRange{today.AddDate(0, 0, -6), today}, nil
	case "ultimos-30-dias":
		return dateRange{today.AddDate(0, 0, -29), today}, nil
	case "ultimos-90-dias":
		return dateRange{today.AddDate(0, 0, -89), today}, nil
	case "ultimos-182-dias":
		return dateRange{today.AddDate(0, 0, -181), today}, nil
	case "ultimos-365-dias":
		return dateRange{today.AddDate(0, 0, -364), today}, nil
	case "semana-actual":
		return dateRange{mondayOf(today), today}, nil
	case "ultima-semana":
		mon := mondayOf(today).AddDate(0, 0, -7)
		return dateRange{mon, mon.AddDate(0, 0, 6)}, nil
	case "mes-actual":
		return dateRange{firstOfMonth(today), today}, nil
	case "ultimo-mes":
		return dateRange{firstOfMonth(today).AddDate(0, -1, 0), firstOfMonth(today).AddDate(0, 0, -1)}, nil
	case "ultimos-3-meses":
		return dateRange{firstOfMonth(today).AddDate(0, -3, 0), firstOfMonth(today).AddDate(0, 0, -1)}, nil
	case "anio-actual":
		return dateRange{time.Date(today.Year(), 1, 1, 0, 0, 0, 0, today.Location()), today}, nil
	case "ultimo-anio":
		y := today.Year() - 1
		return dateRange{
			time.Date(y, 1, 1, 0, 0, 0, 0, today.Location()),
			time.Date(y, 12, 31, 0, 0, 0, 0, today.Location()),
		}, nil
	case "ultimos-2-anios":
		return dateRange{
			time.Date(today.Year()-2, 1, 1, 0, 0, 0, 0, today.Location()),
			time.Date(today.Year()-1, 12, 31, 0, 0, 0, 0, today.Location()),
		}, nil
	case "historico":
		return dateRange{historicStart, today}, nil
	}
	return dateRange{}, fmt.Errorf("time_range desconocido: %q", key)
}

func startOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func firstOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
}

func mondayOf(t time.Time) time.Time {
	wd := int(t.Weekday())
	if wd == 0 {
		wd = 7
	}
	return t.AddDate(0, 0, -(wd - 1))
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
