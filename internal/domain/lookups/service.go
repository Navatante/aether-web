package lookups

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/queries"
)

// ============================================================================
// Service
// ============================================================================

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: queries.New(pool)}
}

// ===== Sentinel errors para mapearlos a HTTP en handlers =====

var (
	ErrNotFound     = errors.New("lookups: not found")
	ErrUniqueCode   = errors.New("lookups: code already exists")
	ErrUniqueName   = errors.New("lookups: name already exists")
	ErrInUse        = errors.New("lookups: referenced by other records")
	ErrInvalidInput = errors.New("lookups: invalid input")
	ErrUnknownName  = errors.New("lookups: unknown lookup name")
	// Mensaje en claro: se muestra tal cual en el toast del frontend.
	ErrCapbaAlreadyAssigned = errors.New("La capacidad básica ya está asignada a la escuadrilla")
)

// ============================================================================
// READS — devuelven slices listos para JSON
// ============================================================================

func (s *Service) Aircrafts(ctx context.Context, esc int32) ([]Aircraft, error) {
	rows, err := s.q.LookupAircrafts(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]Aircraft, 0, len(rows))
	for _, r := range rows {
		out = append(out, Aircraft{AircraftSk: r.AircraftSk, AircraftNumber: r.AircraftNumber})
	}
	return out, nil
}

func (s *Service) AircraftsManage(ctx context.Context, esc int32) ([]AircraftManage, error) {
	rows, err := s.q.LookupAircraftsManage(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]AircraftManage, 0, len(rows))
	for _, r := range rows {
		out = append(out, AircraftManage{
			AircraftSk: r.AircraftSk, AircraftRegistration: r.AircraftRegistration,
			AircraftNumber: r.AircraftNumber, AircraftCurrentFlag: r.AircraftCurrentFlag,
			AircraftType: r.AircraftType, AircraftMake: r.AircraftMake,
			AircraftModel: r.AircraftModel, AircraftVariant: r.AircraftVariant,
			AircraftIsMultiEngine: r.AircraftIsMultiEngine, AircraftIsMultiPilot: r.AircraftIsMultiPilot,
		})
	}
	return out, nil
}

func (s *Service) DepartureArrivalPlaces(ctx context.Context) ([]DepartureArrivalPlace, error) {
	rows, err := s.q.LookupDepartureArrivalPlaces(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]DepartureArrivalPlace, 0, len(rows))
	for _, r := range rows {
		out = append(out, DepartureArrivalPlace{
			DepartureArrivalPlaceSk:   r.DepartureArrivalPlaceSk,
			DepartureArrivalPlaceCode: r.DepartureArrivalPlaceCode,
			DepartureArrivalPlaceName: r.DepartureArrivalPlaceName,
		})
	}
	return out, nil
}

func (s *Service) EventsManage(ctx context.Context) ([]EventManage, error) {
	rows, err := s.q.LookupEventsManage(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]EventManage, 0, len(rows))
	for _, r := range rows {
		out = append(out, EventManage{EventSk: r.EventSk, EventName: r.EventName, EventPlace: r.EventPlace})
	}
	return out, nil
}

func (s *Service) Events(ctx context.Context) ([]Event, error) {
	rows, err := s.q.LookupEvents(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Event, 0, len(rows))
	for _, r := range rows {
		out = append(out, Event{EventSk: r.EventSk, Event: r.EventLabel})
	}
	return out, nil
}

func (s *Service) Authorities(ctx context.Context) ([]Authority, error) {
	rows, err := s.q.LookupAuthorities(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Authority, 0, len(rows))
	for _, r := range rows {
		out = append(out, Authority{AuthoritySk: r.AuthoritySk, AuthorityName: r.AuthorityName})
	}
	return out, nil
}

func (s *Service) Capbas(ctx context.Context, esc int32) ([]Capba, error) {
	rows, err := s.q.LookupCapbas(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]Capba, 0, len(rows))
	for _, r := range rows {
		out = append(out, Capba{CapbaID: r.CapbaID, CapbaName: r.CapbaName})
	}
	return out, nil
}

func (s *Service) CapbaCatalog(ctx context.Context) ([]CapbaCatalogItem, error) {
	rows, err := s.q.LookupCapbaCatalog(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]CapbaCatalogItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, CapbaCatalogItem{CapbaID: r.CapbaID, CapbaName: r.CapbaName, CapbaGroupName: r.CapbaGroupName})
	}
	return out, nil
}

func (s *Service) EscuadrillaCapbas(ctx context.Context, esc int32) ([]EscuadrillaCapba, error) {
	rows, err := s.q.LookupEscuadrillaCapbas(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]EscuadrillaCapba, 0, len(rows))
	for _, r := range rows {
		out = append(out, EscuadrillaCapba{
			EscuadrillaCapbaSk: r.EscuadrillaCapbaSk, CapbaID: r.CapbaID,
			CapbaName: r.CapbaName, CapbaGroupName: r.CapbaGroupName,
			CapacidadOperativa: r.EscuadrillaCapbaCapacidadOperativa,
		})
	}
	return out, nil
}

func (s *Service) Pilots(ctx context.Context, esc int32) ([]Crew, error) {
	rows, err := s.q.LookupPilots(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]Crew, 0, len(rows))
	for _, r := range rows {
		out = append(out, Crew{PersonSk: r.PersonSk, PersonNk: derefStr(r.PersonNk)})
	}
	return out, nil
}

func (s *Service) Crew(ctx context.Context, esc int32) ([]Crew, error) {
	rows, err := s.q.LookupCrew(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]Crew, 0, len(rows))
	for _, r := range rows {
		out = append(out, Crew{PersonSk: r.PersonSk, PersonNk: derefStr(r.PersonNk)})
	}
	return out, nil
}

func (s *Service) Papeletas(ctx context.Context, esc int32) ([]Papeleta, error) {
	rows, err := s.q.LookupPapeletas(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]Papeleta, 0, len(rows))
	for _, r := range rows {
		out = append(out, Papeleta{PapeletaSk: r.PapeletaSk, PapeletaName: r.PapeletaName})
	}
	return out, nil
}

func (s *Service) PersonsNk(ctx context.Context, esc int32) ([]Crew, error) {
	rows, err := s.q.LookupPersonsNk(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]Crew, 0, len(rows))
	for _, r := range rows {
		out = append(out, Crew{PersonSk: r.PersonSk, PersonNk: derefStr(r.PersonNk)})
	}
	return out, nil
}

func (s *Service) GroundSchoolPapeletas(ctx context.Context, esc int32) ([]Papeleta, error) {
	rows, err := s.q.LookupGroundSchoolPapeletas(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]Papeleta, 0, len(rows))
	for _, r := range rows {
		out = append(out, Papeleta{PapeletaSk: r.PapeletaSk, PapeletaName: r.PapeletaName})
	}
	return out, nil
}

func (s *Service) PassengerTypes(ctx context.Context) ([]PassengerType, error) {
	rows, err := s.q.LookupPassengerTypes(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]PassengerType, 0, len(rows))
	for _, r := range rows {
		out = append(out, PassengerType{PassengerTypeSk: r.PassengerTypeSk, PassengerTypeName: r.PassengerTypeName})
	}
	return out, nil
}

func (s *Service) ComisionTypes(ctx context.Context) ([]ComisionType, error) {
	rows, err := s.q.LookupComisionTypes(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ComisionType, 0, len(rows))
	for _, r := range rows {
		out = append(out, ComisionType{ComisionTypeSk: r.ComisionTypeSk, Name: r.Name, Origin: r.Origin})
	}
	return out, nil
}

func (s *Service) ComisionLugares(ctx context.Context) ([]ComisionLugar, error) {
	rows, err := s.q.LookupComisionLugares(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ComisionLugar, 0, len(rows))
	for _, r := range rows {
		out = append(out, ComisionLugar{ComisionLugarSk: r.ComisionLugarSk, ComisionName: r.ComisionName})
	}
	return out, nil
}

func (s *Service) RecentComisiones(ctx context.Context, esc int32) ([]RecentComision, error) {
	rows, err := s.q.LookupRecentComisiones(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]RecentComision, 0, len(rows))
	for _, r := range rows {
		esfuerzo := r.Esfuerzo
		out = append(out, RecentComision{
			ComisionSk:  r.ComisionSk,
			Lugar:       r.Lugar,
			Tipo:        r.Tipo,
			FechaInicio: strPtr(r.FechaInicio),
			FechaFin:    strPtr(r.FechaFin),
			Esfuerzo:    &esfuerzo,
		})
	}
	return out, nil
}

func (s *Service) PersonsForComision(ctx context.Context, esc int32) ([]PersonForComision, error) {
	rows, err := s.q.LookupPersonsForComision(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]PersonForComision, 0, len(rows))
	for _, r := range rows {
		out = append(out, PersonForComision{
			PersonSk:        r.PersonSk,
			PersonRank:      &r.PersonRank,
			PersonName:      r.PersonName,
			PersonLastName1: r.PersonLastName1,
			PersonLastName2: &r.PersonLastName2,
		})
	}
	return out, nil
}

func (s *Service) Persons(ctx context.Context, esc int32) ([]Person, error) {
	rows, err := s.q.LookupPersons(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]Person, 0, len(rows))
	for _, r := range rows {
		out = append(out, Person{PersonSk: r.PersonSk, FullName: r.FullName})
	}
	return out, nil
}

// Lookups planos (Vec<String>)
func (s *Service) EventNames(ctx context.Context) ([]string, error) {
	return s.q.LookupEventNames(ctx)
}
func (s *Service) PapeletaBloques(ctx context.Context) ([]string, error) {
	return s.q.LookupPapeletaBloques(ctx)
}
func (s *Service) PapeletaPlanes(ctx context.Context) ([]string, error) {
	return s.q.LookupPapeletaPlanes(ctx)
}
func (s *Service) PersonEspecialidades(ctx context.Context) ([]string, error) {
	return s.q.LookupPersonEspecialidades(ctx)
}
func (s *Service) PersonEmpleos(ctx context.Context) ([]string, error) {
	return s.q.LookupPersonEmpleos(ctx)
}
func (s *Service) PersonDivisiones(ctx context.Context) ([]string, error) {
	return s.q.LookupPersonDivisiones(ctx)
}
func (s *Service) PersonRoles(ctx context.Context) ([]string, error) {
	return s.q.LookupPersonRoles(ctx)
}

// ============================================================================
// MUTATIONS
// ============================================================================

func (s *Service) AddDepartureArrivalPlace(ctx context.Context, req AddDepartureArrivalPlaceReq) error {
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	name := strings.TrimSpace(req.Name)
	if code == "" || name == "" {
		return ErrInvalidInput
	}
	err := s.q.AddDepartureArrivalPlace(ctx, queries.AddDepartureArrivalPlaceParams{
		DepartureArrivalPlaceCode: code, DepartureArrivalPlaceName: name,
	})
	return mapUniqueErr(err, "departure_arrival_place_code", "departure_arrival_place_name")
}

func (s *Service) DeleteDepartureArrivalPlace(ctx context.Context, id int32) error {
	n, err := s.q.DeleteDepartureArrivalPlace(ctx, id)
	if err != nil {
		return mapFKErr(err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) AddAircraft(ctx context.Context, esc int32, req AddAircraftReq) error {
	req.Registration = strings.ToUpper(strings.TrimSpace(req.Registration))
	req.Number = strings.TrimSpace(req.Number)
	req.AircraftType = strings.TrimSpace(req.AircraftType)
	req.Make = strings.TrimSpace(req.Make)
	req.Model = strings.TrimSpace(req.Model)
	req.Variant = strings.TrimSpace(req.Variant)
	if req.Registration == "" || req.Number == "" || req.AircraftType == "" {
		return ErrInvalidInput
	}
	err := s.q.AddAircraft(ctx, queries.AddAircraftParams{
		AircraftType: req.AircraftType, AircraftMake: req.Make,
		AircraftModel: req.Model, AircraftVariant: req.Variant,
		AircraftRegistration: req.Registration, AircraftNumber: req.Number,
		AircraftIsMultiEngine: req.IsMultiEngine, AircraftIsMultiPilot: req.IsMultiPilot,
		AircraftEscuadrillaFk: esc,
	})
	return mapUniqueErr(err, "aircraft_registration")
}

func (s *Service) DeleteAircraft(ctx context.Context, esc int32, id int32) error {
	n, err := s.q.DeleteAircraft(ctx, queries.DeleteAircraftParams{
		AircraftSk: id, AircraftEscuadrillaFk: esc,
	})
	if err != nil {
		return mapFKErr(err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) UpdateAircraftCurrentFlag(ctx context.Context, esc int32, id int32, flag bool) (bool, error) {
	persisted, err := s.q.UpdateAircraftCurrentFlag(ctx, queries.UpdateAircraftCurrentFlagParams{
		AircraftCurrentFlag: flag, AircraftSk: id, AircraftEscuadrillaFk: esc,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, ErrNotFound
	}
	if err != nil {
		return false, err
	}
	return persisted, nil
}

func (s *Service) AddEscuadrillaCapba(ctx context.Context, esc int32, req AddEscuadrillaCapbaReq) error {
	if req.CapbaID <= 0 || req.CapacidadOperativa < 0 {
		return ErrInvalidInput
	}
	err := s.q.AddEscuadrillaCapba(ctx, queries.AddEscuadrillaCapbaParams{
		EscuadrillaCapbaEscuadrillaFk:      esc,
		EscuadrillaCapbaCapbaFk:            req.CapbaID,
		EscuadrillaCapbaCapacidadOperativa: req.CapacidadOperativa,
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation: ya asignada a la escuadrilla
			return ErrCapbaAlreadyAssigned
		case "23503": // foreign_key_violation: capba_id inexistente en el catálogo
			return ErrInvalidInput
		}
	}
	return err
}

func (s *Service) UpdateEscuadrillaCapba(ctx context.Context, esc int32, id int32, req UpdateEscuadrillaCapbaReq) error {
	if req.CapacidadOperativa < 0 {
		return ErrInvalidInput
	}
	n, err := s.q.UpdateEscuadrillaCapba(ctx, queries.UpdateEscuadrillaCapbaParams{
		EscuadrillaCapbaCapacidadOperativa: req.CapacidadOperativa,
		EscuadrillaCapbaSk:                 id,
		EscuadrillaCapbaEscuadrillaFk:      esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) DeleteEscuadrillaCapba(ctx context.Context, esc int32, id int32) error {
	n, err := s.q.DeleteEscuadrillaCapba(ctx, queries.DeleteEscuadrillaCapbaParams{
		EscuadrillaCapbaSk: id, EscuadrillaCapbaEscuadrillaFk: esc,
	})
	if err != nil {
		return mapFKErr(err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ============================================================================
// Helpers
// ============================================================================

// mapUniqueErr convierte un pgx UNIQUE violation en ErrUniqueCode/Name según el constraint que mencione.
func mapUniqueErr(err error, codeConstraint string, nameConstraints ...string) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return err
	}
	if pgErr.Code != "23505" { // unique_violation
		return err
	}
	if strings.Contains(pgErr.ConstraintName, codeConstraint) || strings.Contains(pgErr.Detail, codeConstraint) {
		return ErrUniqueCode
	}
	for _, n := range nameConstraints {
		if strings.Contains(pgErr.ConstraintName, n) || strings.Contains(pgErr.Detail, n) {
			return ErrUniqueName
		}
	}
	return ErrUniqueName
}

func mapFKErr(err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" { // foreign_key_violation
		return ErrInUse
	}
	return err
}

func derefStr(p *string) string {
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
