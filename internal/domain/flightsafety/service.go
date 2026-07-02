package flightsafety

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/queries"
)

const dateLayout = "2006-01-02"

// ===== Sentinel errors para mapearlos a HTTP en handlers =====

var (
	ErrInvalidInput = errors.New("flightsafety: invalid input")
	ErrNotFound     = errors.New("flightsafety: not found")
)

// allPersons es el valor del filtro de persona que pide TODAS las personas en
// las queries *Summary ($2 = 0).
const allPersons int32 = 0

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

// ============================================================
// READS — resúmenes por persona
// ============================================================

// MedicalSummary devuelve el estado del reconocimiento médico por persona de la
// escuadrilla. personFilter = 0 → todas; >0 → solo esa persona.
func (s *Service) MedicalSummary(ctx context.Context, esc, personFilter int32) ([]MedicalSummaryItem, error) {
	rows, err := s.q.MedicalExamSummary(ctx, queries.MedicalExamSummaryParams{
		PersonEscuadrillaFk: esc,
		Column2:             personFilter,
	})
	if err != nil {
		return nil, err
	}
	out := make([]MedicalSummaryItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, MedicalSummaryItem{
			PersonSk:         r.PersonSk,
			PersonNk:         strVal(r.PersonNk),
			PersonRank:       r.PersonRank,
			PersonName:       r.PersonName,
			PersonLastName1:  r.PersonLastName1,
			PersonLastName2:  r.PersonLastName2,
			DoneSk:           r.DoneSk,
			DoneDate:         formatDate(r.DoneDate),
			ExpiryDate:       formatDate(r.ExpiryDate),
			Result:           strVal(r.Result),
			DoneResultFk:     r.DoneResultFk,
			Place:            strVal(r.Place),
			DonePlaceFk:      r.DonePlaceFk,
			Remark:           strVal(r.Remark),
			ScheduledSk:      r.ScheduledSk,
			ScheduledDate:    formatDate(r.ScheduledDate),
			ScheduledPlace:   strVal(r.ScheduledPlace),
			ScheduledPlaceFk: r.ScheduledPlaceFk,
			ScheduledRemark:  strVal(r.ScheduledRemark),
			NextCimaDue:      formatDate(r.NextCimaDue),
		})
	}
	return out, nil
}

// DunkerSummary y HypobaricSummary devuelven el estado por persona de cada
// reconocimiento de resultado booleano.
func (s *Service) DunkerSummary(ctx context.Context, esc, personFilter int32) ([]ExamSummaryItem, error) {
	rows, err := s.q.DunkerSummary(ctx, queries.DunkerSummaryParams{PersonEscuadrillaFk: esc, Column2: personFilter})
	if err != nil {
		return nil, err
	}
	out := make([]ExamSummaryItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, ExamSummaryItem{
			PersonSk:        r.PersonSk,
			PersonNk:        strVal(r.PersonNk),
			PersonRank:      r.PersonRank,
			PersonName:      r.PersonName,
			PersonLastName1: r.PersonLastName1,
			PersonLastName2: r.PersonLastName2,
			DoneSk:          r.DoneSk,
			DoneDate:        formatDate(r.DoneDate),
			ExpiryDate:      formatDate(r.ExpiryDate),
			Result:          r.Result,
			ScheduledSk:     r.ScheduledSk,
			ScheduledDate:   formatDate(r.ScheduledDate),
		})
	}
	return out, nil
}

func (s *Service) HypobaricSummary(ctx context.Context, esc, personFilter int32) ([]ExamSummaryItem, error) {
	rows, err := s.q.HypobaricSummary(ctx, queries.HypobaricSummaryParams{PersonEscuadrillaFk: esc, Column2: personFilter})
	if err != nil {
		return nil, err
	}
	out := make([]ExamSummaryItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, ExamSummaryItem{
			PersonSk:        r.PersonSk,
			PersonNk:        strVal(r.PersonNk),
			PersonRank:      r.PersonRank,
			PersonName:      r.PersonName,
			PersonLastName1: r.PersonLastName1,
			PersonLastName2: r.PersonLastName2,
			DoneSk:          r.DoneSk,
			DoneDate:        formatDate(r.DoneDate),
			ExpiryDate:      formatDate(r.ExpiryDate),
			Result:          r.Result,
			ScheduledSk:     r.ScheduledSk,
			ScheduledDate:   formatDate(r.ScheduledDate),
		})
	}
	return out, nil
}

// Me devuelve los datos propios del tripulante (los 3 reconocimientos) para la
// persona de la sesión, acotado a su escuadrilla.
func (s *Service) Me(ctx context.Context, esc, personID int32) (MeResponse, error) {
	med, err := s.MedicalSummary(ctx, esc, personID)
	if err != nil {
		return MeResponse{}, err
	}
	dun, err := s.DunkerSummary(ctx, esc, personID)
	if err != nil {
		return MeResponse{}, err
	}
	hyp, err := s.HypobaricSummary(ctx, esc, personID)
	if err != nil {
		return MeResponse{}, err
	}
	var res MeResponse
	if len(med) > 0 {
		res.Medical = &med[0]
	}
	if len(dun) > 0 {
		res.Dunker = &dun[0]
	}
	if len(hyp) > 0 {
		res.Hypobaric = &hyp[0]
	}
	return res, nil
}

// ============================================================
// READS — historial por persona
// ============================================================

func (s *Service) MedicalHistory(ctx context.Context, esc, person int32) ([]MedicalHistoryItem, error) {
	rows, err := s.q.MedicalExamHistory(ctx, queries.MedicalExamHistoryParams{PersonEscuadrillaFk: esc, MedicalExamPersonFk: person})
	if err != nil {
		return nil, err
	}
	out := make([]MedicalHistoryItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, MedicalHistoryItem{
			ID:            r.MedicalExamSk,
			Date:          formatDate(r.MedicalExamDate),
			ScheduledDate: formatDate(r.MedicalExamScheduledDate),
			ExpiryDate:    formatDate(r.MedicalExamExpiryDate),
			Result:        strVal(r.Result),
			Place:         strVal(r.Place),
			Remark:        strVal(r.Remark),
		})
	}
	return out, nil
}

func (s *Service) DunkerHistory(ctx context.Context, esc, person int32) ([]ExamHistoryItem, error) {
	rows, err := s.q.DunkerHistory(ctx, queries.DunkerHistoryParams{PersonEscuadrillaFk: esc, DunkerPersonFk: person})
	if err != nil {
		return nil, err
	}
	out := make([]ExamHistoryItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, ExamHistoryItem{
			ID:            r.DunkerSk,
			Date:          formatDate(r.DunkerDate),
			ScheduledDate: formatDate(r.DunkerScheduledDate),
			ExpiryDate:    formatDate(r.DunkerExpiryDate),
			Result:        r.DunkerResult,
		})
	}
	return out, nil
}

func (s *Service) HypobaricHistory(ctx context.Context, esc, person int32) ([]ExamHistoryItem, error) {
	rows, err := s.q.HypobaricHistory(ctx, queries.HypobaricHistoryParams{PersonEscuadrillaFk: esc, HypobaricPersonFk: person})
	if err != nil {
		return nil, err
	}
	out := make([]ExamHistoryItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, ExamHistoryItem{
			ID:            r.HypobaricSk,
			Date:          formatDate(r.HypobaricDate),
			ScheduledDate: formatDate(r.HypobaricScheduledDate),
			ExpiryDate:    formatDate(r.HypobaricExpiryDate),
			Result:        r.HypobaricResult,
		})
	}
	return out, nil
}

// ============================================================
// WRITES — médico
// ============================================================

func (s *Service) InsertMedical(ctx context.Context, esc int32, p MedicalPayload) (InsertResult, error) {
	if p.PersonSk <= 0 {
		return InsertResult{}, fmt.Errorf("%w: falta la persona", ErrInvalidInput)
	}
	date, scheduled, expiry, err := s.parseMedical(p)
	if err != nil {
		return InsertResult{}, err
	}
	if err := requireSchedule(date); err != nil {
		return InsertResult{}, err
	}
	// No permitir programar una segunda cita si ya hay una abierta.
	if isSchedule(date, scheduled) {
		n, cerr := s.q.CountOpenMedicalSchedule(ctx, queries.CountOpenMedicalScheduleParams{PersonEscuadrillaFk: esc, MedicalExamPersonFk: p.PersonSk})
		if cerr != nil {
			return InsertResult{}, cerr
		}
		if n > 0 {
			return InsertResult{}, fmt.Errorf("%w: esta persona ya tiene un reconocimiento médico programado", ErrInvalidInput)
		}
	}
	sk, err := s.q.InsertMedicalExam(ctx, queries.InsertMedicalExamParams{
		MedicalExamDate:          date,
		MedicalExamPersonFk:      p.PersonSk,
		MedicalExamPlaceFk:       p.PlaceFk,
		MedicalExamResultFk:      p.ResultFk,
		MedicalExamRemark:        strPtr(p.Remark),
		MedicalExamScheduledDate: scheduled,
		MedicalExamExpiryDate:    expiry,
		PersonEscuadrillaFk:      esc,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return InsertResult{}, fmt.Errorf("%w: la persona no pertenece a tu escuadrilla", ErrInvalidInput)
	}
	if err != nil {
		return InsertResult{}, err
	}
	return InsertResult{ID: sk, Success: true, Message: "Reconocimiento médico registrado con éxito."}, nil
}

func (s *Service) UpdateMedical(ctx context.Context, esc, id int32, p MedicalPayload) error {
	date, scheduled, expiry, err := s.parseMedical(p)
	if err != nil {
		return err
	}
	n, err := s.q.UpdateMedicalExam(ctx, queries.UpdateMedicalExamParams{
		MedicalExamSk:            id,
		MedicalExamDate:          date,
		MedicalExamPlaceFk:       p.PlaceFk,
		MedicalExamResultFk:      p.ResultFk,
		MedicalExamRemark:        strPtr(p.Remark),
		MedicalExamScheduledDate: scheduled,
		MedicalExamExpiryDate:    expiry,
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

func (s *Service) DeleteMedical(ctx context.Context, esc, id int32) error {
	n, err := s.q.DeleteMedicalExam(ctx, queries.DeleteMedicalExamParams{MedicalExamSk: id, PersonEscuadrillaFk: esc})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ============================================================
// WRITES — dunker
// ============================================================

func (s *Service) InsertDunker(ctx context.Context, esc int32, p ExamPayload) (InsertResult, error) {
	if p.PersonSk <= 0 {
		return InsertResult{}, fmt.Errorf("%w: falta la persona", ErrInvalidInput)
	}
	date, scheduled, expiry, err := s.parseExam(p)
	if err != nil {
		return InsertResult{}, err
	}
	if err := requireSchedule(date); err != nil {
		return InsertResult{}, err
	}
	if isSchedule(date, scheduled) {
		n, cerr := s.q.CountOpenDunkerSchedule(ctx, queries.CountOpenDunkerScheduleParams{PersonEscuadrillaFk: esc, DunkerPersonFk: p.PersonSk})
		if cerr != nil {
			return InsertResult{}, cerr
		}
		if n > 0 {
			return InsertResult{}, fmt.Errorf("%w: esta persona ya tiene un dunker programado", ErrInvalidInput)
		}
	}
	sk, err := s.q.InsertDunker(ctx, queries.InsertDunkerParams{
		DunkerDate:          date,
		DunkerPersonFk:      p.PersonSk,
		DunkerResult:        p.Result,
		DunkerScheduledDate: scheduled,
		DunkerExpiryDate:    expiry,
		PersonEscuadrillaFk: esc,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return InsertResult{}, fmt.Errorf("%w: la persona no pertenece a tu escuadrilla", ErrInvalidInput)
	}
	if err != nil {
		return InsertResult{}, err
	}
	return InsertResult{ID: sk, Success: true, Message: "Dunker registrado con éxito."}, nil
}

func (s *Service) UpdateDunker(ctx context.Context, esc, id int32, p ExamPayload) error {
	date, scheduled, expiry, err := s.parseExam(p)
	if err != nil {
		return err
	}
	n, err := s.q.UpdateDunker(ctx, queries.UpdateDunkerParams{
		DunkerSk:            id,
		DunkerDate:          date,
		DunkerResult:        p.Result,
		DunkerScheduledDate: scheduled,
		DunkerExpiryDate:    expiry,
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

func (s *Service) DeleteDunker(ctx context.Context, esc, id int32) error {
	n, err := s.q.DeleteDunker(ctx, queries.DeleteDunkerParams{DunkerSk: id, PersonEscuadrillaFk: esc})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ============================================================
// WRITES — hipobárica
// ============================================================

func (s *Service) InsertHypobaric(ctx context.Context, esc int32, p ExamPayload) (InsertResult, error) {
	if p.PersonSk <= 0 {
		return InsertResult{}, fmt.Errorf("%w: falta la persona", ErrInvalidInput)
	}
	date, scheduled, expiry, err := s.parseExam(p)
	if err != nil {
		return InsertResult{}, err
	}
	if err := requireSchedule(date); err != nil {
		return InsertResult{}, err
	}
	if isSchedule(date, scheduled) {
		n, cerr := s.q.CountOpenHypobaricSchedule(ctx, queries.CountOpenHypobaricScheduleParams{PersonEscuadrillaFk: esc, HypobaricPersonFk: p.PersonSk})
		if cerr != nil {
			return InsertResult{}, cerr
		}
		if n > 0 {
			return InsertResult{}, fmt.Errorf("%w: esta persona ya tiene una hipobárica programada", ErrInvalidInput)
		}
	}
	sk, err := s.q.InsertHypobaric(ctx, queries.InsertHypobaricParams{
		HypobaricDate:          date,
		HypobaricPersonFk:      p.PersonSk,
		HypobaricResult:        p.Result,
		HypobaricScheduledDate: scheduled,
		HypobaricExpiryDate:    expiry,
		PersonEscuadrillaFk:    esc,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return InsertResult{}, fmt.Errorf("%w: la persona no pertenece a tu escuadrilla", ErrInvalidInput)
	}
	if err != nil {
		return InsertResult{}, err
	}
	return InsertResult{ID: sk, Success: true, Message: "Hipobárica registrada con éxito."}, nil
}

func (s *Service) UpdateHypobaric(ctx context.Context, esc, id int32, p ExamPayload) error {
	date, scheduled, expiry, err := s.parseExam(p)
	if err != nil {
		return err
	}
	n, err := s.q.UpdateHypobaric(ctx, queries.UpdateHypobaricParams{
		HypobaricSk:            id,
		HypobaricDate:          date,
		HypobaricResult:        p.Result,
		HypobaricScheduledDate: scheduled,
		HypobaricExpiryDate:    expiry,
		PersonEscuadrillaFk:    esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) DeleteHypobaric(ctx context.Context, esc, id int32) error {
	n, err := s.q.DeleteHypobaric(ctx, queries.DeleteHypobaricParams{HypobaricSk: id, PersonEscuadrillaFk: esc})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ============================================================
// Validación / helpers
// ============================================================

// parseMedical valida y convierte las fechas de un payload médico. Reglas:
// debe haber al menos fecha o cita; un reconocimiento realizado (con fecha)
// exige caducidad, lugar y resultado.
func (s *Service) parseMedical(p MedicalPayload) (date, scheduled, expiry pgtype.Date, err error) {
	if date, err = parseDateOpt(p.Date); err != nil {
		return
	}
	if scheduled, err = parseDateOpt(p.ScheduledDate); err != nil {
		return
	}
	if expiry, err = parseDateOpt(p.ExpiryDate); err != nil {
		return
	}
	if !date.Valid && !scheduled.Valid {
		err = fmt.Errorf("%w: indica una fecha de realización o una cita programada", ErrInvalidInput)
		return
	}
	if date.Valid {
		if !expiry.Valid {
			err = fmt.Errorf("%w: falta la fecha de caducidad", ErrInvalidInput)
			return
		}
		if p.PlaceFk == nil || *p.PlaceFk <= 0 || p.ResultFk == nil || *p.ResultFk <= 0 {
			err = fmt.Errorf("%w: un reconocimiento realizado requiere lugar y resultado", ErrInvalidInput)
			return
		}
	}
	return
}

// parseExam valida/convierte las fechas de un payload de dunker/hiperbárica.
func (s *Service) parseExam(p ExamPayload) (date, scheduled, expiry pgtype.Date, err error) {
	if date, err = parseDateOpt(p.Date); err != nil {
		return
	}
	if scheduled, err = parseDateOpt(p.ScheduledDate); err != nil {
		return
	}
	if expiry, err = parseDateOpt(p.ExpiryDate); err != nil {
		return
	}
	if !date.Valid && !scheduled.Valid {
		err = fmt.Errorf("%w: indica una fecha de realización o una cita programada", ErrInvalidInput)
		return
	}
	if date.Valid && !expiry.Valid {
		err = fmt.Errorf("%w: falta la fecha de caducidad", ErrInvalidInput)
		return
	}
	return
}

// isSchedule indica que el alta es una cita PROGRAMADA (solo fecha futura, sin
// realización): es el caso en que no se permite duplicar si ya hay una abierta.
func isSchedule(date, scheduled pgtype.Date) bool {
	return scheduled.Valid && !date.Valid
}

// requireSchedule rechaza un alta que traiga fecha de realización: todo
// reconocimiento nace PROGRAMADO y pasa a REALIZADO al registrar su resultado
// (vía Update*, no vía alta).
func requireSchedule(date pgtype.Date) error {
	if date.Valid {
		return fmt.Errorf("%w: un alta debe ser una cita programada (sin fecha de realización)", ErrInvalidInput)
	}
	return nil
}

// parseDateOpt convierte "" en fecha NULL y una fecha "YYYY-MM-DD" en pgtype.Date.
func parseDateOpt(s string) (pgtype.Date, error) {
	if s == "" {
		return pgtype.Date{Valid: false}, nil
	}
	t, err := time.Parse(dateLayout, s)
	if err != nil {
		return pgtype.Date{}, fmt.Errorf("%w: fecha inválida (%q)", ErrInvalidInput, s)
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func formatDate(d pgtype.Date) string {
	if !d.Valid {
		return ""
	}
	return d.Time.Format(dateLayout)
}

func strVal(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
