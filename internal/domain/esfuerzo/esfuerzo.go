// Package esfuerzo implementa sp_get_esfuerzo: días de comisión con
// esfuerzo en los últimos 730 días, por persona activa.
package esfuerzo

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/queries"
)

// ===== DTOs =====

type Item struct {
	FullName     string `json:"full_name"`
	Escala       string `json:"escala"`
	DiasEsfuerzo int32  `json:"dias_esfuerzo"`
}

type Result struct {
	Items []Item `json:"items"`
}

// ===== Service =====

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

// Get: si fechaFin viene vacía, usa today. Espeja la semántica del SP.
func (s *Service) Get(ctx context.Context, esc int32, fechaFin string) (Result, error) {
	end := time.Now().UTC()
	if fechaFin != "" {
		t, err := time.Parse("2006-01-02", fechaFin)
		if err != nil {
			return Result{}, errors.New("fechaFin inválida")
		}
		end = t
	}
	rows, err := s.q.Esfuerzo(ctx, queries.EsfuerzoParams{
		Column1:             pgtype.Date{Time: end, Valid: true},
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return Result{}, err
	}
	out := make([]Item, 0, len(rows))
	for _, r := range rows {
		out = append(out, Item{
			FullName:     r.FullName,
			Escala:       r.Escala,
			DiasEsfuerzo: r.DiasEsfuerzo,
		})
	}
	return Result{Items: out}, nil
}

// ===== Handlers =====

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	g.GET("/esfuerzo", h.Get, auth.RequireAuth(authSvc))
}

func (h *Handlers) Get(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	res, err := h.svc.Get(c.Request().Context(), int32(u.EscuadrillaID), c.QueryParam("fechaFin"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}
