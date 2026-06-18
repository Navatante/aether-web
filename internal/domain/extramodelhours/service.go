// Package extramodelhours implementa el alta, edición, listado y borrado de
// operations.extra_model_hour (horas del modelo de aeronave anterior por
// persona, con fecha y tipo real/simulador).
//
// La tabla es person-centric (sin escuadrilla_fk). El aislamiento por
// escuadrilla se hace por código vía la escuadrilla de la persona
// (detall.person.person_escuadrilla_fk); cada query lo aplica. No hay trigger
// de auditoría, así que no se setean los GUCs aether.user_id/ip_address.
package extramodelhours

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/queries"
)

// ============================================================
// Sentinel errors
// ============================================================

var (
	ErrNotFound     = errors.New("extramodelhours: not found")
	ErrInvalidInput = errors.New("extramodelhours: invalid input")
)

// ============================================================
// Service
// ============================================================

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

// parseForm valida y normaliza los datos del formulario: persona, fecha y horas
// no negativas (espeja los CHECK (... >= 0) del esquema).
func parseForm(d ExtraModelHourFormData) (pgtype.Date, error) {
	if d.Person <= 0 {
		return pgtype.Date{}, fmt.Errorf("%w: persona requerida", ErrInvalidInput)
	}
	t, err := time.ParseInLocation("2006-01-02", d.Date, time.UTC)
	if err != nil {
		return pgtype.Date{}, fmt.Errorf("%w: fecha: %v", ErrInvalidInput, err)
	}
	for name, v := range map[string]float64{
		"cta": d.Cta, "día": d.Day, "noche": d.ConvNight, "gvn": d.Gvn, "instrumentos": d.Inst,
	} {
		if v < 0 {
			return pgtype.Date{}, fmt.Errorf("%w: las horas de %s no pueden ser negativas", ErrInvalidInput, name)
		}
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

// ===== INSERT =====

func (s *Service) Insert(ctx context.Context, esc int32, d ExtraModelHourFormData) (InsertResult, error) {
	date, err := parseForm(d)
	if err != nil {
		return InsertResult{}, err
	}

	q := queries.New(s.pool)
	id, err := q.InsertExtraModelHour(ctx, queries.InsertExtraModelHourParams{
		ExtraModelHoursDate:      date,
		ExtraModelHoursPersonFk:  d.Person,
		ExtraModelHoursIsReal:    d.IsReal,
		ExtraModelHoursCta:       numericFromFloat(d.Cta),
		ExtraModelHoursDay:       numericFromFloat(d.Day),
		ExtraModelHoursConvNight: numericFromFloat(d.ConvNight),
		ExtraModelHoursGvn:       numericFromFloat(d.Gvn),
		ExtraModelHoursInst:      numericFromFloat(d.Inst),
		ExtraModelHoursRemarks:   remarksPtr(d.Remarks),
		PersonEscuadrillaFk:      esc,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return InsertResult{}, fmt.Errorf("%w: persona no encontrada en la escuadrilla", ErrInvalidInput)
	}
	if err != nil {
		return InsertResult{}, err
	}
	return InsertResult{ID: id, Success: true, Message: "Horas de modelo registradas"}, nil
}

// ===== UPDATE =====

func (s *Service) Update(ctx context.Context, esc int32, id int32, d ExtraModelHourFormData) error {
	date, err := parseForm(d)
	if err != nil {
		return err
	}

	q := queries.New(s.pool)
	n, err := q.UpdateExtraModelHour(ctx, queries.UpdateExtraModelHourParams{
		ExtraModelHoursSk:        id,
		ExtraModelHoursDate:      date,
		ExtraModelHoursIsReal:    d.IsReal,
		ExtraModelHoursCta:       numericFromFloat(d.Cta),
		ExtraModelHoursDay:       numericFromFloat(d.Day),
		ExtraModelHoursConvNight: numericFromFloat(d.ConvNight),
		ExtraModelHoursGvn:       numericFromFloat(d.Gvn),
		ExtraModelHoursInst:      numericFromFloat(d.Inst),
		ExtraModelHoursRemarks:   remarksPtr(d.Remarks),
		PersonEscuadrillaFk:      esc,
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
	n, err := q.DeleteExtraModelHour(ctx, queries.DeleteExtraModelHourParams{
		ExtraModelHoursSk: id, PersonEscuadrillaFk: esc,
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
	rows, err := q.ListExtraModelHourPersonTotals(ctx, queries.ListExtraModelHourPersonTotalsParams{
		PersonEscuadrillaFk: esc,
		Column2:             p.Search,
		Limit:               p.Limit,
		Offset:              p.Offset,
	})
	if err != nil {
		return PersonTotalsResult{}, err
	}
	total, err := q.CountExtraModelHourPersons(ctx, queries.CountExtraModelHourPersonsParams{
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

func (s *Service) ListByPerson(ctx context.Context, esc int32, personSk int32) ([]ExtraModelHourItem, error) {
	q := queries.New(s.pool)
	rows, err := q.ListExtraModelHourByPerson(ctx, queries.ListExtraModelHourByPersonParams{
		PersonEscuadrillaFk:     esc,
		ExtraModelHoursPersonFk: personSk,
	})
	if err != nil {
		return nil, err
	}

	items := make([]ExtraModelHourItem, 0, len(rows))
	for _, r := range rows {
		nk := ""
		if r.PersonNk != nil {
			nk = *r.PersonNk
		}
		date := ""
		if r.ExtraModelHoursDate.Valid {
			date = r.ExtraModelHoursDate.Time.Format("2006-01-02")
		}
		remarks := ""
		if r.ExtraModelHoursRemarks != nil {
			remarks = *r.ExtraModelHoursRemarks
		}
		items = append(items, ExtraModelHourItem{
			ID:        r.ExtraModelHoursSk,
			Persona:   r.Persona,
			PersonaNk: nk,
			PersonSk:  r.ExtraModelHoursPersonFk,
			Date:      date,
			IsReal:    r.ExtraModelHoursIsReal,
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
