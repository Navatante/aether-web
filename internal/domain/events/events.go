// Package events implementa el CRUD del catálogo operations.event.
// El catálogo es global (sin escuadrilla_fk) y compartido entre escuadrillas.
package events

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/queries"
)

// ===== DTOs =====

type Event struct {
	EventSk    int32  `json:"event_sk"`
	EventName  string `json:"event_name"`
	EventPlace string `json:"event_place"`
}

type ListResult struct {
	Items      []Event `json:"items"`
	TotalCount int32   `json:"total_count"`
}

type WriteReq struct {
	EventName  string `json:"event_name"`
	EventPlace string `json:"event_place"`
}

// ===== Sentinel errors =====

var (
	ErrNotFound     = errors.New("events: not found")
	ErrDuplicate    = errors.New("events: duplicate event_name + event_place")
	ErrInvalidInput = errors.New("events: invalid input")
	ErrInUse        = errors.New("events: referenced by other records")
)

// ===== Service =====

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: queries.New(pool)}
}

func (s *Service) List(ctx context.Context) (ListResult, error) {
	rows, err := s.q.GetEventsAll(ctx)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.q.CountEvents(ctx)
	if err != nil {
		return ListResult{}, err
	}
	items := make([]Event, 0, len(rows))
	for _, r := range rows {
		items = append(items, Event{EventSk: r.EventSk, EventName: r.EventName, EventPlace: r.EventPlace})
	}
	return ListResult{Items: items, TotalCount: total}, nil
}

func (s *Service) Create(ctx context.Context, req WriteReq) (int32, error) {
	name := strings.TrimSpace(req.EventName)
	place := strings.TrimSpace(req.EventPlace)
	if name == "" || place == "" {
		return 0, ErrInvalidInput
	}
	// El event_name debe existir como FK; lo upsert por idempotencia.
	if err := s.q.UpsertEventName(ctx, name); err != nil {
		return 0, err
	}
	id, err := s.q.InsertEvent(ctx, queries.InsertEventParams{EventName: name, EventPlace: place})
	if err != nil {
		if isUniqueViolation(err) {
			return 0, ErrDuplicate
		}
		return 0, err
	}
	return id, nil
}

func (s *Service) Update(ctx context.Context, id int32, req WriteReq) error {
	name := strings.TrimSpace(req.EventName)
	place := strings.TrimSpace(req.EventPlace)
	if name == "" || place == "" {
		return ErrInvalidInput
	}
	if err := s.q.UpsertEventName(ctx, name); err != nil {
		return err
	}
	n, err := s.q.UpdateEvent(ctx, queries.UpdateEventParams{EventName: name, EventPlace: place, EventSk: id})
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

func (s *Service) Delete(ctx context.Context, id int32) error {
	n, err := s.q.DeleteEvent(ctx, id)
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

// ===== Handlers =====

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	g.GET("/events", h.List, mw)
	g.POST("/events", h.Create, mw)
	g.PUT("/events/:id", h.Update, mw)
	g.DELETE("/events/:id", h.Delete, mw)
}

func (h *Handlers) List(c echo.Context) error {
	res, err := h.svc.List(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, res)
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
	case errors.Is(err, ErrDuplicate):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
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
	case errors.Is(err, ErrDuplicate):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
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
	case errors.Is(err, ErrInUse):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// ===== Helpers =====

func parseID(c echo.Context) (int32, error) {
	raw := c.Param("id")
	n, err := strconv.ParseInt(raw, 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return int32(n), nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func isFKViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
