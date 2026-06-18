// Package extrahours implementa el alta, edición, listado y borrado de
// operations.extra_hour (horas de arrastre por persona).
//
// La tabla es person-centric (sin escuadrilla_fk). El aislamiento por
// escuadrilla se hace por código vía la escuadrilla de la persona
// (detall.person.person_escuadrilla_fk); cada query lo aplica. La tabla no
// tiene trigger de auditoría, así que no se setean los GUCs aether.user_id/
// ip_address (a diferencia de flights/persons).
package extrahours

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/queries"
)

// ============================================================
// Sentinel errors
// ============================================================

var (
	ErrNotFound     = errors.New("extrahours: not found")
	ErrInvalidInput = errors.New("extrahours: invalid input")
)

// ============================================================
// Service
// ============================================================

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

// validate comprueba que los campos numéricos no sean negativos (espeja los
// CHECK (... >= 0) del esquema) y que haya persona.
func validate(d ExtraHourFormData) error {
	if d.Person <= 0 {
		return fmt.Errorf("%w: persona requerida", ErrInvalidInput)
	}
	for name, v := range map[string]float64{
		"cta": d.Cta, "día": d.Day, "noche": d.ConvNight, "gvn": d.Gvn, "instrumentos": d.Inst,
	} {
		if v < 0 {
			return fmt.Errorf("%w: las horas de %s no pueden ser negativas", ErrInvalidInput, name)
		}
	}
	return nil
}

// ===== INSERT =====

func (s *Service) Insert(ctx context.Context, esc int32, d ExtraHourFormData) (InsertResult, error) {
	if err := validate(d); err != nil {
		return InsertResult{}, err
	}

	q := queries.New(s.pool)
	id, err := q.InsertExtraHour(ctx, queries.InsertExtraHourParams{
		ExtraHoursPersonFk:  d.Person,
		ExtraHoursCta:       numericFromFloat(d.Cta),
		ExtraHoursDay:       numericFromFloat(d.Day),
		ExtraHoursConvNight: numericFromFloat(d.ConvNight),
		ExtraHoursGvn:       numericFromFloat(d.Gvn),
		ExtraHoursInst:      numericFromFloat(d.Inst),
		ExtraHoursRemarks:   remarksPtr(d.Remarks),
		PersonEscuadrillaFk: esc,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// La persona no pertenece a la escuadrilla de la sesión.
		return InsertResult{}, fmt.Errorf("%w: persona no encontrada en la escuadrilla", ErrInvalidInput)
	}
	if err != nil {
		return InsertResult{}, err
	}
	return InsertResult{ID: id, Success: true, Message: "Horas extra registradas"}, nil
}

// ===== UPDATE =====

func (s *Service) Update(ctx context.Context, esc int32, id int32, d ExtraHourFormData) error {
	if err := validate(d); err != nil {
		return err
	}

	q := queries.New(s.pool)
	n, err := q.UpdateExtraHour(ctx, queries.UpdateExtraHourParams{
		ExtraHoursSk:        id,
		ExtraHoursCta:       numericFromFloat(d.Cta),
		ExtraHoursDay:       numericFromFloat(d.Day),
		ExtraHoursConvNight: numericFromFloat(d.ConvNight),
		ExtraHoursGvn:       numericFromFloat(d.Gvn),
		ExtraHoursInst:      numericFromFloat(d.Inst),
		ExtraHoursRemarks:   remarksPtr(d.Remarks),
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ===== DELETE =====

func (s *Service) Delete(ctx context.Context, esc int32, id int32) error {
	q := queries.New(s.pool)
	n, err := q.DeleteExtraHour(ctx, queries.DeleteExtraHourParams{
		ExtraHoursSk: id, PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ===== LIST (vista agrupada por persona) =====

func (s *Service) ListPersonTotals(ctx context.Context, esc int32, p ListQueryParams) (PersonTotalsResult, error) {
	if p.Limit <= 0 {
		p.Limit = 20
	}

	q := queries.New(s.pool)
	rows, err := q.ListExtraHourPersonTotals(ctx, queries.ListExtraHourPersonTotalsParams{
		PersonEscuadrillaFk: esc,
		Column2:             p.Search,
		Limit:               p.Limit,
		Offset:              p.Offset,
	})
	if err != nil {
		return PersonTotalsResult{}, err
	}
	total, err := q.CountExtraHourPersons(ctx, queries.CountExtraHourPersonsParams{
		PersonEscuadrillaFk: esc,
		Column2:             p.Search,
	})
	if err != nil {
		return PersonTotalsResult{}, err
	}

	items := make([]PersonTotalsItem, 0, len(rows))
	for _, r := range rows {
		nk := ""
		if r.PersonNk != nil {
			nk = *r.PersonNk
		}
		items = append(items, PersonTotalsItem{
			PersonSk:    r.PersonSk,
			Persona:     r.Persona,
			PersonaNk:   nk,
			RecordCount: r.RecordCount,
			Cta:         r.Cta,
			Day:         r.Day,
			ConvNight:   r.ConvNight,
			Gvn:         r.Gvn,
			Inst:        r.Inst,
		})
	}
	return PersonTotalsResult{Items: items, TotalCount: total}, nil
}

// ===== DETALLE (registros individuales de una persona) =====

func (s *Service) ListByPerson(ctx context.Context, esc int32, personSk int32) ([]ExtraHourItem, error) {
	q := queries.New(s.pool)
	rows, err := q.ListExtraHourByPerson(ctx, queries.ListExtraHourByPersonParams{
		PersonEscuadrillaFk: esc,
		ExtraHoursPersonFk:  personSk,
	})
	if err != nil {
		return nil, err
	}

	items := make([]ExtraHourItem, 0, len(rows))
	for _, r := range rows {
		nk := ""
		if r.PersonNk != nil {
			nk = *r.PersonNk
		}
		remarks := ""
		if r.ExtraHoursRemarks != nil {
			remarks = *r.ExtraHoursRemarks
		}
		items = append(items, ExtraHourItem{
			ID:        r.ExtraHoursSk,
			Persona:   r.Persona,
			PersonaNk: nk,
			PersonSk:  r.ExtraHoursPersonFk,
			Cta:       r.Cta,
			Day:       r.Day,
			ConvNight: r.ConvNight,
			Gvn:       r.Gvn,
			Inst:      r.Inst,
			Remarks:   remarks,
		})
	}
	return items, nil
}

// ============================================================
// Helpers
// ============================================================

// remarksPtr devuelve nil para cadena vacía (columna nullable) o el puntero al
// texto en caso contrario.
func remarksPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func numericFromFloat(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	_ = n.Scan(strconv.FormatFloat(f, 'f', -1, 64))
	return n
}
