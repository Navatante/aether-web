package fuel

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/httpx"
	"github.com/14esc/aether-web/internal/queries"
)

const dateLayout = "2006-01-02"

// ===== Sentinel errors para mapearlos a HTTP en handlers =====

var (
	ErrInvalidInput = errors.New("fuel: invalid input")
	ErrNotFound     = errors.New("fuel: not found")
)

// ============================================================
// Service
// ============================================================

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

// monthBounds devuelve el primer y último día del mes (year, month). Si el mes
// o el año son inválidos, cae al mes en curso.
func monthBounds(year, month int) (pgtype.Date, pgtype.Date) {
	if month < 1 || month > 12 || year < 1 {
		now := time.Now()
		year, month = now.Year(), int(now.Month())
	}
	from := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 1, -1)
	return pgtype.Date{Time: from, Valid: true}, pgtype.Date{Time: to, Valid: true}
}

// ============================================================
// READS
// ============================================================

// List devuelve los repostajes del mes paginados (o el registro buscado por ID
// si FuelSk != 0), acotados a la escuadrilla.
func (s *Service) List(ctx context.Context, esc int32, p ListQueryParams) (FuelListResponse, error) {
	from, to := monthBounds(p.Year, p.Month)

	limit := httpx.ClampLimit(p.Limit, 25)

	rows, err := s.q.ListFuel(ctx, queries.ListFuelParams{
		AircraftEscuadrillaFk: esc,
		Column2:               p.FuelSk,
		FuelDate:              from,
		FuelDate_2:            to,
		Limit:                 limit,
		Offset:                p.Offset,
	})
	if err != nil {
		return FuelListResponse{}, err
	}
	total, err := s.q.CountFuel(ctx, queries.CountFuelParams{
		AircraftEscuadrillaFk: esc,
		Column2:               p.FuelSk,
		FuelDate:              from,
		FuelDate_2:            to,
	})
	if err != nil {
		return FuelListResponse{}, err
	}

	items := make([]FuelItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, FuelItem{
			ID:              r.FuelSk,
			FuelDate:        formatDate(r.FuelDate),
			FuelHeloFk:      r.FuelHeloFk,
			AircraftNumber:  r.AircraftNumber,
			FuelPlaceFk:     r.FuelPlaceFk,
			FuelPlaceName:   r.FuelPlaceName,
			FuelPlaceType:   r.FuelPlaceType,
			FuelPayerFk:     r.FuelPayerFk,
			FuelPayerAbbrev: r.FuelPayerAssignmentTypeAbbrev,
			FuelPayerName:   r.FuelPayerName,
			FuelEventFk:     r.FuelEventFk,
			EventName:       r.EventName,
			EventPlace:      r.EventPlace,
			FuelPhaseFk:     r.FuelPhaseFk,
			FuelPhase:       r.FuelPhase,
			FuelTypeFk:      r.FuelTypeFk,
			FuelType:        r.FuelType,
			FuelQty:         r.FuelQty,
		})
	}
	return FuelListResponse{Items: items, TotalCount: total}, nil
}

// Summary devuelve el informe seccionado del mes: filas de detalle agrupadas
// por pagador (con subtotal), la banda de totales por tipo de lugar y el único
// total general.
func (s *Service) Summary(ctx context.Context, esc int32, month, year int) (FuelSummary, error) {
	from, to := monthBounds(year, month)

	// Detalle ya ordenado por (pagador, evento, fase, lugar). Lo agrupamos por
	// pagador preservando ese orden dentro de cada grupo.
	detail, err := s.q.FuelDetailGrouped(ctx, queries.FuelDetailGroupedParams{AircraftEscuadrillaFk: esc, FuelDate: from, FuelDate_2: to})
	if err != nil {
		return FuelSummary{}, err
	}
	byPayer := map[string]*FuelPayerGroup{}
	order := []string{}
	var grand float64
	for _, r := range detail {
		g, ok := byPayer[r.Payer]
		if !ok {
			g = &FuelPayerGroup{Payer: r.Payer}
			byPayer[r.Payer] = g
			order = append(order, r.Payer)
		}
		g.Rows = append(g.Rows, FuelDetailRow{
			Event: r.Event, EventPlace: r.EventPlace, Phase: r.Phase, PlaceName: r.PlaceName, PlaceType: r.PlaceType, Qty: r.Qty,
		})
		g.Subtotal += r.Qty
		grand += r.Qty
	}
	payers := make([]FuelPayerGroup, 0, len(order))
	for _, p := range order {
		payers = append(payers, *byPayer[p])
	}
	// Pagador con más litros primero.
	sort.SliceStable(payers, func(i, j int) bool { return payers[i].Subtotal > payers[j].Subtotal })

	return FuelSummary{
		Payers:     payers,
		GrandTotal: grand,
	}, nil
}

// ============================================================
// WRITES
// ============================================================

// Insert crea un repostaje. La query solo inserta si el helo pertenece a la
// escuadrilla de la sesión (RETURNING vacío → ErrNoRows → ErrNotFound).
func (s *Service) Insert(ctx context.Context, esc int32, p FuelPayload) (InsertResult, error) {
	date, err := validatePayload(p)
	if err != nil {
		return InsertResult{}, err
	}
	sk, err := s.q.InsertFuel(ctx, queries.InsertFuelParams{
		FuelDate:              date,
		FuelHeloFk:            p.FuelHeloFk,
		FuelPlaceFk:           p.FuelPlaceFk,
		FuelPayerFk:           p.FuelPayerFk,
		FuelEventFk:           p.FuelEventFk,
		FuelPhaseFk:           p.FuelPhaseFk,
		FuelTypeFk:            p.FuelTypeFk,
		FuelQty:               numericFromFloat(p.FuelQty),
		AircraftEscuadrillaFk: esc,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return InsertResult{}, fmt.Errorf("%w: la aeronave no pertenece a tu escuadrilla", ErrInvalidInput)
	}
	if err != nil {
		return InsertResult{}, err
	}
	return InsertResult{ID: sk, Success: true, Message: "Repostaje registrado con éxito."}, nil
}

// Update modifica un repostaje, acotado a aeronaves de la escuadrilla.
func (s *Service) Update(ctx context.Context, esc int32, id int32, p FuelPayload) error {
	date, err := validatePayload(p)
	if err != nil {
		return err
	}
	n, err := s.q.UpdateFuel(ctx, queries.UpdateFuelParams{
		FuelSk:                id,
		FuelDate:              date,
		FuelHeloFk:            p.FuelHeloFk,
		FuelPlaceFk:           p.FuelPlaceFk,
		FuelPayerFk:           p.FuelPayerFk,
		FuelEventFk:           p.FuelEventFk,
		FuelPhaseFk:           p.FuelPhaseFk,
		FuelTypeFk:            p.FuelTypeFk,
		FuelQty:               numericFromFloat(p.FuelQty),
		AircraftEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// Delete borra un repostaje si su aeronave pertenece a la escuadrilla.
func (s *Service) Delete(ctx context.Context, esc int32, id int32) error {
	n, err := s.q.DeleteFuel(ctx, queries.DeleteFuelParams{FuelSk: id, AircraftEscuadrillaFk: esc})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ============================================================
// Helpers
// ============================================================

func validatePayload(p FuelPayload) (pgtype.Date, error) {
	t, err := time.Parse(dateLayout, p.FuelDate)
	if err != nil {
		return pgtype.Date{}, fmt.Errorf("%w: fecha inválida", ErrInvalidInput)
	}
	for _, fk := range []int32{p.FuelHeloFk, p.FuelPlaceFk, p.FuelPayerFk, p.FuelEventFk, p.FuelPhaseFk, p.FuelTypeFk} {
		if fk <= 0 {
			return pgtype.Date{}, fmt.Errorf("%w: faltan campos requeridos", ErrInvalidInput)
		}
	}
	if p.FuelQty <= 0 {
		return pgtype.Date{}, fmt.Errorf("%w: la cantidad debe ser mayor que 0", ErrInvalidInput)
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func formatDate(d pgtype.Date) string {
	if !d.Valid {
		return ""
	}
	return d.Time.Format(dateLayout)
}

func numericFromFloat(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	_ = n.Scan(strconv.FormatFloat(f, 'f', -1, 64))
	return n
}
