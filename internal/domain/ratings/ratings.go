// Package ratings reimplementa los 5 SPs de ratings + CRUD de calificaciones.
//
// Endpoints:
//   POST   /api/v1/ratings/crew          → add_crew_rating
//   DELETE /api/v1/ratings/crew/:id      → delete_crew_rating
//   POST   /api/v1/ratings/not-crew      → add_not_crew_rating
//   DELETE /api/v1/ratings/not-crew/:id  → delete_not_crew_rating
//   GET    /api/v1/ratings/model         → sp_get_modelRatings
//   GET    /api/v1/ratings/operational   → sp_get_operationalRatings
//   GET    /api/v1/ratings/general-tactical → sp_get_generalTacticalRatings
//   GET    /api/v1/ratings/leadership    → sp_get_leadershipRatings
//   GET    /api/v1/ratings/maintenance   → sp_get_maintenanceRatings
package ratings

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/queries"
)

// ============================================================
// DTOs
// ============================================================

// --- Calificaciones de catálogo ---

type RatingDef struct {
	CrewRatingSk int32  `json:"crew_rating_sk"`
	Name         string `json:"name"`
	Abbreviation string `json:"abbreviation"`
}

type NotCrewRatingDef struct {
	NotCrewRatingSk   int32  `json:"notCrew_rating_sk"`
	NotCrewRatingName string `json:"notCrew_rating_name"`
	NotCrewRatingAbrv string `json:"notCrew_rating_abrv"`
}

// --- Persona base + calificaciones simples (Model/Leadership/Maintenance) ---

type PersonWithQualifications struct {
	PersonSk     int32                    `json:"person_sk"`
	PersonNk     *string                  `json:"person_nk"`
	FullName     string                   `json:"full_name"`
	PersonRol    string                   `json:"person_rol"`
	Calificaciones []SimpleQualification  `json:"calificaciones"`
}

type SimpleQualification struct {
	CrewRatingSk  int32  `json:"crew_rating_sk"`
	CrewRatingsFk int32  `json:"crew_ratings_fk"`
	DateQualified string `json:"date_qualified"`
}

type NotCrewPersonWithQualifications struct {
	PersonSk       int32                       `json:"person_sk"`
	FullName       string                      `json:"full_name"`
	PersonRol      string                      `json:"person_rol"`
	Calificaciones []SimpleNotCrewQualification `json:"calificaciones"`
}

type SimpleNotCrewQualification struct {
	NotCrewRatingsSk int32  `json:"notCrew_ratings_sk"`
	NotCrewRatingFk  int32  `json:"notCrew_rating_fk"`
	DateQualified    string `json:"date_qualified"`
}

// --- ModelRatings ---

type ModelRatingsResult struct {
	CalificacionesModeloPilotos    []RatingDef                  `json:"calificaciones_modelo_pilotos"`
	CalificacionesModeloDotaciones []RatingDef                  `json:"calificaciones_modelo_dotaciones"`
	TodosPilotos                   []PersonWithQualifications   `json:"todos_pilotos"`
	TodasDotaciones                []PersonWithQualifications   `json:"todas_dotaciones"`
}

// --- LeadershipRatings ---

type LeadershipRatingsResult struct {
	CalificacionesMandoYLiderazgoPilotos []RatingDef                `json:"calificaciones_mandoYliderazgo_pilotos"`
	TodosPilotos                         []PersonWithQualifications `json:"todos_pilotos"`
}

// --- MaintenanceRatings ---

type MaintenanceRatingsResult struct {
	CalificacionesMantenimiento []NotCrewRatingDef                `json:"calificaciones_mantenimiento"`
	TodosMantenedores           []NotCrewPersonWithQualifications `json:"todos_mantenedores"`
}

// --- OperationalRatings ---

type OperationalPerson struct {
	PersonSk            int32                  `json:"person_sk"`
	PersonNk            *string                `json:"person_nk"`
	FullName            string                 `json:"full_name"`
	PersonRol           string                 `json:"person_rol"`
	CalificacionOperativa OperationalQualification `json:"calificacion_operativa"`
}

type OperationalQualification struct {
	Abrv               string `json:"abrv"`
	Name               string `json:"name"`
	MessageInstruction string `json:"message_instruction"`
	MessageHours       string `json:"message_hours"`
	MessageCrp         string `json:"message_crp"`
}

type OperationalRatingsResult struct {
	TodosPilotos    []OperationalPerson `json:"todos_pilotos"`
	TodasDotaciones []OperationalPerson `json:"todas_dotaciones"`
}

// --- GeneralTacticalRatings ---

type TacticalQualification struct {
	CrewRatingSk                  int32   `json:"crew_rating_sk"`
	CrewRatingsFk                 int32   `json:"crew_ratings_fk"`
	DateQualified                 string  `json:"date_qualified"`
	State                         string  `json:"state"`
	TotalHorasVfrDiurno365        *float64 `json:"total_horas_VFR_diurno_365,omitempty"`
	TotalHorasVfrNocturno365      *float64 `json:"total_horas_VFR_nocturno_365,omitempty"`
	TotalHorasGvn90               *float64 `json:"total_horas_GVN_90,omitempty"`
	TotalHorasGvn365              *float64 `json:"total_horas_GVN_365,omitempty"`
	TotalHorasIfr365              *float64 `json:"total_horas_IFR_365,omitempty"`
	TotalAppPrecision365          *int32   `json:"total_app_precision_365,omitempty"`
	TotalAppNoPrecision365        *int32   `json:"total_app_no_precision_365,omitempty"`
	TotalTomasDiaBuque182         *int32   `json:"total_tomas_dia_buque_182,omitempty"`
	TotalTomasDiaMono182          *int32   `json:"total_tomas_dia_mono_182,omitempty"`
	TotalTomasDiaMulti182         *int32   `json:"total_tomas_dia_multi_182,omitempty"`
	TotalTomasDiaCarrier182       *int32   `json:"total_tomas_dia_carrier_182,omitempty"`
	TotalTomasNocheConvBuque182   *int32   `json:"total_tomas_nocheConv_buque_182,omitempty"`
	TotalTomasNocheConvMono182    *int32   `json:"total_tomas_nocheConv_mono_182,omitempty"`
	TotalTomasNocheConvMulti182   *int32   `json:"total_tomas_nocheConv_multi_182,omitempty"`
	TotalTomasNocheConvCarrier182 *int32   `json:"total_tomas_nocheConv_carrier_182,omitempty"`
	TotalTomasGvnBuque182         *int32   `json:"total_tomas_GVN_buque_182,omitempty"`
	TotalTomasGvnMono182          *int32   `json:"total_tomas_GVN_mono_182,omitempty"`
	TotalTomasGvnMulti182         *int32   `json:"total_tomas_GVN_multi_182,omitempty"`
	TotalTomasGvnCarrier182       *int32   `json:"total_tomas_GVN_carrier_182,omitempty"`
}

type TacticalPerson struct {
	PersonSk       int32                   `json:"person_sk"`
	PersonNk       *string                 `json:"person_nk"`
	FullName       string                  `json:"full_name"`
	PersonRol      string                  `json:"person_rol"`
	Calificaciones []TacticalQualification `json:"calificaciones"`
}

type GeneralTacticalRatingsResult struct {
	CalificacionesGeneralTacticaSoloPilotos []RatingDef      `json:"calificaciones_generalTactica_soloPilotos"`
	CalificacionesGeneralTacticaCompartida  []RatingDef      `json:"calificaciones_generalTactica_compartida"`
	TodosPilotos                            []TacticalPerson `json:"todos_pilotos"`
	TodasDotaciones                         []TacticalPerson `json:"todas_dotaciones"`
}

// --- CRUD ---

type AddCrewRatingReq struct {
	PersonFk      int32  `json:"person_fk"`
	CrewRatingsFk int32  `json:"crew_ratings_fk"`
	DateQualified string `json:"date_qualified"`
}

type AddNotCrewRatingReq struct {
	PersonFk      int32  `json:"person_fk"`
	CrewRatingsFk int32  `json:"crew_ratings_fk"`
	DateQualified string `json:"date_qualified"`
}

// ============================================================
// Sentinel errors
// ============================================================

var (
	ErrNotFound     = errors.New("ratings: not found")
	ErrDuplicate    = errors.New("ratings: already exists for that person")
	ErrInvalidInput = errors.New("ratings: invalid input")
)

// ============================================================
// Service
// ============================================================

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

// ----- CRUD -----

func (s *Service) AddCrewRating(ctx context.Context, esc int32, req AddCrewRatingReq) (int32, error) {
	if req.PersonFk <= 0 || req.CrewRatingsFk <= 0 {
		return 0, ErrInvalidInput
	}
	date, err := parseOptionalDate(req.DateQualified)
	if err != nil {
		return 0, ErrInvalidInput
	}
	id, err := s.q.AddCrewRating(ctx, queries.AddCrewRatingParams{
		PersonFk:                       req.PersonFk,
		CrewRatingsFk:                  req.CrewRatingsFk,
		DateQualified:                  date,
		CrewQualificationEscuadrillaFk: esc,
	})
	if isUniqueViolation(err) {
		return 0, ErrDuplicate
	}
	return id, err
}

func (s *Service) DeleteCrewRating(ctx context.Context, esc int32, id int32) error {
	n, err := s.q.DeleteCrewRating(ctx, queries.DeleteCrewRatingParams{
		CrewRatingSk:                   id,
		CrewQualificationEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) AddNotCrewRating(ctx context.Context, esc int32, req AddNotCrewRatingReq) (int32, error) {
	if req.PersonFk <= 0 || req.CrewRatingsFk <= 0 {
		return 0, ErrInvalidInput
	}
	// notcrew_qualification.date_qualified es TIMESTAMP (quirk del schema original).
	ts, err := parseOptionalTimestamp(req.DateQualified)
	if err != nil {
		return 0, ErrInvalidInput
	}
	id, err := s.q.AddNotCrewRating(ctx, queries.AddNotCrewRatingParams{
		PersonFk:                          req.PersonFk,
		NotcrewRatingFk:                   req.CrewRatingsFk,
		DateQualified:                     ts,
		NotcrewQualificationEscuadrillaFk: esc,
	})
	if isUniqueViolation(err) {
		return 0, ErrDuplicate
	}
	return id, err
}

func (s *Service) DeleteNotCrewRating(ctx context.Context, esc int32, id int32) error {
	n, err := s.q.DeleteNotCrewRating(ctx, queries.DeleteNotCrewRatingParams{
		NotcrewRatingsSk:                  id,
		NotcrewQualificationEscuadrillaFk: esc,
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ----- Model ratings -----

func (s *Service) Model(ctx context.Context, esc int32) (ModelRatingsResult, error) {
	pilotos, err := s.catalog(ctx, "Modelo", []string{"Piloto"})
	if err != nil {
		return ModelRatingsResult{}, err
	}
	dotaciones, err := s.catalog(ctx, "Modelo", []string{"Dotación", "Dotación/Nadador"})
	if err != nil {
		return ModelRatingsResult{}, err
	}
	pilotosWith, err := s.personsWithCrewQuals(ctx, esc, "Modelo", []string{"Piloto"}, []string{"Piloto"})
	if err != nil {
		return ModelRatingsResult{}, err
	}
	dotacionesWith, err := s.personsWithCrewQuals(ctx, esc, "Modelo",
		[]string{"Dotación", "Dotación/Nadador"},
		[]string{"Dotación", "Dotación/Nadador"})
	if err != nil {
		return ModelRatingsResult{}, err
	}
	return ModelRatingsResult{
		CalificacionesModeloPilotos:    pilotos,
		CalificacionesModeloDotaciones: dotaciones,
		TodosPilotos:                   pilotosWith,
		TodasDotaciones:                dotacionesWith,
	}, nil
}

// ----- Leadership ratings -----

func (s *Service) Leadership(ctx context.Context, esc int32) (LeadershipRatingsResult, error) {
	cat, err := s.catalog(ctx, "Mando y Liderazgo", nil)
	if err != nil {
		return LeadershipRatingsResult{}, err
	}
	// Para liderazgo, el filtro es por type, sin filtro por role en las qualifications.
	personasWith, err := s.personsWithCrewQuals(ctx, esc, "Mando y Liderazgo", nil, []string{"Piloto"})
	if err != nil {
		return LeadershipRatingsResult{}, err
	}
	return LeadershipRatingsResult{
		CalificacionesMandoYLiderazgoPilotos: cat,
		TodosPilotos:                         personasWith,
	}, nil
}

// ----- Maintenance ratings -----

func (s *Service) Maintenance(ctx context.Context, esc int32) (MaintenanceRatingsResult, error) {
	cat, err := s.q.NotCrewRatingsCatalog(ctx)
	if err != nil {
		return MaintenanceRatingsResult{}, err
	}
	persons, err := s.q.PersonsByRoles(ctx, queries.PersonsByRolesParams{
		PersonEscuadrillaFk: esc,
		Column2:             []string{"Dotación", "Dotación/Nadador", "Nadador", "No Tripulante"},
	})
	if err != nil {
		return MaintenanceRatingsResult{}, err
	}
	quals, err := s.q.NotCrewQualificationsByPerson(ctx, esc)
	if err != nil {
		return MaintenanceRatingsResult{}, err
	}
	byPerson := make(map[int32][]SimpleNotCrewQualification)
	for _, q := range quals {
		byPerson[q.PersonFk] = append(byPerson[q.PersonFk], SimpleNotCrewQualification{
			NotCrewRatingsSk: q.NotcrewRatingsSk,
			NotCrewRatingFk:  q.NotcrewRatingFk,
			DateQualified:    q.DateQualified,
		})
	}

	catOut := make([]NotCrewRatingDef, 0, len(cat))
	for _, c := range cat {
		catOut = append(catOut, NotCrewRatingDef{
			NotCrewRatingSk:   c.NotcrewRatingSk,
			NotCrewRatingName: c.NotcrewRatingName,
			NotCrewRatingAbrv: c.NotcrewRatingAbrv,
		})
	}
	personsOut := make([]NotCrewPersonWithQualifications, 0, len(persons))
	for _, p := range persons {
		qs := byPerson[p.PersonSk]
		if qs == nil {
			qs = []SimpleNotCrewQualification{}
		}
		personsOut = append(personsOut, NotCrewPersonWithQualifications{
			PersonSk: p.PersonSk, FullName: p.FullName, PersonRol: p.PersonRol,
			Calificaciones: qs,
		})
	}
	return MaintenanceRatingsResult{
		CalificacionesMantenimiento: catOut,
		TodosMantenedores:           personsOut,
	}, nil
}

// ----- Operational ratings -----

func (s *Service) Operational(ctx context.Context, esc int32) (OperationalRatingsResult, error) {
	rows, err := s.q.OperationalPersonMetrics(ctx, esc)
	if err != nil {
		return OperationalRatingsResult{}, err
	}
	pilotos := make([]OperationalPerson, 0)
	dotaciones := make([]OperationalPerson, 0)
	for _, r := range rows {
		horas := numericToFloat(r.Horas365)
		crp := numericToFloat(r.CrpTotal)
		abrv := operationalAbrv(r.PersonRol, horas, crp, r.H2pReciente, r.DvReciente,
			r.Pi1Piloto, r.Pi2Piloto, r.Pi1Dotacion, r.Pi2Dotacion)
		qual := OperationalQualification{
			Abrv:               abrv,
			Name:               operationalName(abrv),
			MessageInstruction: instructionMessage(r.PersonRol, r.H2pReciente, r.DvReciente, r.Pi1Piloto, r.Pi2Piloto, r.Pi1Dotacion, r.Pi2Dotacion),
			MessageHours:       formatHoursMsg(horas),
			MessageCrp:         formatCrpMsg(crp),
		}
		entry := OperationalPerson{
			PersonSk: r.PersonSk, PersonNk: r.PersonNk,
			FullName: r.FullName, PersonRol: r.PersonRol,
			CalificacionOperativa: qual,
		}
		if r.PersonRol == "Piloto" {
			pilotos = append(pilotos, entry)
		} else {
			dotaciones = append(dotaciones, entry)
		}
	}
	return OperationalRatingsResult{TodosPilotos: pilotos, TodasDotaciones: dotaciones}, nil
}

// ----- General/Tactical ratings -----

func (s *Service) GeneralTactical(ctx context.Context, esc int32) (GeneralTacticalRatingsResult, error) {
	soloPilotos, err := s.catalogTypes(ctx, []string{"General", "Táctica"}, []string{"Piloto"})
	if err != nil {
		return GeneralTacticalRatingsResult{}, err
	}
	compartida, err := s.catalogTypes(ctx, []string{"General", "Táctica"}, []string{"Piloto/Dotación"})
	if err != nil {
		return GeneralTacticalRatingsResult{}, err
	}
	persons, err := s.q.GeneralTacticalPersonMetrics(ctx, esc)
	if err != nil {
		return GeneralTacticalRatingsResult{}, err
	}
	quals, err := s.q.GeneralTacticalQualifications(ctx, esc)
	if err != nil {
		return GeneralTacticalRatingsResult{}, err
	}
	qualsByPerson := make(map[int32][]queries.GeneralTacticalQualificationsRow)
	for _, q := range quals {
		qualsByPerson[q.PersonFk] = append(qualsByPerson[q.PersonFk], q)
	}

	pilotos := make([]TacticalPerson, 0)
	dotaciones := make([]TacticalPerson, 0)
	for _, p := range persons {
		entry := TacticalPerson{
			PersonSk: p.PersonSk, PersonNk: p.PersonNk,
			FullName: p.FullName, PersonRol: p.PersonRol,
			Calificaciones: buildTacticalQuals(p, qualsByPerson[p.PersonSk]),
		}
		if p.PersonRol == "Piloto" {
			pilotos = append(pilotos, entry)
		} else {
			dotaciones = append(dotaciones, entry)
		}
	}
	return GeneralTacticalRatingsResult{
		CalificacionesGeneralTacticaSoloPilotos: soloPilotos,
		CalificacionesGeneralTacticaCompartida:  compartida,
		TodosPilotos:                            pilotos,
		TodasDotaciones:                         dotaciones,
	}, nil
}

// ============================================================
// Helpers internos del service
// ============================================================

func (s *Service) catalog(ctx context.Context, typ string, roles []string) ([]RatingDef, error) {
	rows, err := s.q.RatingsCatalog(ctx, queries.RatingsCatalogParams{
		Column1: typ,
		Column2: roles,
	})
	if err != nil {
		return nil, err
	}
	out := make([]RatingDef, 0, len(rows))
	for _, r := range rows {
		out = append(out, RatingDef{
			CrewRatingSk: r.CrewRatingSk, Name: r.Name, Abbreviation: r.Abbreviation,
		})
	}
	return out, nil
}

// catalogTypes acepta múltiples types (uno por fila) y filtra en Go.
func (s *Service) catalogTypes(ctx context.Context, types, roles []string) ([]RatingDef, error) {
	collected := make([]RatingDef, 0)
	seen := make(map[int32]bool)
	for _, t := range types {
		cs, err := s.catalog(ctx, t, roles)
		if err != nil {
			return nil, err
		}
		for _, c := range cs {
			if !seen[c.CrewRatingSk] {
				collected = append(collected, c)
				seen[c.CrewRatingSk] = true
			}
		}
	}
	return collected, nil
}

func (s *Service) personsWithCrewQuals(
	ctx context.Context, esc int32, qualType string,
	qualRoles []string, personRoles []string,
) ([]PersonWithQualifications, error) {
	persons, err := s.q.PersonsByRoles(ctx, queries.PersonsByRolesParams{
		PersonEscuadrillaFk: esc, Column2: personRoles,
	})
	if err != nil {
		return nil, err
	}
	quals, err := s.q.CrewQualificationsByPersonAndType(ctx, queries.CrewQualificationsByPersonAndTypeParams{
		PersonEscuadrillaFk: esc, Type: qualType, Column3: qualRoles,
	})
	if err != nil {
		return nil, err
	}
	byPerson := make(map[int32][]SimpleQualification)
	for _, q := range quals {
		byPerson[q.PersonFk] = append(byPerson[q.PersonFk], SimpleQualification{
			CrewRatingSk: q.CrewRatingSk, CrewRatingsFk: q.CrewRatingsFk, DateQualified: q.DateQualified,
		})
	}
	out := make([]PersonWithQualifications, 0, len(persons))
	for _, p := range persons {
		qs := byPerson[p.PersonSk]
		if qs == nil {
			qs = []SimpleQualification{}
		}
		out = append(out, PersonWithQualifications{
			PersonSk: p.PersonSk, PersonNk: p.PersonNk,
			FullName: p.FullName, PersonRol: p.PersonRol,
			Calificaciones: qs,
		})
	}
	return out, nil
}

// ============================================================
// Lógica de calificacion_operativa (Piloto/Dotación)
// ============================================================

func operationalAbrv(rol string, horas, crp float64, h2pRec, dvRec, pi1P, pi2P, pi1D, pi2D bool) string {
	switch rol {
	case "Piloto":
		switch {
		case horas >= 140 && crp > 80:
			return "CR"
		case h2pRec:
			return "LCR"
		case pi2P && horas >= 100 && crp >= 40:
			return "LCR"
		case pi1P && horas >= 50:
			return "CA"
		default:
			return "SA"
		}
	case "Dotación", "Dotación/Nadador":
		switch {
		case horas >= 75 && crp > 80:
			return "CR"
		case dvRec:
			return "LCR"
		case pi2D && horas >= 50 && crp >= 40:
			return "LCR"
		case pi1D && horas >= 12:
			return "CA"
		default:
			return "SA"
		}
	}
	return "SA"
}

func operationalName(abrv string) string {
	switch abrv {
	case "SA":
		return "Sin aptitud"
	case "CA":
		return "Con aptitud"
	case "LCR":
		return "Limitado para el combate"
	case "CR":
		return "Preparado para el combate"
	}
	return ""
}

func instructionMessage(rol string, h2pRec, dvRec, pi1P, pi2P, pi1D, pi2D bool) string {
	if rol == "Piloto" {
		switch {
		case h2pRec:
			return "Calificación H2P obtenida hace menos de 365 días."
		case pi2P:
			return "PI2 completado."
		case pi1P:
			return "PI1 completado."
		default:
			return "Sin plan de instrucción completado."
		}
	}
	switch {
	case dvRec:
		return "Calificación DV obtenida hace menos de 365 días."
	case pi2D:
		return "PI2 completado."
	case pi1D:
		return "PI1 completado."
	default:
		return "Sin plan de instrucción completado."
	}
}

func formatHoursMsg(h float64) string {
	return strconv.FormatFloat(h, 'f', -1, 64) + " horas en los últimos 365 días."
}

func formatCrpMsg(c float64) string {
	return "CRP " + strconv.FormatFloat(c, 'f', -1, 64) + "."
}

// ============================================================
// Lógica de estado de calificaciones generales/tácticas
// ============================================================

func buildTacticalQuals(m queries.GeneralTacticalPersonMetricsRow, qs []queries.GeneralTacticalQualificationsRow) []TacticalQualification {
	out := make([]TacticalQualification, 0, len(qs))
	for _, q := range qs {
		state := tacticalState(m, q.CrewRatingsFk)
		tq := TacticalQualification{
			CrewRatingSk:  q.CrewRatingSk,
			CrewRatingsFk: q.CrewRatingsFk,
			DateQualified: q.DateQualified,
			State:         state,
		}
		// Adjuntar métricas específicas por crew_ratings_fk (espeja la lógica del SP).
		switch q.CrewRatingsFk {
		case 12:
			v := numericToFloat(m.VfrDiurno365)
			tq.TotalHorasVfrDiurno365 = &v
		case 13:
			v := numericToFloat(m.VfrNocturno365)
			tq.TotalHorasVfrNocturno365 = &v
		case 14, 17, 18:
			g90 := numericToFloat(m.Gvn90)
			tq.TotalHorasGvn90 = &g90
			g365 := numericToFloat(m.Gvn365)
			tq.TotalHorasGvn365 = &g365
		case 15:
			i365 := numericToFloat(m.Ifr365)
			tq.TotalHorasIfr365 = &i365
			ap := m.AppPrecision365
			tq.TotalAppPrecision365 = &ap
			an := m.AppNoPrecision365
			tq.TotalAppNoPrecision365 = &an
		case 16:
			db := m.DiaBuque
			dm := m.DiaMono
			dt := m.DiaMulti
			dc := m.DiaCarrier
			nb := m.NocheconvBuque
			nm := m.NocheconvMono
			nt := m.NocheconvMulti
			nc := m.NocheconvCarrier
			gb := m.GvnBuque
			gm := m.GvnMono
			gt := m.GvnMulti
			gc := m.GvnCarrier
			tq.TotalTomasDiaBuque182 = &db
			tq.TotalTomasDiaMono182 = &dm
			tq.TotalTomasDiaMulti182 = &dt
			tq.TotalTomasDiaCarrier182 = &dc
			tq.TotalTomasNocheConvBuque182 = &nb
			tq.TotalTomasNocheConvMono182 = &nm
			tq.TotalTomasNocheConvMulti182 = &nt
			tq.TotalTomasNocheConvCarrier182 = &nc
			tq.TotalTomasGvnBuque182 = &gb
			tq.TotalTomasGvnMono182 = &gm
			tq.TotalTomasGvnMulti182 = &gt
			tq.TotalTomasGvnCarrier182 = &gc
		}
		out = append(out, tq)
	}
	return out
}

// tacticalState replica el CASE gigante del SP.
func tacticalState(m queries.GeneralTacticalPersonMetricsRow, fk int32) string {
	d := numericToFloat(m.VfrDiurno365)
	n := numericToFloat(m.VfrNocturno365)
	g365 := numericToFloat(m.Gvn365)
	g90 := numericToFloat(m.Gvn90)
	i := numericToFloat(m.Ifr365)
	ap := m.AppPrecision365
	an := m.AppNoPrecision365

	isPiloto := m.PersonRol == "Piloto"
	isDot := m.PersonRol == "Dotación" || m.PersonRol == "Dotación/Nadador"

	switch fk {
	case 12: // VFR Diurna (Pilotos)
		if !isPiloto {
			return "valid"
		}
		switch {
		case d < 50:
			return "expired"
		case d >= 50 && d < 70:
			return "warning"
		default:
			return "valid"
		}
	case 13: // VFR Nocturna (Pilotos)
		if !isPiloto {
			return "valid"
		}
		switch {
		case n < 10:
			return "expired"
		case n >= 10 && n < 15:
			return "warning"
		default:
			return "valid"
		}
	case 14: // GVN
		if isPiloto {
			switch {
			case g90 < 3 || g365 < 12:
				return "expired"
			case (g90 >= 3 && g90 < 5) || (g365 >= 12 && g365 < 16):
				return "warning"
			default:
				return "valid"
			}
		}
		if isDot {
			switch {
			case g90 >= 7:
				return "valid"
			case g90 >= 2 && g90 < 7:
				return "warning"
			default:
				return "expired"
			}
		}
	case 15: // IFR
		if !isPiloto {
			return "valid"
		}
		switch {
		case i < 10 || (ap+an) < 6:
			return "expired"
		case (i >= 10 && i < 15) || (ap+an >= 6 && ap+an < 8):
			return "warning"
		default:
			return "valid"
		}
	case 16: // Aeronaval (sólo pilotos)
		if !isPiloto {
			return "valid"
		}
		dB := m.DiaBuque
		nB := m.NocheconvBuque
		gB := m.GvnBuque
		switch {
		case dB < 4 || nB < 4 || gB < 4:
			return "expired"
		case (dB >= 4 && dB <= 8) || (nB >= 4 && nB <= 8) || (gB >= 4 && gB <= 8):
			return "warning"
		default:
			return "valid"
		}
	case 17: // Anfibia
		switch {
		case g90 < 6 || g365 < 24:
			return "expired"
		case (g90 >= 6 && g90 < 11) || (g365 >= 24 && g365 < 29):
			return "warning"
		default:
			return "valid"
		}
	case 18: // SAO
		switch {
		case g90 < 9 || g365 < 36:
			return "expired"
		case (g90 >= 9 && g90 < 14) || (g365 >= 36 && g365 < 41):
			return "warning"
		default:
			return "valid"
		}
	}
	return "valid"
}

// ============================================================
// Handlers
// ============================================================

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	g.POST("/ratings/crew", h.AddCrew, mw)
	g.DELETE("/ratings/crew/:id", h.DeleteCrew, mw)
	g.POST("/ratings/not-crew", h.AddNotCrew, mw)
	g.DELETE("/ratings/not-crew/:id", h.DeleteNotCrew, mw)
	g.GET("/ratings/model", h.Model, mw)
	g.GET("/ratings/operational", h.Operational, mw)
	g.GET("/ratings/general-tactical", h.GeneralTactical, mw)
	g.GET("/ratings/leadership", h.Leadership, mw)
	g.GET("/ratings/maintenance", h.Maintenance, mw)
}

func (h *Handlers) AddCrew(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req AddCrewRatingReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	id, err := h.svc.AddCrewRating(c.Request().Context(), esc, req)
	return respondCreated(c, map[string]int32{"id": id}, err)
}

func (h *Handlers) DeleteCrew(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseIDParam(c)
	if herr != nil {
		return herr
	}
	return respondNoContent(c, h.svc.DeleteCrewRating(c.Request().Context(), esc, id))
}

func (h *Handlers) AddNotCrew(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req AddNotCrewRatingReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	id, err := h.svc.AddNotCrewRating(c.Request().Context(), esc, req)
	return respondCreated(c, map[string]int32{"id": id}, err)
}

func (h *Handlers) DeleteNotCrew(c echo.Context) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseIDParam(c)
	if herr != nil {
		return herr
	}
	return respondNoContent(c, h.svc.DeleteNotCrewRating(c.Request().Context(), esc, id))
}

func (h *Handlers) Model(c echo.Context) error           { return getResult(c, h.svc.Model) }
func (h *Handlers) Operational(c echo.Context) error     { return getResult(c, h.svc.Operational) }
func (h *Handlers) GeneralTactical(c echo.Context) error { return getResult(c, h.svc.GeneralTactical) }
func (h *Handlers) Leadership(c echo.Context) error      { return getResult(c, h.svc.Leadership) }
func (h *Handlers) Maintenance(c echo.Context) error     { return getResult(c, h.svc.Maintenance) }

// ============================================================
// Helpers
// ============================================================

func currentEsc(c echo.Context) (int32, bool) {
	u := auth.CurrentUser(c)
	if u == nil {
		return 0, false
	}
	return int32(u.EscuadrillaID), true
}

func parseIDParam(c echo.Context) (int32, error) {
	n, err := strconv.ParseInt(c.Param("id"), 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return int32(n), nil
}

func parseOptionalDate(s string) (pgtype.Date, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return pgtype.Date{}, nil // NULL
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return pgtype.Date{}, err
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func parseOptionalTimestamp(s string) (pgtype.Timestamp, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return pgtype.Timestamp{}, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return pgtype.Timestamp{}, err
	}
	return pgtype.Timestamp{Time: t, Valid: true}, nil
}

func numericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return 0
	}
	return f.Float64
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func respondCreated(c echo.Context, payload any, err error) error {
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrDuplicate):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, payload)
}

func respondNoContent(c echo.Context, err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

func getResult[T any](c echo.Context, fn func(context.Context, int32) (T, error)) error {
	esc, ok := currentEsc(c)
	if !ok {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	res, err := fn(c.Request().Context(), esc)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}
