// Package groundschool implementa el alta, listado y borrado de
// operations.ground_school (asistencia a clases de teoría por persona).
//
// El alta es transaccional: una sesión (papeleta + fecha/hora) inserta una
// fila por persona. La tabla no tiene trigger de auditoría, así que no se
// setean los GUCs aether.user_id/ip_address (a diferencia de flights/persons).
package groundschool

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/queries"
)

// ============================================================
// Sentinel errors
// ============================================================

var (
	ErrNotFound     = errors.New("groundschool: not found")
	ErrInvalidInput = errors.New("groundschool: invalid input")
)

// ============================================================
// Service
// ============================================================

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

// ===== INSERT =====

func (s *Service) Insert(ctx context.Context, esc int32, data GroundSchoolFormData) (InsertResult, error) {
	// Solo fecha (la hora no es relevante): se almacena a medianoche UTC y se
	// lee igual (round-trip en UTC) para evitar desfases de zona.
	ts, err := time.ParseInLocation("2006-01-02", data.Date, time.UTC)
	if err != nil {
		return InsertResult{}, fmt.Errorf("%w: fecha: %v", ErrInvalidInput, err)
	}
	if data.Papeleta <= 0 {
		return InsertResult{}, fmt.Errorf("%w: papeleta requerida", ErrInvalidInput)
	}
	if len(data.Persons) == 0 {
		return InsertResult{}, fmt.Errorf("%w: al menos una persona requerida", ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return InsertResult{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	q := queries.New(tx)
	var inserted int32
	for _, personSk := range data.Persons {
		if _, err := q.InsertGroundSchool(ctx, queries.InsertGroundSchoolParams{
			GroundSchoolDatetime:      pgtype.Timestamptz{Time: ts, Valid: true},
			GroundSchoolPersonFk:      personSk,
			GroundSchoolPapeletaFk:    data.Papeleta,
			GroundSchoolEscuadrillaFk: esc,
		}); err != nil {
			return InsertResult{}, fmt.Errorf("insert ground_school: %w", err)
		}
		inserted++
	}

	if err := tx.Commit(ctx); err != nil {
		return InsertResult{}, err
	}

	return InsertResult{
		Inserted: inserted, Success: true,
		Message: fmt.Sprintf("%d registro(s) de ground school creado(s)", inserted),
	}, nil
}

// ===== DELETE =====

func (s *Service) Delete(ctx context.Context, esc int32, id int32) error {
	q := queries.New(s.pool)
	n, err := q.DeleteGroundSchool(ctx, queries.DeleteGroundSchoolParams{
		GroundSchoolSk: id, GroundSchoolEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ===== LIST =====

func (s *Service) List(ctx context.Context, esc int32, p ListQueryParams) (ListResult, error) {
	if p.Limit <= 0 {
		p.Limit = 20
	}

	q := queries.New(s.pool)
	rows, err := q.ListGroundSchool(ctx, queries.ListGroundSchoolParams{
		GroundSchoolEscuadrillaFk: esc,
		Column2:                   p.GroundSchoolSk,
		Limit:                     p.Limit,
		Offset:                    p.Offset,
	})
	if err != nil {
		return ListResult{}, err
	}
	total, err := q.CountGroundSchool(ctx, queries.CountGroundSchoolParams{
		GroundSchoolEscuadrillaFk: esc,
		Column2:                   p.GroundSchoolSk,
	})
	if err != nil {
		return ListResult{}, err
	}

	items := make([]GroundSchoolItem, 0, len(rows))
	for _, r := range rows {
		nk := ""
		if r.PersonNk != nil {
			nk = *r.PersonNk
		}
		items = append(items, GroundSchoolItem{
			ID:          r.GroundSchoolSk,
			Fecha:       r.GroundSchoolDatetime.Time.UTC().Format("2006-01-02"),
			Persona:     r.Persona,
			PersonaNk:   nk,
			Papeleta:    r.PapeletaName,
			Bloque:      r.PapeletaBlock,
			Descripcion: r.PapeletaDescription,
		})
	}
	return ListResult{Items: items, TotalCount: total}, nil
}
