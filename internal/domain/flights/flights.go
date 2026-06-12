// Package flights implementa db_insert_flight, db_delete_flight y
// sp_get_flights_with_flexible_crew.
//
// El insert es transaccional: vuelo + ~12 tablas hijas (person_hour,
// ift_hour, gvntype_hour, instructor_hour, formation_hour, wt_hour,
// approach, landing, projectile, papeleta_crew_count, cupo_hour,
// passenger). Antes de tocar cualquier fila se setean los GUCs
//   aether.user_id, aether.ip_address
// para que el trigger tr_audit_flight (Hito 1) registre quién hizo qué.
//
// El listado bulk-fetcha cada tabla hija para todos los flights de la
// página en una sola query, agrupa por (flight, person) en Go y
// compone el JSON anidado espejo del SP original.
package flights

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/queries"
)

// ============================================================
// SK constants — mapeo legacy de los seeds.
// ============================================================

const (
	periodDay   = 1
	periodNight = 2
	periodGvn   = 3

	appPrecision   = 1
	appNoPrecision = 2
	appTd          = 3
	appSp          = 4

	landingTierra = 1
	landingMono   = 2
	landingMulti  = 3
	landingCarrier = 4

	projectileM3M   = 1
	projectileMag58 = 2
)

// ============================================================
// DTOs entrada — espejo del FlightFormData Rust (camelCase mixto).
// ============================================================

type FlightFormData struct {
	General   GeneralData   `json:"general"`
	Pilots    []PilotData   `json:"pilots"`
	Dvs       []DvData      `json:"dvs"`
	Papeletas []PapeletaData `json:"papeletas"`
	Cupos     []CupoData    `json:"cupos"`
	Pasajeros []PasajeroData `json:"pasajeros"`
}

type GeneralData struct {
	Date           string `json:"date"`              // YYYY-MM-DD
	DeparturePlace int32  `json:"departurePlace"`
	DepartureTime  string `json:"departureTime"`     // HH:MM
	ArrivalPlace   int32  `json:"arrivalPlace"`
	ArrivalTime    string `json:"arrivalTime"`
	Aircraft       int32  `json:"aircraft"`
	Event          int32  `json:"event"`
	TotalHours     string `json:"totalHours"`        // float as string
}

type PilotData struct {
	Name           int32         `json:"name"`            // person_sk
	PersonHour     PersonHours   `json:"person_hour"`
	IftHour        string        `json:"ift_hour"`
	GvnTypeHour    GvnTypeHours  `json:"gvnType_hour"`
	InstructorHour string        `json:"instructor_hour"`
	FormationHour  FormationHours `json:"formation_hour"`
	App            Approaches    `json:"app"`
	Landing        LandingData   `json:"landing"`
}

type DvData struct {
	Name       int32          `json:"name"`
	PersonHour PersonHours    `json:"person_hour"`
	WtHour     string         `json:"wt_hour"`
	Projectile ProjectileData `json:"projectile"`
}

type PersonHours struct {
	HDay   string `json:"hDay"`
	HNight string `json:"hNight"`
	HGvn   string `json:"hGvn"`
}

type GvnTypeHours struct {
	HIit   string `json:"hIit"`
	HAnvis string `json:"hAnvis"`
}

type FormationHours struct {
	HfDay string `json:"hfDay"`
	HfGvn string `json:"hfGvn"`
}

type Approaches struct {
	Precision   string `json:"precision"`
	NoPrecision string `json:"noPrecision"`
	Td          string `json:"td"`
	Sp          string `json:"sp"`
}

type LandingData struct {
	Tierra  LandingTypeData `json:"tierra"`
	Mono    LandingTypeData `json:"mono"`
	Multi   LandingTypeData `json:"multi"`
	Carrier LandingTypeData `json:"carrier"`
}

type LandingTypeData struct {
	LDay   string `json:"lDay"`
	LNight string `json:"lNight"`
	LGvn   string `json:"lGvn"`
}

type ProjectileData struct {
	M3M   string `json:"m3m"`
	Mag58 string `json:"mag58"`
}

type PapeletaData struct {
	Crew     []int32        `json:"crew"`
	Papeleta []PapeletaItem `json:"papeleta"`
}

type PapeletaItem struct {
	Sk     int32 `json:"sk"`
	Period int32 `json:"period"`
}

type CupoData struct {
	Autoridad int32  `json:"autoridad"`
	Horas     string `json:"horas"`
}

type PasajeroData struct {
	Tipo     int32  `json:"tipo"`
	Cantidad string `json:"cantidad"`
	Ruta     string `json:"ruta"`
}

// ============================================================
// DTOs salida — listing en formato del SP.
// ============================================================

type InsertResult struct {
	FlightID int32  `json:"flight_id"`
	Success  bool   `json:"success"`
	Message  string `json:"message"`
}

type ListQueryParams struct {
	Limit    int32
	Offset   int32
	FlightSk int32
	DateFrom string
	DateTo   string
}

type ListResult struct {
	Items      []FlightItem `json:"items"`
	TotalCount int32        `json:"total_count"`
}

type FlightItem struct {
	ID          int32         `json:"id"`
	Fecha       string        `json:"fecha"`       // YYYY-MM-DD
	Hora        string        `json:"hora"`        // HH:MM
	Helicoptero string        `json:"helicoptero"`
	Evento      string        `json:"evento"`
	CteAeronave string        `json:"cteAeronave"`
	Horas       float64       `json:"horas"`
	Detalles    FlightDetails `json:"detalles"`
}

type FlightDetails struct {
	Tripulacion    Tripulacion  `json:"tripulacion"`
	CuposAutoridad []CupoJSON   `json:"cuposAutoridad"`
	Pasajeros      []PasajeroJSON `json:"pasajeros"`
}

type Tripulacion struct {
	Pilotos    []PilotoJSON    `json:"pilotos"`
	Dotaciones []DotacionJSON  `json:"dotaciones"`
}

type PilotoJSON struct {
	Nombre              string         `json:"nombre"`
	Nk                  string         `json:"nk"`
	Orden               int64          `json:"orden"`
	HoraVueloPiloto     HVPilotoJSON   `json:"horaVueloPiloto"`
	Tomas               TomasJSON      `json:"tomas"`
	AproximacionesInstr ApsInstrJSON   `json:"aproximacionesInstr"`
	AproximacionesSar   ApsSarJSON     `json:"aproximacionesSar"`
	Papeletas           []PapeletaJSON `json:"papeletas"`
}

type HVPilotoJSON struct {
	Dia          float64    `json:"dia"`
	Noche        float64    `json:"noche"`
	Gvn          GvnSubJSON `json:"gvn"`
	Instrumentos float64    `json:"instrumentos"`
	Instructor   float64    `json:"instructor"`
	FormacionDia float64    `json:"formacionDia"`
	FormacionGvn float64    `json:"formacionGvn"`
}

type GvnSubJSON struct {
	Total float64 `json:"total"`
	Iit   float64 `json:"iit"`
	Anvis float64 `json:"anvis"`
}

type TomasJSON struct {
	Dia       LandingPlacesJSON `json:"dia"`
	NocheConv LandingPlacesJSON `json:"nocheConv"`
	Gvn       LandingPlacesJSON `json:"gvn"`
}

type LandingPlacesJSON struct {
	Tierra    int32 `json:"tierra"`
	Monospot  int32 `json:"monospot"`
	Multispot int32 `json:"multispot"`
	Carrier   int32 `json:"carrier"`
}

type ApsInstrJSON struct {
	Precision   int32 `json:"precision"`
	NoPrecision int32 `json:"noPrecision"`
}

type ApsSarJSON struct {
	Td int32 `json:"td"`
	Sp int32 `json:"sp"`
}

type PapeletaJSON struct {
	Nombre      string `json:"nombre"`
	Descripcion string `json:"descripcion"`
	Periodo     int32  `json:"periodo"`
}

type DotacionJSON struct {
	Nombre           string         `json:"nombre"`
	Nk               string         `json:"nk"`
	Orden            int64          `json:"orden"`
	HoraVueloDotacion HVDotacionJSON `json:"horaVueloDotacion"`
	Proyectiles      ProyectilesJSON `json:"proyectiles"`
	Papeletas        []PapeletaJSON `json:"papeletas"`
}

type HVDotacionJSON struct {
	Dia       float64 `json:"dia"`
	Noche     float64 `json:"noche"`
	Gvn       float64 `json:"gvn"`
	WinchTrim float64 `json:"winchTrim"`
}

type ProyectilesJSON struct {
	M3M   int32 `json:"m3m"`
	Mag58 int32 `json:"mag58"`
}

type CupoJSON struct {
	Autoridad string  `json:"autoridad"`
	Horas     float64 `json:"horas"`
}

type PasajeroJSON struct {
	Tipo     string `json:"tipo"`
	Cantidad int32  `json:"cantidad"`
	Ruta     string `json:"ruta"`
}

// ============================================================
// Sentinel errors
// ============================================================

var (
	ErrNotFound     = errors.New("flights: not found")
	ErrInvalidInput = errors.New("flights: invalid input")
)

// ============================================================
// Service
// ============================================================

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

// ===== INSERT =====

func (s *Service) Insert(ctx context.Context, esc int32, userID, ip string, data FlightFormData) (InsertResult, error) {
	flightDate, err := time.Parse("2006-01-02", data.General.Date)
	if err != nil {
		return InsertResult{}, fmt.Errorf("%w: date: %v", ErrInvalidInput, err)
	}
	depTime, err := time.Parse("15:04", data.General.DepartureTime)
	if err != nil {
		return InsertResult{}, fmt.Errorf("%w: departureTime: %v", ErrInvalidInput, err)
	}
	arrTime, err := time.Parse("15:04", data.General.ArrivalTime)
	if err != nil {
		return InsertResult{}, fmt.Errorf("%w: arrivalTime: %v", ErrInvalidInput, err)
	}
	if len(data.Pilots) == 0 {
		return InsertResult{}, fmt.Errorf("%w: al menos un piloto requerido como comandante", ErrInvalidInput)
	}
	totalHours, err := strconv.ParseFloat(data.General.TotalHours, 64)
	if err != nil {
		return InsertResult{}, fmt.Errorf("%w: totalHours: %v", ErrInvalidInput, err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return InsertResult{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Auditoría: el trigger tr_audit_flight lee estos GUCs.
	if err := setAuditGUCs(ctx, tx, userID, ip); err != nil {
		return InsertResult{}, err
	}

	q := queries.New(tx)

	flightSk, err := q.InsertFlight(ctx, queries.InsertFlightParams{
		FlightDate:           pgtype.Date{Time: flightDate, Valid: true},
		FlightDeparturePlace: data.General.DeparturePlace,
		FlightDepartureTime:  pgtype.Time{Microseconds: timeToMicros(depTime), Valid: true},
		FlightArrivalPlace:   data.General.ArrivalPlace,
		FlightArrivalTime:    pgtype.Time{Microseconds: timeToMicros(arrTime), Valid: true},
		FlightAircraftFk:     data.General.Aircraft,
		FlightEventFk:        data.General.Event,
		FlightPersonCtaFk:    data.Pilots[0].Name,
		FlightEscuadrillaFk:  esc,
		FlightTotalHours:     numericFromFloat(totalHours),
	})
	if err != nil {
		return InsertResult{}, fmt.Errorf("insert flight: %w", err)
	}

	for _, pilot := range data.Pilots {
		if err := insertPilot(ctx, q, flightSk, pilot); err != nil {
			return InsertResult{}, err
		}
	}
	for _, dv := range data.Dvs {
		if err := insertDv(ctx, q, flightSk, dv); err != nil {
			return InsertResult{}, err
		}
	}
	for _, pap := range data.Papeletas {
		for _, personSk := range pap.Crew {
			for _, item := range pap.Papeleta {
				if err := q.InsertPapeletaCrewCount(ctx, queries.InsertPapeletaCrewCountParams{
					PapeletaCrewCountFlightFk:  flightSk,
					PapeletaCrewCountPersonFk:  personSk,
					PapeletaCrewCountSessionFk: item.Sk,
					PapeletaCrewCountPeriodFk:  item.Period,
				}); err != nil {
					return InsertResult{}, fmt.Errorf("papeleta_crew_count: %w", err)
				}
			}
		}
	}
	for _, cupo := range data.Cupos {
		hours, ok := parseFloatNonZero(cupo.Horas)
		if !ok {
			continue
		}
		if err := q.InsertCupoHour(ctx, queries.InsertCupoHourParams{
			CupoFlightFk:    flightSk,
			CupoAuthorityFk: cupo.Autoridad,
			CupoHourQty:     numericFromFloat(hours),
		}); err != nil {
			return InsertResult{}, fmt.Errorf("cupo_hour: %w", err)
		}
	}
	for _, pax := range data.Pasajeros {
		qty, ok := parseIntNonZero(pax.Cantidad)
		if !ok {
			continue
		}
		if err := q.InsertPassenger(ctx, queries.InsertPassengerParams{
			PassengerFlightFk: flightSk,
			PassengerTypeFk:   pax.Tipo,
			PassengerQty:      qty,
			PassengerRoute:    pax.Ruta,
		}); err != nil {
			return InsertResult{}, fmt.Errorf("passenger: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return InsertResult{}, err
	}

	return InsertResult{
		FlightID: flightSk, Success: true,
		Message: fmt.Sprintf("Vuelo insertado exitosamente con ID: %d", flightSk),
	}, nil
}

func insertPilot(ctx context.Context, q *queries.Queries, flightSk int32, pilot PilotData) error {
	person := pilot.Name

	// Horas por periodo
	periods := []struct {
		periodFk int32
		raw      string
	}{
		{periodDay, pilot.PersonHour.HDay},
		{periodNight, pilot.PersonHour.HNight},
		{periodGvn, pilot.PersonHour.HGvn},
	}
	for _, p := range periods {
		if h, ok := parseFloatNonZero(p.raw); ok {
			if err := q.InsertPersonHour(ctx, queries.InsertPersonHourParams{
				PersonHourFlightFk: flightSk, PersonHourPersonFk: person,
				PersonHourPeriodFk: p.periodFk, PersonHourHourQty: numericFromFloat(h),
			}); err != nil {
				return fmt.Errorf("person_hour periodo %d: %w", p.periodFk, err)
			}
		}
	}

	// GVN type (IIT + ANVIS)
	iit, _ := parseFloat(pilot.GvnTypeHour.HIit)
	anvis, _ := parseFloat(pilot.GvnTypeHour.HAnvis)
	if iit > 0 || anvis > 0 {
		if err := q.InsertGvntypeHour(ctx, queries.InsertGvntypeHourParams{
			GvntypeHourFlightFk: flightSk, GvntypeHourPersonFk: person,
			GvntypeHourIitQty:   numericPtrFromFloat(iit),
			GvntypeHourAnvisQty: numericPtrFromFloat(anvis),
		}); err != nil {
			return fmt.Errorf("gvntype_hour: %w", err)
		}
	}

	// IFT
	if h, ok := parseFloatNonZero(pilot.IftHour); ok {
		if err := q.InsertIftHour(ctx, queries.InsertIftHourParams{
			IftHourFlightFk: flightSk, IftHourPersonFk: person,
			IftHourQty: numericFromFloat(h),
		}); err != nil {
			return fmt.Errorf("ift_hour: %w", err)
		}
	}

	// Instructor
	if h, ok := parseFloatNonZero(pilot.InstructorHour); ok {
		if err := q.InsertInstructorHour(ctx, queries.InsertInstructorHourParams{
			InstructorHourFlightFk: flightSk, InstructorHourPersonFk: person,
			InstructorHourQty: numericFromFloat(h),
		}); err != nil {
			return fmt.Errorf("instructor_hour: %w", err)
		}
	}

	// Formación (día + gvn)
	formations := []struct {
		periodFk int32
		raw      string
	}{
		{periodDay, pilot.FormationHour.HfDay},
		{periodGvn, pilot.FormationHour.HfGvn},
	}
	for _, f := range formations {
		if h, ok := parseFloatNonZero(f.raw); ok {
			if err := q.InsertFormationHour(ctx, queries.InsertFormationHourParams{
				FormationHourFlightFk: flightSk, FormationHourPersonFk: person,
				FormationHourPeriodFk:       f.periodFk,
				FormationHourFormationQty:   numericPtrFromFloat(h),
			}); err != nil {
				return fmt.Errorf("formation_hour periodo %d: %w", f.periodFk, err)
			}
		}
	}

	// Aproximaciones (4 tipos)
	apps := []struct {
		typeFk int32
		raw    string
	}{
		{appPrecision, pilot.App.Precision},
		{appNoPrecision, pilot.App.NoPrecision},
		{appTd, pilot.App.Td},
		{appSp, pilot.App.Sp},
	}
	for _, a := range apps {
		if qty, ok := parseIntNonZero(a.raw); ok {
			if err := q.InsertApproach(ctx, queries.InsertApproachParams{
				AppFlightFk: flightSk, AppPersonFk: person,
				AppTypeFk: a.typeFk, AppQty: qty,
			}); err != nil {
				return fmt.Errorf("approach tipo %d: %w", a.typeFk, err)
			}
		}
	}

	// Aterrizajes (4 lugares × 3 periodos)
	landings := []struct {
		placeFk int32
		data    LandingTypeData
	}{
		{landingTierra, pilot.Landing.Tierra},
		{landingMono, pilot.Landing.Mono},
		{landingMulti, pilot.Landing.Multi},
		{landingCarrier, pilot.Landing.Carrier},
	}
	for _, l := range landings {
		periods := []struct {
			periodFk int32
			raw      string
		}{
			{periodDay, l.data.LDay},
			{periodNight, l.data.LNight},
			{periodGvn, l.data.LGvn},
		}
		for _, p := range periods {
			if qty, ok := parseIntNonZero(p.raw); ok {
				if err := q.InsertLanding(ctx, queries.InsertLandingParams{
					LandingFlightFk: flightSk, LandingPersonFk: person,
					LandingPlaceFk: l.placeFk, LandingPeriodFk: p.periodFk, LandingQty: qty,
				}); err != nil {
					return fmt.Errorf("landing lugar %d periodo %d: %w", l.placeFk, p.periodFk, err)
				}
			}
		}
	}
	return nil
}

func insertDv(ctx context.Context, q *queries.Queries, flightSk int32, dv DvData) error {
	person := dv.Name

	periods := []struct {
		periodFk int32
		raw      string
	}{
		{periodDay, dv.PersonHour.HDay},
		{periodNight, dv.PersonHour.HNight},
		{periodGvn, dv.PersonHour.HGvn},
	}
	for _, p := range periods {
		if h, ok := parseFloatNonZero(p.raw); ok {
			if err := q.InsertPersonHour(ctx, queries.InsertPersonHourParams{
				PersonHourFlightFk: flightSk, PersonHourPersonFk: person,
				PersonHourPeriodFk: p.periodFk, PersonHourHourQty: numericFromFloat(h),
			}); err != nil {
				return fmt.Errorf("dv person_hour periodo %d: %w", p.periodFk, err)
			}
		}
	}

	if h, ok := parseFloatNonZero(dv.WtHour); ok {
		if err := q.InsertWtHour(ctx, queries.InsertWtHourParams{
			WtHourFlightFk: flightSk, WtHourPersonFk: person,
			WtHourQty: numericFromFloat(h),
		}); err != nil {
			return fmt.Errorf("wt_hour: %w", err)
		}
	}

	projs := []struct {
		typeFk int32
		raw    string
	}{
		{projectileM3M, dv.Projectile.M3M},
		{projectileMag58, dv.Projectile.Mag58},
	}
	for _, p := range projs {
		if qty, ok := parseIntNonZero(p.raw); ok {
			if err := q.InsertProjectile(ctx, queries.InsertProjectileParams{
				ProjectileFlightFk: flightSk, ProjectilePersonFk: person,
				ProjectileTypeFk: p.typeFk, ProjectileQty: qty,
			}); err != nil {
				return fmt.Errorf("projectile tipo %d: %w", p.typeFk, err)
			}
		}
	}
	return nil
}

// ===== DELETE =====

func (s *Service) Delete(ctx context.Context, esc int32, userID, ip string, flightSk int32) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if err := setAuditGUCs(ctx, tx, userID, ip); err != nil {
		return err
	}
	q := queries.New(tx)
	n, err := q.DeleteFlight(ctx, queries.DeleteFlightParams{
		FlightSk: flightSk, FlightEscuadrillaFk: esc,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return fmt.Errorf("flights: referenced by other records")
		}
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

// ===== LIST =====

func (s *Service) List(ctx context.Context, esc int32, p ListQueryParams) (ListResult, error) {
	df, dt, err := parseOptionalDates(p.DateFrom, p.DateTo)
	if err != nil {
		return ListResult{}, err
	}
	if p.Limit <= 0 {
		p.Limit = 10
	}

	q := queries.New(s.pool)
	rows, err := q.ListFlights(ctx, queries.ListFlightsParams{
		FlightEscuadrillaFk: esc,
		Column2:             p.FlightSk,
		Column3:             df,
		Column4:             dt,
		Limit:               p.Limit,
		Offset:              p.Offset,
	})
	if err != nil {
		return ListResult{}, err
	}
	total, err := q.CountFlights(ctx, queries.CountFlightsParams{
		FlightEscuadrillaFk: esc,
		Column2:             p.FlightSk,
		Column3:             df,
		Column4:             dt,
	})
	if err != nil {
		return ListResult{}, err
	}
	if len(rows) == 0 {
		return ListResult{Items: []FlightItem{}, TotalCount: total}, nil
	}

	flightSks := make([]int32, 0, len(rows))
	for _, r := range rows {
		flightSks = append(flightSks, r.FlightSk)
	}

	// Bulk fetch de todas las dimensiones.
	crew, err := q.FlightCrew(ctx, flightSks)
	if err != nil {
		return ListResult{}, err
	}
	pHours, _ := q.FlightPersonHours(ctx, flightSks)
	gvn, _ := q.FlightGvntypeHours(ctx, flightSks)
	ift, _ := q.FlightIftHours(ctx, flightSks)
	instr, _ := q.FlightInstructorHours(ctx, flightSks)
	formation, _ := q.FlightFormationHours(ctx, flightSks)
	apps, _ := q.FlightApproaches(ctx, flightSks)
	landings, _ := q.FlightLandings(ctx, flightSks)
	wt, _ := q.FlightWtHours(ctx, flightSks)
	proj, _ := q.FlightProjectiles(ctx, flightSks)
	paps, _ := q.FlightPapeletas(ctx, flightSks)
	cupos, _ := q.FlightCupos(ctx, flightSks)
	pax, _ := q.FlightPassengers(ctx, flightSks)

	// Indexar por (flight, person).
	type fp struct{ f, p int32 }
	personHours := map[fp]map[int32]float64{}
	for _, r := range pHours {
		key := fp{r.FlightSk, r.PersonSk}
		if personHours[key] == nil {
			personHours[key] = map[int32]float64{}
		}
		personHours[key][r.PeriodFk] = numericToFloat(r.Qty)
	}
	gvnByFP := map[fp]struct{ iit, anvis float64 }{}
	for _, r := range gvn {
		gvnByFP[fp{r.FlightSk, r.PersonSk}] = struct{ iit, anvis float64 }{numericToFloat(r.Iit), numericToFloat(r.Anvis)}
	}
	iftByFP := map[fp]float64{}
	for _, r := range ift {
		iftByFP[fp{r.FlightSk, r.PersonSk}] = numericToFloat(r.Qty)
	}
	instrByFP := map[fp]float64{}
	for _, r := range instr {
		instrByFP[fp{r.FlightSk, r.PersonSk}] = numericToFloat(r.Qty)
	}
	formationByFPP := map[fp]map[int32]float64{}
	for _, r := range formation {
		key := fp{r.FlightSk, r.PersonSk}
		if formationByFPP[key] == nil {
			formationByFPP[key] = map[int32]float64{}
		}
		formationByFPP[key][r.PeriodFk] = numericToFloat(r.Qty)
	}
	appsByFP := map[fp]map[int32]int32{}
	for _, r := range apps {
		key := fp{r.FlightSk, r.PersonSk}
		if appsByFP[key] == nil {
			appsByFP[key] = map[int32]int32{}
		}
		appsByFP[key][r.TypeFk] = r.Qty
	}
	landingsByFP := map[fp]map[pp]int32{}
	for _, r := range landings {
		key := fp{r.FlightSk, r.PersonSk}
		if landingsByFP[key] == nil {
			landingsByFP[key] = map[pp]int32{}
		}
		landingsByFP[key][pp{r.PlaceFk, r.PeriodFk}] = r.Qty
	}
	wtByFP := map[fp]float64{}
	for _, r := range wt {
		wtByFP[fp{r.FlightSk, r.PersonSk}] = numericToFloat(r.Qty)
	}
	projByFP := map[fp]map[int32]int32{}
	for _, r := range proj {
		key := fp{r.FlightSk, r.PersonSk}
		if projByFP[key] == nil {
			projByFP[key] = map[int32]int32{}
		}
		projByFP[key][r.TypeFk] = r.Qty
	}
	papsByFP := map[fp][]PapeletaJSON{}
	for _, r := range paps {
		key := fp{r.FlightSk, r.PersonSk}
		papsByFP[key] = append(papsByFP[key], PapeletaJSON{
			Nombre: r.Nombre, Descripcion: r.Descripcion, Periodo: r.Periodo,
		})
	}
	cuposByFlight := map[int32][]CupoJSON{}
	for _, r := range cupos {
		cuposByFlight[r.FlightSk] = append(cuposByFlight[r.FlightSk], CupoJSON{
			Autoridad: r.Autoridad, Horas: numericToFloat(r.Horas),
		})
	}
	paxByFlight := map[int32][]PasajeroJSON{}
	for _, r := range pax {
		paxByFlight[r.FlightSk] = append(paxByFlight[r.FlightSk], PasajeroJSON{
			Tipo: r.Tipo, Cantidad: r.Cantidad, Ruta: r.Ruta,
		})
	}
	crewByFlight := map[int32][]queries.FlightCrewRow{}
	for _, c := range crew {
		crewByFlight[c.FlightSk] = append(crewByFlight[c.FlightSk], c)
	}

	items := make([]FlightItem, 0, len(rows))
	for _, r := range rows {
		// Pilotos vs dotaciones
		var pilotos []PilotoJSON
		var dotaciones []DotacionJSON
		for _, c := range crewByFlight[r.FlightSk] {
			key := fp{r.FlightSk, c.PersonSk}
			nk := ""
			if c.PersonNk != nil {
				nk = *c.PersonNk
			}
			if c.PersonRol == "Piloto" {
				ph := personHours[key]
				gh := gvnByFP[key]
				ap := appsByFP[key]
				fm := formationByFPP[key]
				gvnTotal := ph[periodGvn]
				pilotos = append(pilotos, PilotoJSON{
					Nombre: c.Nombre, Nk: nk, Orden: c.OrderPosition,
					HoraVueloPiloto: HVPilotoJSON{
						Dia: ph[periodDay], Noche: ph[periodNight],
						Gvn: GvnSubJSON{Total: gvnTotal, Iit: gh.iit, Anvis: gh.anvis},
						Instrumentos: iftByFP[key], Instructor: instrByFP[key],
						FormacionDia: fm[periodDay], FormacionGvn: fm[periodGvn],
					},
					Tomas:               buildTomas(landingsByFP[key]),
					AproximacionesInstr: ApsInstrJSON{Precision: ap[appPrecision], NoPrecision: ap[appNoPrecision]},
					AproximacionesSar:   ApsSarJSON{Td: ap[appTd], Sp: ap[appSp]},
					Papeletas:           orEmptyPap(papsByFP[key]),
				})
			} else {
				ph := personHours[key]
				pr := projByFP[key]
				dotaciones = append(dotaciones, DotacionJSON{
					Nombre: c.Nombre, Nk: nk, Orden: c.OrderPosition,
					HoraVueloDotacion: HVDotacionJSON{
						Dia: ph[periodDay], Noche: ph[periodNight],
						Gvn: ph[periodGvn], WinchTrim: wtByFP[key],
					},
					Proyectiles: ProyectilesJSON{M3M: pr[projectileM3M], Mag58: pr[projectileMag58]},
					Papeletas:   orEmptyPap(papsByFP[key]),
				})
			}
		}

		ctaName := strings.TrimSpace(r.CtaRank + " " + r.CtaLastname1 + " " + r.CtaLastname2)
		evento := strings.TrimSpace(r.EventName + " - " + r.EventPlace)
		items = append(items, FlightItem{
			ID:          r.FlightSk,
			Fecha:       r.FlightDate.Time.Format("2006-01-02"),
			Hora:        microsToHHMM(r.FlightDepartureTime.Microseconds),
			Helicoptero: r.AircraftNumber,
			Evento:      evento,
			CteAeronave: ctaName,
			Horas:       numericToFloat(r.FlightTotalHours),
			Detalles: FlightDetails{
				Tripulacion: Tripulacion{
					Pilotos:    orEmptyPilotos(pilotos),
					Dotaciones: orEmptyDotaciones(dotaciones),
				},
				CuposAutoridad: orEmptyCupos(cuposByFlight[r.FlightSk]),
				Pasajeros:      orEmptyPasajeros(paxByFlight[r.FlightSk]),
			},
		})
	}
	return ListResult{Items: items, TotalCount: total}, nil
}

func buildTomas(m map[pp]int32) TomasJSON {
	get := func(place, period int32) int32 { return m[pp{place, period}] }
	return TomasJSON{
		Dia: LandingPlacesJSON{
			Tierra: get(landingTierra, periodDay), Monospot: get(landingMono, periodDay),
			Multispot: get(landingMulti, periodDay), Carrier: get(landingCarrier, periodDay),
		},
		NocheConv: LandingPlacesJSON{
			Tierra: get(landingTierra, periodNight), Monospot: get(landingMono, periodNight),
			Multispot: get(landingMulti, periodNight), Carrier: get(landingCarrier, periodNight),
		},
		Gvn: LandingPlacesJSON{
			Tierra: get(landingTierra, periodGvn), Monospot: get(landingMono, periodGvn),
			Multispot: get(landingMulti, periodGvn), Carrier: get(landingCarrier, periodGvn),
		},
	}
}

// pp es la clave (landing_place_fk, landing_period_fk).
type pp = struct{ place, period int32 }

// ============================================================
// Handlers
// ============================================================

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	g.GET("/flights", h.List, mw)
	g.POST("/flights", h.Insert, mw)
	g.DELETE("/flights/:id", h.Delete, mw)
}

func (h *Handlers) Insert(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var data FlightFormData
	if err := c.Bind(&data); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	res, err := h.svc.Insert(c.Request().Context(), int32(u.EscuadrillaID), u.Username, c.RealIP(), data)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, res)
}

func (h *Handlers) Delete(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseIDParam(c)
	if herr != nil {
		return herr
	}
	err := h.svc.Delete(c.Request().Context(), int32(u.EscuadrillaID), u.Username, c.RealIP(), id)
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handlers) List(c echo.Context) error {
	u := auth.CurrentUser(c)
	if u == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	p := ListQueryParams{
		DateFrom: c.QueryParam("date_from"),
		DateTo:   c.QueryParam("date_to"),
	}
	if n, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
		p.Limit = int32(n)
	}
	if n, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
		p.Offset = int32(n)
	}
	if n, err := strconv.Atoi(c.QueryParam("flight_sk")); err == nil {
		p.FlightSk = int32(n)
	}
	res, err := h.svc.List(c.Request().Context(), int32(u.EscuadrillaID), p)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}

// ============================================================
// Helpers
// ============================================================

func parseIDParam(c echo.Context) (int32, error) {
	n, err := strconv.ParseInt(c.Param("id"), 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return int32(n), nil
}

// setAuditGUCs setea aether.user_id y aether.ip_address LOCAL en la transacción
// para que tr_audit_flight registre quién hizo qué.
func setAuditGUCs(ctx context.Context, tx pgx.Tx, userID, ip string) error {
	if _, err := tx.Exec(ctx, "SELECT set_config('aether.user_id', $1, true)", userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "SELECT set_config('aether.ip_address', $1, true)", ip); err != nil {
		return err
	}
	return nil
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

func parseFloat(s string) (float64, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return f, true
}

func parseFloatNonZero(s string) (float64, bool) {
	f, ok := parseFloat(s)
	return f, ok && f > 0
}

func parseIntNonZero(s string) (int32, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	n, err := strconv.ParseInt(s, 10, 32)
	if err != nil || n <= 0 {
		return 0, false
	}
	return int32(n), true
}

func numericFromFloat(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	_ = n.Scan(strconv.FormatFloat(f, 'f', -1, 64))
	return n
}

func numericPtrFromFloat(f float64) pgtype.Numeric {
	if f == 0 {
		return pgtype.Numeric{} // NULL
	}
	return numericFromFloat(f)
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

func timeToMicros(t time.Time) int64 {
	return int64(t.Hour())*3600*1_000_000 + int64(t.Minute())*60*1_000_000 + int64(t.Second())*1_000_000
}

func microsToHHMM(us int64) string {
	secs := us / 1_000_000
	h := secs / 3600
	m := (secs % 3600) / 60
	return fmt.Sprintf("%02d:%02d", h, m)
}

func orEmptyPap(s []PapeletaJSON) []PapeletaJSON {
	if s == nil {
		return []PapeletaJSON{}
	}
	return s
}

func orEmptyPilotos(s []PilotoJSON) []PilotoJSON {
	if s == nil {
		return []PilotoJSON{}
	}
	return s
}

func orEmptyDotaciones(s []DotacionJSON) []DotacionJSON {
	if s == nil {
		return []DotacionJSON{}
	}
	return s
}

func orEmptyCupos(s []CupoJSON) []CupoJSON {
	if s == nil {
		return []CupoJSON{}
	}
	return s
}

func orEmptyPasajeros(s []PasajeroJSON) []PasajeroJSON {
	if s == nil {
		return []PasajeroJSON{}
	}
	return s
}
