// Package papeletas implementa el CRUD del catálogo operations.papeleta,
// con RLS por escuadrilla (fix del bug original que no inyectaba escuadrilla_fk).
package papeletas

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/httpx"
	"github.com/14esc/aether-web/internal/queries"
)

// ===== Sentinel errors =====

var (
	ErrNotFound     = errors.New("papeletas: not found")
	ErrDuplicate    = errors.New("papeletas: duplicate papeleta_name")
	ErrInvalidInput = errors.New("papeletas: invalid input")
)

// ===== Service =====

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

func (s *Service) List(ctx context.Context, esc int32) (ListResult, error) {
	rows, err := s.q.ListPapeletas(ctx, esc)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.q.CountPapeletas(ctx, esc)
	if err != nil {
		return ListResult{}, err
	}
	items := make([]Papeleta, 0, len(rows))
	for _, r := range rows {
		items = append(items, Papeleta{
			PapeletaSk:            r.PapeletaSk,
			PapeletaName:          r.PapeletaName,
			PapeletaDescription:   r.PapeletaDescription,
			PapeletaBlock:         r.PapeletaBlock,
			PapeletaPlan:          r.PapeletaPlan,
			PapeletaTv:            numericPtr(r.PapeletaTv),
			PapeletaPilotCrpValue: r.PapeletaPilotCrpValue,
			PapeletaDvCrpValue:    r.PapeletaDvCrpValue,
			PapeletaExpiration:    r.PapeletaExpiration,
			PapeletaOrder:         r.PapeletaOrder,
		})
	}
	return ListResult{Items: items, TotalCount: total}, nil
}

func (s *Service) Create(ctx context.Context, esc int32, req WriteReq) (int32, error) {
	name := strings.TrimSpace(req.PapeletaName)
	if name == "" || req.PapeletaBlock == "" {
		return 0, ErrInvalidInput
	}
	id, err := s.q.InsertPapeleta(ctx, queries.InsertPapeletaParams{
		PapeletaName:          name,
		PapeletaDescription:   req.PapeletaDescription,
		PapeletaBlock:         req.PapeletaBlock,
		PapeletaPlan:          req.PapeletaPlan,
		PapeletaTv:            numericFromFloat(req.PapeletaTv),
		PapeletaPilotCrpValue: req.PapeletaPilotCrpValue,
		PapeletaDvCrpValue:    req.PapeletaDvCrpValue,
		PapeletaExpiration:    req.PapeletaExpiration,
		PapeletaOrder:         req.PapeletaOrder,
		PapeletaEscuadrillaFk: esc,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return 0, ErrDuplicate
		}
		return 0, err
	}
	return id, nil
}

func (s *Service) Update(ctx context.Context, esc int32, id int32, req WriteReq) error {
	name := strings.TrimSpace(req.PapeletaName)
	if name == "" || req.PapeletaBlock == "" {
		return ErrInvalidInput
	}
	n, err := s.q.UpdatePapeleta(ctx, queries.UpdatePapeletaParams{
		PapeletaName:          name,
		PapeletaDescription:   req.PapeletaDescription,
		PapeletaBlock:         req.PapeletaBlock,
		PapeletaPlan:          req.PapeletaPlan,
		PapeletaTv:            numericFromFloat(req.PapeletaTv),
		PapeletaPilotCrpValue: req.PapeletaPilotCrpValue,
		PapeletaDvCrpValue:    req.PapeletaDvCrpValue,
		PapeletaExpiration:    req.PapeletaExpiration,
		PapeletaOrder:         req.PapeletaOrder,
		PapeletaSk:            id,
		PapeletaEscuadrillaFk: esc,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return ErrDuplicate
		}
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
	operacional := auth.RequirePermission(auth.PermOperacional)
	g.GET("/papeletas", h.List, mw)
	g.POST("/papeletas", h.Create, mw, operacional)
	g.PUT("/papeletas/:id", h.Update, mw, operacional)
}

func (h *Handlers) List(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	res, err := h.svc.List(c.Request().Context(), int32(user.EscuadrillaID))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) Create(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req WriteReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	id, err := h.svc.Create(c.Request().Context(), int32(user.EscuadrillaID), req)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrDuplicate):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(http.StatusCreated, map[string]int32{"id": id})
}

func (h *Handlers) Update(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := httpx.IDParam(c, "id")
	if herr != nil {
		return herr
	}
	var req WriteReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	err := h.svc.Update(c.Request().Context(), int32(user.EscuadrillaID), id, req)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrDuplicate):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

// ===== Helpers =====

func isUniqueViolation(err error) bool {
	return strings.Contains(err.Error(), "23505") ||
		strings.Contains(err.Error(), "duplicate key")
}

// numericPtr extrae el float64 de un pgtype.Numeric, devolviendo nil si no es válido.
func numericPtr(n pgtype.Numeric) *float64 {
	if !n.Valid {
		return nil
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return nil
	}
	return &f.Float64
}

// numericFromFloat convierte *float64 a pgtype.Numeric.
func numericFromFloat(f *float64) pgtype.Numeric {
	if f == nil {
		return pgtype.Numeric{}
	}
	var n pgtype.Numeric
	_ = n.Scan(strconv.FormatFloat(*f, 'f', -1, 64))
	return n
}
