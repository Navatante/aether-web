// Package festivos implementa el CRUD del catálogo detall.festivos
// (días festivos a nivel nacional, compartidos entre escuadrillas).
package festivos

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/queries"
)

// ===== DTOs =====

type Festivo struct {
	FestivoSk     int32  `json:"festivo_sk"`
	FestivoDia    string `json:"festivo_dia"` // YYYY-MM-DD
	FestivoMotivo string `json:"festivo_motivo"`
}

type WriteReq struct {
	FestivoDia    string `json:"festivo_dia"`    // YYYY-MM-DD
	FestivoMotivo string `json:"festivo_motivo"`
}

// ===== Sentinel errors =====

var (
	ErrNotFound       = errors.New("festivos: not found")
	ErrInvalidInput   = errors.New("festivos: invalid input")
	ErrDateInUse      = errors.New("festivos: already exists on that date")
)

// ===== Service =====

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

func (s *Service) List(ctx context.Context) ([]Festivo, error) {
	rows, err := s.q.ListFestivos(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Festivo, 0, len(rows))
	for _, r := range rows {
		out = append(out, Festivo{
			FestivoSk:     r.FestivoSk,
			FestivoDia:    r.FestivoDia.Time.Format("2006-01-02"),
			FestivoMotivo: r.FestivoMotivo,
		})
	}
	return out, nil
}

func (s *Service) Create(ctx context.Context, req WriteReq) (int32, error) {
	motivo := strings.TrimSpace(req.FestivoMotivo)
	if motivo == "" {
		return 0, ErrInvalidInput
	}
	date, err := parseDate(req.FestivoDia)
	if err != nil {
		return 0, ErrInvalidInput
	}
	exists, err := s.q.FestivoExistsOnDate(ctx, date)
	if err != nil {
		return 0, err
	}
	if exists {
		return 0, ErrDateInUse
	}
	return s.q.InsertFestivo(ctx, queries.InsertFestivoParams{
		FestivoDia: date, FestivoMotivo: motivo,
	})
}

func (s *Service) Update(ctx context.Context, id int32, req WriteReq) error {
	motivo := strings.TrimSpace(req.FestivoMotivo)
	if motivo == "" {
		return ErrInvalidInput
	}
	date, err := parseDate(req.FestivoDia)
	if err != nil {
		return ErrInvalidInput
	}
	dupe, err := s.q.FestivoExistsOnDateOtherSk(ctx, queries.FestivoExistsOnDateOtherSkParams{
		FestivoDia: date, FestivoSk: id,
	})
	if err != nil {
		return err
	}
	if dupe {
		return ErrDateInUse
	}
	n, err := s.q.UpdateFestivo(ctx, queries.UpdateFestivoParams{
		FestivoDia: date, FestivoMotivo: motivo, FestivoSk: id,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) Delete(ctx context.Context, id int32) error {
	n, err := s.q.DeleteFestivo(ctx, id)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ===== Handlers =====

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	administrativo := auth.RequirePermission(auth.PermAdministrativo)
	g.GET("/festivos", h.List, mw)
	g.POST("/festivos", h.Create, mw, administrativo)
	g.PUT("/festivos/:id", h.Update, mw, administrativo)
	g.DELETE("/festivos/:id", h.Delete, mw, administrativo)
}

func (h *Handlers) List(c echo.Context) error {
	items, err := h.svc.List(c.Request().Context())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handlers) Create(c echo.Context) error {
	var req WriteReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	id, err := h.svc.Create(c.Request().Context(), req)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrDateInUse):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(http.StatusCreated, map[string]int32{"id": id})
}

func (h *Handlers) Update(c echo.Context) error {
	id, herr := parseID(c)
	if herr != nil {
		return herr
	}
	var req WriteReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	err := h.svc.Update(c.Request().Context(), id, req)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrDateInUse):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handlers) Delete(c echo.Context) error {
	id, herr := parseID(c)
	if herr != nil {
		return herr
	}
	err := h.svc.Delete(c.Request().Context(), id)
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

// ===== Helpers =====

func parseDate(s string) (pgtype.Date, error) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return pgtype.Date{}, err
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func parseID(c echo.Context) (int32, error) {
	raw := c.Param("id")
	n, err := strconv.ParseInt(raw, 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return int32(n), nil
}
