// Package flights implementa db_insert_flight, db_delete_flight y
// sp_get_flights_with_flexible_crew.
//
// El insert es transaccional: vuelo + ~12 tablas hijas (person_hour,
// ift_hour, gvntype_hour, instructor_hour, formation_hour, wt_hour,
// approach, landing, projectile, papeleta_crew_count, cupo_hour,
// passenger). Antes de tocar cualquier fila se setean los GUCs
//
//	aether.user_id, aether.ip_address
//
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
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/httpx"
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

	landingTierra  = 1
	landingMono    = 2
	landingMulti   = 3
	landingCarrier = 4

	projectileM3M   = 1
	projectileMag58 = 2
)

// defaultListLimit se aplica cuando el cliente no pide tamaño de página; el
// techo lo pone httpx.ClampLimit.
const defaultListLimit = 10

// fp es la clave (flight_sk, person_sk) para indexar las filas hijas por
// vuelo y persona.
type fp struct{ f, p int32 }

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
		hours, ok, err := parseOptionalFloat(cupo.Horas)
		if err != nil {
			return InsertResult{}, fmt.Errorf("%w (cupo)", err)
		}
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
	for _, capba := range data.Capbas {
		hours, ok, err := parseOptionalFloat(capba.Horas)
		if err != nil {
			return InsertResult{}, fmt.Errorf("%w (capba)", err)
		}
		if !ok {
			continue
		}
		if err := q.InsertCapbaHour(ctx, queries.InsertCapbaHourParams{
			CapbaFlightFk: flightSk,
			CapbaCapbaFk:  capba.Capba,
			CapbaHourQty:  numericFromFloat(hours),
		}); err != nil {
			return InsertResult{}, fmt.Errorf("capba_hour: %w", err)
		}
	}
	for _, pax := range data.Pasajeros {
		qty, ok, err := parseOptionalInt(pax.Cantidad)
		if err != nil {
			return InsertResult{}, fmt.Errorf("%w (pasajeros)", err)
		}
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
		h, ok, err := parseOptionalFloat(p.raw)
		if err != nil {
			return fmt.Errorf("%w (person_hour periodo %d)", err, p.periodFk)
		}
		if ok {
			if err := q.InsertPersonHour(ctx, queries.InsertPersonHourParams{
				PersonHourFlightFk: flightSk, PersonHourPersonFk: person,
				PersonHourPeriodFk: p.periodFk, PersonHourHourQty: numericFromFloat(h),
			}); err != nil {
				return fmt.Errorf("person_hour periodo %d: %w", p.periodFk, err)
			}
		}
	}

	// GVN type (IIT + ANVIS)
	iit, _, err := parseOptionalFloat(pilot.GvnTypeHour.HIit)
	if err != nil {
		return fmt.Errorf("%w (gvntype iit)", err)
	}
	anvis, _, err := parseOptionalFloat(pilot.GvnTypeHour.HAnvis)
	if err != nil {
		return fmt.Errorf("%w (gvntype anvis)", err)
	}
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
	if h, ok, err := parseOptionalFloat(pilot.IftHour); err != nil {
		return fmt.Errorf("%w (ift)", err)
	} else if ok {
		if err := q.InsertIftHour(ctx, queries.InsertIftHourParams{
			IftHourFlightFk: flightSk, IftHourPersonFk: person,
			IftHourQty: numericFromFloat(h),
		}); err != nil {
			return fmt.Errorf("ift_hour: %w", err)
		}
	}

	// Instructor
	if h, ok, err := parseOptionalFloat(pilot.InstructorHour); err != nil {
		return fmt.Errorf("%w (instructor)", err)
	} else if ok {
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
		h, ok, err := parseOptionalFloat(f.raw)
		if err != nil {
			return fmt.Errorf("%w (formation_hour periodo %d)", err, f.periodFk)
		}
		if ok {
			if err := q.InsertFormationHour(ctx, queries.InsertFormationHourParams{
				FormationHourFlightFk: flightSk, FormationHourPersonFk: person,
				FormationHourPeriodFk:     f.periodFk,
				FormationHourFormationQty: numericPtrFromFloat(h),
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
		qty, ok, err := parseOptionalInt(a.raw)
		if err != nil {
			return fmt.Errorf("%w (approach tipo %d)", err, a.typeFk)
		}
		if ok {
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
			qty, ok, err := parseOptionalInt(p.raw)
			if err != nil {
				return fmt.Errorf("%w (landing lugar %d periodo %d)", err, l.placeFk, p.periodFk)
			}
			if ok {
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
		h, ok, err := parseOptionalFloat(p.raw)
		if err != nil {
			return fmt.Errorf("%w (dv person_hour periodo %d)", err, p.periodFk)
		}
		if ok {
			if err := q.InsertPersonHour(ctx, queries.InsertPersonHourParams{
				PersonHourFlightFk: flightSk, PersonHourPersonFk: person,
				PersonHourPeriodFk: p.periodFk, PersonHourHourQty: numericFromFloat(h),
			}); err != nil {
				return fmt.Errorf("dv person_hour periodo %d: %w", p.periodFk, err)
			}
		}
	}

	if h, ok, err := parseOptionalFloat(dv.WtHour); err != nil {
		return fmt.Errorf("%w (wt)", err)
	} else if ok {
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
		qty, ok, err := parseOptionalInt(p.raw)
		if err != nil {
			return fmt.Errorf("%w (projectile tipo %d)", err, p.typeFk)
		}
		if ok {
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
	p.Limit = httpx.ClampLimit(p.Limit, defaultListLimit)

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

	children, err := fetchChildren(ctx, q, flightSks)
	if err != nil {
		return ListResult{}, err
	}
	idx := indexChildren(children)
	return ListResult{Items: assembleItems(rows, idx), TotalCount: total}, nil
}

// ===== LIST helpers: fetch → index → assemble =====

// flightChildren agrupa las filas hijas crudas de todos los vuelos de la
// página: una slice por tabla, cada una de un único bulk-fetch por flight_sk.
type flightChildren struct {
	crew      []queries.FlightCrewRow
	personH   []queries.FlightPersonHoursRow
	gvn       []queries.FlightGvntypeHoursRow
	ift       []queries.FlightIftHoursRow
	instr     []queries.FlightInstructorHoursRow
	formation []queries.FlightFormationHoursRow
	apps      []queries.FlightApproachesRow
	landings  []queries.FlightLandingsRow
	wt        []queries.FlightWtHoursRow
	proj      []queries.FlightProjectilesRow
	paps      []queries.FlightPapeletasRow
	cupos     []queries.FlightCuposRow
	capbas    []queries.FlightCapbasRow
	pax       []queries.FlightPassengersRow
}

// fetchChildren hace un bulk-fetch por tabla hija para todos los flights de la
// página. Propaga el primer error: una query hija que falle aborta el listado
// en lugar de devolver un vuelo silenciosamente incompleto como 200 OK.
func fetchChildren(ctx context.Context, q *queries.Queries, flightSks []int32) (flightChildren, error) {
	var ch flightChildren
	var err error
	if ch.crew, err = q.FlightCrew(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight crew: %w", err)
	}
	if ch.personH, err = q.FlightPersonHours(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight person hours: %w", err)
	}
	if ch.gvn, err = q.FlightGvntypeHours(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight gvntype hours: %w", err)
	}
	if ch.ift, err = q.FlightIftHours(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight ift hours: %w", err)
	}
	if ch.instr, err = q.FlightInstructorHours(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight instructor hours: %w", err)
	}
	if ch.formation, err = q.FlightFormationHours(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight formation hours: %w", err)
	}
	if ch.apps, err = q.FlightApproaches(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight approaches: %w", err)
	}
	if ch.landings, err = q.FlightLandings(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight landings: %w", err)
	}
	if ch.wt, err = q.FlightWtHours(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight wt hours: %w", err)
	}
	if ch.proj, err = q.FlightProjectiles(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight projectiles: %w", err)
	}
	if ch.paps, err = q.FlightPapeletas(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight papeletas: %w", err)
	}
	if ch.cupos, err = q.FlightCupos(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight cupos: %w", err)
	}
	if ch.capbas, err = q.FlightCapbas(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight capbas: %w", err)
	}
	if ch.pax, err = q.FlightPassengers(ctx, flightSks); err != nil {
		return ch, fmt.Errorf("flight passengers: %w", err)
	}
	return ch, nil
}

type gvnPair struct{ iit, anvis float64 }

// indexedChildren son las filas hijas ya indexadas por (flight, person) o por
// flight, listas para ensamblar cada FlightItem sin re-recorrer slices.
type indexedChildren struct {
	personHours map[fp]map[int32]float64
	gvn         map[fp]gvnPair
	ift         map[fp]float64
	instr       map[fp]float64
	formation   map[fp]map[int32]float64
	apps        map[fp]map[int32]int32
	landings    map[fp]map[pp]int32
	wt          map[fp]float64
	proj        map[fp]map[int32]int32
	paps        map[fp][]PapeletaJSON
	cupos       map[int32][]CupoJSON
	capbas      map[int32][]CapbaJSON
	pax         map[int32][]PasajeroJSON
	crew        map[int32][]queries.FlightCrewRow
}

// indexChildren agrupa las filas hijas por (flight, person) o por flight.
func indexChildren(ch flightChildren) indexedChildren {
	idx := indexedChildren{
		personHours: map[fp]map[int32]float64{},
		gvn:         map[fp]gvnPair{},
		ift:         map[fp]float64{},
		instr:       map[fp]float64{},
		formation:   map[fp]map[int32]float64{},
		apps:        map[fp]map[int32]int32{},
		landings:    map[fp]map[pp]int32{},
		wt:          map[fp]float64{},
		proj:        map[fp]map[int32]int32{},
		paps:        map[fp][]PapeletaJSON{},
		cupos:       map[int32][]CupoJSON{},
		capbas:      map[int32][]CapbaJSON{},
		pax:         map[int32][]PasajeroJSON{},
		crew:        map[int32][]queries.FlightCrewRow{},
	}
	for _, r := range ch.personH {
		key := fp{r.FlightSk, r.PersonSk}
		if idx.personHours[key] == nil {
			idx.personHours[key] = map[int32]float64{}
		}
		idx.personHours[key][r.PeriodFk] = numericToFloat(r.Qty)
	}
	for _, r := range ch.gvn {
		idx.gvn[fp{r.FlightSk, r.PersonSk}] = gvnPair{numericToFloat(r.Iit), numericToFloat(r.Anvis)}
	}
	for _, r := range ch.ift {
		idx.ift[fp{r.FlightSk, r.PersonSk}] = numericToFloat(r.Qty)
	}
	for _, r := range ch.instr {
		idx.instr[fp{r.FlightSk, r.PersonSk}] = numericToFloat(r.Qty)
	}
	for _, r := range ch.formation {
		key := fp{r.FlightSk, r.PersonSk}
		if idx.formation[key] == nil {
			idx.formation[key] = map[int32]float64{}
		}
		idx.formation[key][r.PeriodFk] = numericToFloat(r.Qty)
	}
	for _, r := range ch.apps {
		key := fp{r.FlightSk, r.PersonSk}
		if idx.apps[key] == nil {
			idx.apps[key] = map[int32]int32{}
		}
		idx.apps[key][r.TypeFk] = r.Qty
	}
	for _, r := range ch.landings {
		key := fp{r.FlightSk, r.PersonSk}
		if idx.landings[key] == nil {
			idx.landings[key] = map[pp]int32{}
		}
		idx.landings[key][pp{r.PlaceFk, r.PeriodFk}] = r.Qty
	}
	for _, r := range ch.wt {
		idx.wt[fp{r.FlightSk, r.PersonSk}] = numericToFloat(r.Qty)
	}
	for _, r := range ch.proj {
		key := fp{r.FlightSk, r.PersonSk}
		if idx.proj[key] == nil {
			idx.proj[key] = map[int32]int32{}
		}
		idx.proj[key][r.TypeFk] = r.Qty
	}
	for _, r := range ch.paps {
		key := fp{r.FlightSk, r.PersonSk}
		idx.paps[key] = append(idx.paps[key], PapeletaJSON{
			Nombre: r.Nombre, Descripcion: r.Descripcion, Periodo: r.Periodo,
		})
	}
	for _, r := range ch.cupos {
		idx.cupos[r.FlightSk] = append(idx.cupos[r.FlightSk], CupoJSON{
			Autoridad: r.Autoridad, Horas: numericToFloat(r.Horas),
		})
	}
	for _, r := range ch.capbas {
		idx.capbas[r.FlightSk] = append(idx.capbas[r.FlightSk], CapbaJSON{
			Capba: r.Capba, Horas: numericToFloat(r.Horas),
		})
	}
	for _, r := range ch.pax {
		idx.pax[r.FlightSk] = append(idx.pax[r.FlightSk], PasajeroJSON{
			Tipo: r.Tipo, Cantidad: r.Cantidad, Ruta: r.Ruta,
		})
	}
	for _, c := range ch.crew {
		idx.crew[c.FlightSk] = append(idx.crew[c.FlightSk], c)
	}
	return idx
}

// assembleItems compone el JSON anidado (pilotos / dotaciones / cupos…) por
// vuelo a partir de las filas indexadas.
func assembleItems(rows []queries.ListFlightsRow, idx indexedChildren) []FlightItem {
	items := make([]FlightItem, 0, len(rows))
	for _, r := range rows {
		var pilotos []PilotoJSON
		var dotaciones []DotacionJSON
		for _, c := range idx.crew[r.FlightSk] {
			key := fp{r.FlightSk, c.PersonSk}
			nk := ""
			if c.PersonNk != nil {
				nk = *c.PersonNk
			}
			if c.PersonRol == "Piloto" {
				ph := idx.personHours[key]
				gh := idx.gvn[key]
				ap := idx.apps[key]
				fm := idx.formation[key]
				pilotos = append(pilotos, PilotoJSON{
					Nombre: c.Nombre, Nk: nk, Orden: c.OrderPosition,
					HoraVueloPiloto: HVPilotoJSON{
						Dia: ph[periodDay], Noche: ph[periodNight],
						Gvn:          GvnSubJSON{Total: ph[periodGvn], Iit: gh.iit, Anvis: gh.anvis},
						Instrumentos: idx.ift[key], Instructor: idx.instr[key],
						FormacionDia: fm[periodDay], FormacionGvn: fm[periodGvn],
					},
					Tomas:               buildTomas(idx.landings[key]),
					AproximacionesInstr: ApsInstrJSON{Precision: ap[appPrecision], NoPrecision: ap[appNoPrecision]},
					AproximacionesSar:   ApsSarJSON{Td: ap[appTd], Sp: ap[appSp]},
					Papeletas:           orEmpty(idx.paps[key]),
				})
			} else {
				ph := idx.personHours[key]
				pr := idx.proj[key]
				dotaciones = append(dotaciones, DotacionJSON{
					Nombre: c.Nombre, Nk: nk, Orden: c.OrderPosition,
					HoraVueloDotacion: HVDotacionJSON{
						Dia: ph[periodDay], Noche: ph[periodNight],
						Gvn: ph[periodGvn], WinchTrim: idx.wt[key],
					},
					Proyectiles: ProyectilesJSON{M3M: pr[projectileM3M], Mag58: pr[projectileMag58]},
					Papeletas:   orEmpty(idx.paps[key]),
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
					Pilotos:    orEmpty(pilotos),
					Dotaciones: orEmpty(dotaciones),
				},
				CuposAutoridad:     orEmpty(idx.cupos[r.FlightSk]),
				CapacidadesBasicas: orEmpty(idx.capbas[r.FlightSk]),
				Pasajeros:          orEmpty(idx.pax[r.FlightSk]),
			},
		})
	}
	return items
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

// parseOptionalFloat interpreta un campo de horas opcional del formulario.
// Distingue tres casos en vez de tragarse el dato inválido como cero:
//   - "" (en blanco)               → (0, false, nil): se omite la fila.
//   - número válido >= 0           → (v, v>0, nil): el bool indica si se inserta.
//   - texto no numérico o negativo → error de validación (aborta el insert).
func parseOptionalFloat(s string) (float64, bool, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false, nil
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false, fmt.Errorf("%w: %q no es un número válido", ErrInvalidInput, s)
	}
	if f < 0 {
		return 0, false, fmt.Errorf("%w: %q no puede ser negativo", ErrInvalidInput, s)
	}
	return f, f > 0, nil
}

// parseOptionalInt es el equivalente para conteos enteros (>= 0): tomas,
// aproximaciones, proyectiles, pasajeros.
func parseOptionalInt(s string) (int32, bool, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false, nil
	}
	n, err := strconv.ParseInt(s, 10, 32)
	if err != nil {
		return 0, false, fmt.Errorf("%w: %q no es un entero válido", ErrInvalidInput, s)
	}
	if n < 0 {
		return 0, false, fmt.Errorf("%w: %q no puede ser negativo", ErrInvalidInput, s)
	}
	return int32(n), n > 0, nil
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

// orEmpty normaliza un slice nil a uno vacío para que el JSON serialice [] en
// lugar de null.
func orEmpty[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
