// Package comisiones implementa el CRUD de detall.comision +
// detall.comision_lugar + detall.person_comision y los SPs de listado.
//
// Fixes vs Rust:
//   - update/delete_comision: WHERE incluye comision_escuadrilla_fk.
//   - bulk insert person→comision: validación pre-transacción (overlap
//     con otra comisión + overlap con ausencia), insert dentro de TX.
package comisiones

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/queries"
)

// ============================================================
// Sentinel errors
// ============================================================

var (
	ErrNotFound     = errors.New("comisiones: not found")
	ErrInvalidInput = errors.New("comisiones: invalid input")
	ErrInUse        = errors.New("comisiones: referenced by other records")
	ErrDuplicate    = errors.New("comisiones: duplicate")
	ErrUnknownType  = errors.New("comisiones: unknown comision_type")
	ErrUnknownLugar = errors.New("comisiones: unknown comision_lugar")
)

// ValidationError carries the list of per-person errors for bulk assign.
type ValidationError struct {
	Errors []string
}

func (e *ValidationError) Error() string { return strings.Join(e.Errors, ". ") }

// ============================================================
// Service
// ============================================================

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

// ----- Resolvers -----

func (s *Service) resolveType(ctx context.Context, raw string) (int32, error) {
	if n, err := strconv.ParseInt(raw, 10, 32); err == nil {
		return int32(n), nil
	}
	sk, err := s.q.ResolveComisionType(ctx, raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrUnknownType
	}
	return sk, err
}

func (s *Service) resolveLugar(ctx context.Context, raw string) (int32, error) {
	if n, err := strconv.ParseInt(raw, 10, 32); err == nil {
		return int32(n), nil
	}
	sk, err := s.q.ResolveComisionLugar(ctx, raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrUnknownLugar
	}
	return sk, err
}

// ----- Comisión CRUD -----

func (s *Service) Create(ctx context.Context, esc int32, data ComisionFormData) (InsertResult, error) {
	start, end, err := parseRange(data.StartDate, data.EndDate)
	if err != nil {
		return InsertResult{}, err
	}
	salida, llegada, err := parseHoras(data.HoraSalida, data.HoraLlegada)
	if err != nil {
		return InsertResult{}, err
	}
	typeFk, err := s.resolveType(ctx, data.Tipo)
	if err != nil {
		return InsertResult{}, err
	}
	lugarFk, err := s.resolveLugar(ctx, data.Lugar)
	if err != nil {
		return InsertResult{}, err
	}
	id, err := s.q.InsertComision(ctx, queries.InsertComisionParams{
		ComisionStartDate:     start,
		ComisionEndDate:       end,
		ComisionTypeFk:        typeFk,
		ComisionLugarFk:       lugarFk,
		ComisionEscuadrillaFk: esc,
		ComisionEsfuerzo:      data.GeneratesEffort,
		ComisionDepartureTime: salida,
		ComisionArrivalTime:   llegada,
		ComisionCode:          textOrNull(data.Codigo),
	})
	if err != nil {
		return InsertResult{}, err
	}
	return InsertResult{
		ComisionID: id,
		Success:    true,
		Message:    fmt.Sprintf("Comision registrada con ID: %d", id),
	}, nil
}

func (s *Service) Update(ctx context.Context, esc int32, id int32, data ComisionFormData) error {
	start, end, err := parseRange(data.StartDate, data.EndDate)
	if err != nil {
		return err
	}
	salida, llegada, err := parseHoras(data.HoraSalida, data.HoraLlegada)
	if err != nil {
		return err
	}
	typeFk, err := s.resolveType(ctx, data.Tipo)
	if err != nil {
		return err
	}
	lugarFk, err := s.resolveLugar(ctx, data.Lugar)
	if err != nil {
		return err
	}
	n, err := s.q.UpdateComision(ctx, queries.UpdateComisionParams{
		ComisionStartDate:     start,
		ComisionEndDate:       end,
		ComisionTypeFk:        typeFk,
		ComisionLugarFk:       lugarFk,
		ComisionEsfuerzo:      data.GeneratesEffort,
		ComisionDepartureTime: salida,
		ComisionArrivalTime:   llegada,
		ComisionCode:          textOrNull(data.Codigo),
		ComisionSk:            id,
		ComisionEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) Delete(ctx context.Context, esc int32, id int32) error {
	n, err := s.q.DeleteComision(ctx, queries.DeleteComisionParams{
		ComisionSk:            id,
		ComisionEscuadrillaFk: esc,
	})
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

// ----- Comisión listings -----

func (s *Service) List(ctx context.Context, esc int32, p QueryParams) (ComisionQueryResult, error) {
	df, dt, err := parseOptionalDates(p.DateFrom, p.DateTo)
	if err != nil {
		return ComisionQueryResult{}, err
	}
	if p.Limit <= 0 {
		p.Limit = 10
	}

	rows, err := s.q.ListComisiones(ctx, queries.ListComisionesParams{
		ComisionEscuadrillaFk: esc,
		Column2:               p.ComisionSk,
		Column3:               df,
		Column4:               dt,
		Limit:                 p.Limit,
		Offset:                p.Offset,
	})
	if err != nil {
		return ComisionQueryResult{}, err
	}
	total, err := s.q.CountComisiones(ctx, queries.CountComisionesParams{
		ComisionEscuadrillaFk: esc,
		Column2:               p.ComisionSk,
		Column3:               df,
		Column4:               dt,
	})
	if err != nil {
		return ComisionQueryResult{}, err
	}

	items := make([]ComisionListItem, 0, len(rows))
	for _, r := range rows {
		participantes, err := s.listPeople(ctx, r.ComisionSk)
		if err != nil {
			return ComisionQueryResult{}, err
		}
		items = append(items, ComisionListItem{
			ComisionSk:    r.ComisionSk,
			FechaInicio:   r.ComisionStartDate.Time.Format("2006-01-02"),
			FechaFin:      r.ComisionEndDate.Time.Format("2006-01-02"),
			Dias:          r.Dias,
			Lugar:         r.Lugar,
			Tipo:          r.Tipo,
			Esfuerzo:      r.Esfuerzo,
			HoraSalida:    formatHora(r.HoraSalida),
			HoraLlegada:   formatHora(r.HoraLlegada),
			ComisionCode:  deref(r.Codigo),
			Participantes: participantes,
		})
	}
	return ComisionQueryResult{Items: items, TotalCount: total}, nil
}

func (s *Service) listPeople(ctx context.Context, comisionSk int32) ([]ComisionParticipante, error) {
	rows, err := s.q.ListComisionPeople(ctx, comisionSk)
	if err != nil {
		return nil, err
	}
	out := make([]ComisionParticipante, 0, len(rows))
	for _, r := range rows {
		out = append(out, ComisionParticipante{
			PersonComisionSk: r.PersonComisionSk,
			Nombre:           r.Nombre,
			Orden:            r.Orden,
		})
	}
	return out, nil
}

func (s *Service) ListWithPeople(ctx context.Context, esc int32, p QueryParams) (ComisionWithPeopleResult, error) {
	// Reutilizamos las queries paginadas pero usamos ListComisionPeopleExpanded
	// para conseguir el shape distinto de "people".
	df, dt, err := parseOptionalDates(p.DateFrom, p.DateTo)
	if err != nil {
		return ComisionWithPeopleResult{}, err
	}
	if p.Limit <= 0 {
		p.Limit = 50
	}

	rows, err := s.q.ListComisiones(ctx, queries.ListComisionesParams{
		ComisionEscuadrillaFk: esc,
		Column2:               p.ComisionSk,
		Column3:               df,
		Column4:               dt,
		Limit:                 p.Limit,
		Offset:                p.Offset,
	})
	if err != nil {
		return ComisionWithPeopleResult{}, err
	}
	total, err := s.q.CountComisiones(ctx, queries.CountComisionesParams{
		ComisionEscuadrillaFk: esc,
		Column2:               p.ComisionSk,
		Column3:               df,
		Column4:               dt,
	})
	if err != nil {
		return ComisionWithPeopleResult{}, err
	}

	items := make([]ComisionWithPeopleItem, 0, len(rows))
	for _, r := range rows {
		people, err := s.q.ListComisionPeopleExpanded(ctx, r.ComisionSk)
		if err != nil {
			return ComisionWithPeopleResult{}, err
		}
		ppl := make([]Person, 0, len(people))
		for _, p := range people {
			ppl = append(ppl, Person{
				PersonSk: p.PersonSk, PersonNk: p.PersonNk,
				PersonRank: p.PersonRank, PersonName: p.PersonName,
				PersonLastName1: p.PersonLastName1, PersonLastName2: p.PersonLastName2,
			})
		}
		items = append(items, ComisionWithPeopleItem{
			ComisionSk:              r.ComisionSk,
			ComisionDateStart:       r.ComisionStartDate.Time.Format("2006-01-02"),
			ComisionDateEnd:         r.ComisionEndDate.Time.Format("2006-01-02"),
			ComisionType:            r.Tipo,
			ComisionLocation:        r.Lugar,
			ComisionGeneratesEffort: r.Esfuerzo,
			People:                  ppl,
		})
	}
	return ComisionWithPeopleResult{Items: items, TotalCount: total}, nil
}

// ----- comision_lugar CRUD -----

func (s *Service) CreateLugar(ctx context.Context, name string) (LugarResult, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return LugarResult{}, ErrInvalidInput
	}
	exists, err := s.q.LugarExistsByName(ctx, name)
	if err != nil {
		return LugarResult{}, err
	}
	if exists {
		return LugarResult{}, ErrDuplicate
	}
	row, err := s.q.InsertComisionLugar(ctx, name)
	if err != nil {
		return LugarResult{}, err
	}
	return LugarResult{ComisionLugarSk: row.ComisionLugarSk, ComisionName: row.ComisionName}, nil
}

func (s *Service) UpdateLugar(ctx context.Context, id int32, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return ErrInvalidInput
	}
	dupe, err := s.q.LugarExistsByNameOther(ctx, queries.LugarExistsByNameOtherParams{
		ComisionName:    name,
		ComisionLugarSk: id,
	})
	if err != nil {
		return err
	}
	if dupe {
		return ErrDuplicate
	}
	n, err := s.q.UpdateComisionLugar(ctx, queries.UpdateComisionLugarParams{
		ComisionName: name, ComisionLugarSk: id,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) DeleteLugar(ctx context.Context, id int32) error {
	used, err := s.q.LugarUsageCount(ctx, id)
	if err != nil {
		return err
	}
	if used > 0 {
		return ErrInUse
	}
	n, err := s.q.DeleteComisionLugar(ctx, id)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ----- person_comision -----

// AssignPeopleToComision: valida primero todas las personas, luego inserta en TX.
func (s *Service) AssignPeopleToComision(ctx context.Context, esc int32, comisionSk int32, personSks []int32) (PersonToComisionInsertResult, error) {
	if len(personSks) == 0 {
		return PersonToComisionInsertResult{}, ErrInvalidInput
	}

	dates, err := s.q.GetComisionDates(ctx, queries.GetComisionDatesParams{
		ComisionSk:            comisionSk,
		ComisionEscuadrillaFk: esc,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return PersonToComisionInsertResult{}, ErrNotFound
	}
	if err != nil {
		return PersonToComisionInsertResult{}, err
	}

	// RLS: los person_sk vienen del cliente. Antes de tocarlos (nombres,
	// solapes, INSERT) verificamos que TODOS pertenecen a la escuadrilla de la
	// sesión; si alguno es de otra escuadrilla, rechazamos el lote entero sin
	// filtrar datos de esa persona. Esto cierra el hueco de las queries
	// "personkeyed" que no llevan filtro de escuadrilla.
	validSks, err := s.q.PersonsInEscuadrilla(ctx, queries.PersonsInEscuadrillaParams{
		Column1:             personSks,
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return PersonToComisionInsertResult{}, err
	}
	valid := make(map[int32]struct{}, len(validSks))
	for _, sk := range validSks {
		valid[sk] = struct{}{}
	}
	for _, ps := range personSks {
		if _, ok := valid[ps]; !ok {
			return PersonToComisionInsertResult{}, ErrInvalidInput
		}
	}

	// Fase 1: validar todas, acumular errores.
	verrs := &ValidationError{}
	for _, ps := range personSks {
		name, err := s.q.PersonFullName(ctx, ps)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return PersonToComisionInsertResult{}, err
		}
		if name == "" {
			name = fmt.Sprintf("ID: %d", ps)
		}

		dup, err := s.q.PersonAlreadyInComision(ctx, queries.PersonAlreadyInComisionParams{
			ComisionFk: comisionSk, PersonFk: ps,
		})
		if err != nil {
			return PersonToComisionInsertResult{}, err
		}
		if dup {
			verrs.Errors = append(verrs.Errors, fmt.Sprintf("%s ya esta asignado/a a esta comision", name))
			continue
		}

		overlap, err := s.q.PersonHasOverlapComision(ctx, queries.PersonHasOverlapComisionParams{
			PersonFk: ps, Column2: dates.ComisionStartDate, Column3: dates.ComisionEndDate,
		})
		if err != nil {
			return PersonToComisionInsertResult{}, err
		}
		if overlap {
			verrs.Errors = append(verrs.Errors, fmt.Sprintf("%s ya tiene otra comision en esas fechas", name))
			continue
		}

		abs, err := s.q.PersonHasOverlapAbsence(ctx, queries.PersonHasOverlapAbsenceParams{
			AbsencePersonFk: ps, Column2: dates.ComisionStartDate, Column3: dates.ComisionEndDate,
		})
		if err != nil {
			return PersonToComisionInsertResult{}, err
		}
		if abs {
			verrs.Errors = append(verrs.Errors, fmt.Sprintf("%s tiene una ausencia en esas fechas", name))
		}
	}
	if len(verrs.Errors) > 0 {
		return PersonToComisionInsertResult{}, verrs
	}

	// Fase 2: insertar en transacción.
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return PersonToComisionInsertResult{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(tx)
	var inserted int32
	for _, ps := range personSks {
		if err := qtx.InsertPersonToComision(ctx, queries.InsertPersonToComisionParams{
			ComisionFk: comisionSk, PersonFk: ps,
		}); err != nil {
			return PersonToComisionInsertResult{}, err
		}
		inserted++
	}
	if err := tx.Commit(ctx); err != nil {
		return PersonToComisionInsertResult{}, err
	}

	return PersonToComisionInsertResult{
		ComisionID:         comisionSk,
		Success:            true,
		Message:            fmt.Sprintf("%d persona(s) asignada(s) correctamente a la comision", inserted),
		PersonasInsertadas: inserted,
	}, nil
}

func (s *Service) DeletePersonFromComision(ctx context.Context, comisionSk, personSk int32) error {
	n, err := s.q.DeletePersonFromComision(ctx, queries.DeletePersonFromComisionParams{
		ComisionFk: comisionSk, PersonFk: personSk,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) DeletePersonComisionBySk(ctx context.Context, esc int32, sk int32) error {
	n, err := s.q.DeletePersonComisionBySk(ctx, queries.DeletePersonComisionBySkParams{
		PersonComisionSk:      sk,
		ComisionEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ----- sp_get_dias_comision -----

func (s *Service) DiasComision(ctx context.Context, esc int32, fechaFin string) ([]DiasComisionItem, error) {
	fin := time.Now().UTC()
	if fechaFin != "" {
		t, err := time.Parse("2006-01-02", fechaFin)
		if err != nil {
			return nil, ErrInvalidInput
		}
		fin = t
	}
	rows, err := s.q.DiasComision(ctx, queries.DiasComisionParams{
		Column1:             pgtype.Date{Time: fin, Valid: true},
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, err
	}
	out := make([]DiasComisionItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, DiasComisionItem{
			PersonRank:            r.PersonRank,
			FullName:              r.FullName,
			PersonRol:             r.PersonRol,
			Escala:                r.Escala,
			B1:                    r.B1,
			B2:                    r.B2,
			LV:                    r.Lv,
			DiasBaseCortaDuracion: r.DiasBaseCortaDuracion,
			DiasDespliegues:       r.DiasDespliegues,
			DiasVoluntarias:       r.DiasVoluntarias,
			DiasOMP:               r.DiasOmp,
			DiasUNADEST:           r.DiasUnadest,
			DiasUNAEMB:            r.DiasUnaemb,
			DiasRancheria:         r.DiasRancheria,
		})
	}
	return out, nil
}

// ============================================================
// Helpers
// ============================================================

func parseRange(start, end string) (pgtype.Date, pgtype.Date, error) {
	s, err := time.Parse("2006-01-02", start)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, ErrInvalidInput
	}
	e, err := time.Parse("2006-01-02", end)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, ErrInvalidInput
	}
	if s.After(e) {
		return pgtype.Date{}, pgtype.Date{}, ErrInvalidInput
	}
	return pgtype.Date{Time: s, Valid: true}, pgtype.Date{Time: e, Valid: true}, nil
}

// parseHoras convierte "HH:MM" (hora local wall-clock) a pgtype.Time
// (microsegundos desde medianoche). Ambas son obligatorias.
func parseHoras(salida, llegada string) (pgtype.Time, pgtype.Time, error) {
	s, err := parseHora(salida)
	if err != nil {
		return pgtype.Time{}, pgtype.Time{}, err
	}
	l, err := parseHora(llegada)
	if err != nil {
		return pgtype.Time{}, pgtype.Time{}, err
	}
	return s, l, nil
}

func parseHora(hhmm string) (pgtype.Time, error) {
	t, err := time.Parse("15:04", hhmm)
	if err != nil {
		return pgtype.Time{}, ErrInvalidInput
	}
	micros := int64(t.Hour()*3600+t.Minute()*60) * 1_000_000
	return pgtype.Time{Microseconds: micros, Valid: true}, nil
}

// formatHora convierte pgtype.Time de vuelta a "HH:MM".
func formatHora(t pgtype.Time) string {
	if !t.Valid {
		return ""
	}
	totalMin := t.Microseconds / 1_000_000 / 60
	return fmt.Sprintf("%02d:%02d", totalMin/60, totalMin%60)
}

func parseOptionalDates(from, to string) (pgtype.Date, pgtype.Date, error) {
	var df, dt pgtype.Date
	if from != "" {
		t, err := time.Parse("2006-01-02", from)
		if err != nil {
			return df, dt, ErrInvalidInput
		}
		df = pgtype.Date{Time: t, Valid: true}
	}
	if to != "" {
		t, err := time.Parse("2006-01-02", to)
		if err != nil {
			return df, dt, ErrInvalidInput
		}
		dt = pgtype.Date{Time: t, Valid: true}
	}
	return df, dt, nil
}

// textOrNull mapea un string opcional al *string que genera sqlc para una
// columna nullable: vacío (tras trim) → nil (NULL en BD).
func textOrNull(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// deref desreferencia un *string (NULL → "").
func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func isFKViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
