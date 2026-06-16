package dashboard

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/queries"
)

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: queries.New(pool)}
}

// HistoricStart devuelve la fecha de creación de la escuadrilla de la sesión,
// usada como ancla del rango "histórico" en ResolveRange. Si la fila no tiene
// fecha (no debería ocurrir) cae al ancla de respaldo.
func (s *Service) HistoricStart(ctx context.Context, escuadrillaID int) (time.Time, error) {
	d, err := s.q.EscuadrillaCreationDate(ctx, int32(escuadrillaID))
	if err != nil {
		return time.Time{}, err
	}
	if !d.Valid {
		return defaultHistoricStart, nil
	}
	return d.Time, nil
}

// StaticStats ejecuta las 7 queries de stats estáticas en paralelo no es
// necesario aquí: el coste dominante son IO de BD, todas se sirven del
// pool. Se ejecutan secuencialmente para no estresar conexiones.
func (s *Service) StaticStats(ctx context.Context, escuadrillaID int) (*StaticStats, error) {
	esc := int32(escuadrillaID)

	pilots, err := s.q.GetStaticPilotsStats(ctx, esc)
	if err != nil {
		return nil, fmt.Errorf("pilots: %w", err)
	}
	crew, err := s.q.GetStaticCrewStats(ctx, esc)
	if err != nil {
		return nil, fmt.Errorf("crew: %w", err)
	}
	mant, err := s.q.GetStaticMantenedoresStats(ctx, esc)
	if err != nil {
		return nil, fmt.Errorf("mantenedores: %w", err)
	}
	admin, err := s.q.GetStaticAdministrativosStats(ctx, esc)
	if err != nil {
		return nil, fmt.Errorf("administrativos: %w", err)
	}
	total, err := s.q.GetStaticPersonalTotalStats(ctx, esc)
	if err != nil {
		return nil, fmt.Errorf("personal_total: %w", err)
	}
	crp, err := s.q.GetStaticCRPAverage(ctx, esc)
	if err != nil {
		return nil, fmt.Errorf("crp: %w", err)
	}
	airflow, err := s.q.GetStaticAirflowAverage(ctx, esc)
	if err != nil {
		return nil, fmt.Errorf("airflow: %w", err)
	}

	return &StaticStats{
		Pilotos: PilotStats{
			Total: int(pilots.Total), PQM: int(pilots.Pqm), H2P: int(pilots.H2p),
			HAC: int(pilots.Hac), IP: int(pilots.Ip), FCP: int(pilots.Fcp), IPFCP: int(pilots.IpFcp),
		},
		TripulacionCabina: TripulacionStats{
			Total: int(crew.Total), Alumnos: int(crew.Alumnos), Dotaciones: int(crew.Dotaciones),
			Cabezas: int(crew.Cabezas), DVInstructores: int(crew.DvInstructores), DVPruebas: int(crew.DvPruebas),
			DVInstructoresYPruebas: int(crew.DvInstructoresYPruebas), Nadadores: int(crew.Nadadores),
		},
		Mantenedores: MantenedoresStats{
			Total: int(mant.Total), B1: int(mant.B1), B2: int(mant.B2), LV: int(mant.Lv),
		},
		Administrativos: AdministrativosStats{
			Total: int(admin.Total), Detall: int(admin.Detall),
			Operaciones: int(admin.Operaciones), Mantenimiento: int(admin.Mantenimiento),
		},
		PersonalTotal: PersonalTotalStats{
			Total: int(total.Total), Oficiales: int(total.Oficiales),
			Suboficiales: int(total.Suboficiales), TropaMarineria: int(total.TropaMarineria),
		},
		CRP:     int(crp),
		Airflow: int(airflow),
	}, nil
}

func (s *Service) DynamicStats(ctx context.Context, escuadrillaID int, rng DateRange) (*DynamicStats, error) {
	esc := int32(escuadrillaID)
	fromDate := pgDate(rng.From)
	// To-exclusive: SQL queries usan flight_date < $2, así que pasamos To+1.
	toExclusive := pgDate(rng.To.AddDate(0, 0, 1))

	totals, err := s.q.GetDynamicTotals(ctx, queries.GetDynamicTotalsParams{
		FlightDate: fromDate, FlightDate_2: toExclusive, FlightEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, fmt.Errorf("totals: %w", err)
	}

	vueloRows, err := s.q.GetDynamicHorasVuelo(ctx, queries.GetDynamicHorasVueloParams{
		FlightDate: fromDate, FlightDate_2: toExclusive, FlightEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, fmt.Errorf("horas_vuelo: %w", err)
	}

	heloRows, err := s.q.GetDynamicHorasHelicoptero(ctx, queries.GetDynamicHorasHelicopteroParams{
		FlightDate: fromDate, FlightDate_2: toExclusive, FlightEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, fmt.Errorf("horas_helicoptero: %w", err)
	}

	autRows, err := s.q.GetDynamicHorasAutoridad(ctx, queries.GetDynamicHorasAutoridadParams{
		FlightDate: fromDate, FlightDate_2: toExclusive, FlightEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, fmt.Errorf("horas_autoridad: %w", err)
	}

	evRows, err := s.q.GetDynamicHorasEventoLugar(ctx, queries.GetDynamicHorasEventoLugarParams{
		FlightDate: fromDate, FlightDate_2: toExclusive, FlightEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, fmt.Errorf("horas_evento_lugar: %w", err)
	}

	per, err := s.q.GetDynamicHorasPeriodo(ctx, queries.GetDynamicHorasPeriodoParams{
		FlightDate: fromDate, FlightDate_2: toExclusive, FlightEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, fmt.Errorf("horas_periodo: %w", err)
	}

	paxRows, err := s.q.GetDynamicPasajeros(ctx, queries.GetDynamicPasajerosParams{
		FlightDate: fromDate, FlightDate_2: toExclusive, FlightEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, fmt.Errorf("pasajeros: %w", err)
	}

	capbaRows, err := s.q.GetDynamicHorasCapba(ctx, queries.GetDynamicHorasCapbaParams{
		FlightDate: fromDate, FlightDate_2: toExclusive, FlightEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, fmt.Errorf("horas_capba: %w", err)
	}

	// Map por evento agregando lugares.
	eventos := make([]HorasEventoLugar, 0)
	idxByEvento := make(map[string]int)
	for _, r := range evRows {
		i, ok := idxByEvento[r.Evento]
		if !ok {
			eventos = append(eventos, HorasEventoLugar{Evento: r.Evento, Lugares: map[string]float64{}})
			i = len(eventos) - 1
			idxByEvento[r.Evento] = i
		}
		eventos[i].Lugares[r.Lugar] = numericToFloat(r.Horas)
	}

	// Horas de vuelo
	vueloOut := make([]HorasDeVuelo, 0, len(vueloRows))
	for _, r := range vueloRows {
		vueloOut = append(vueloOut, HorasDeVuelo{
			Date:      r.Date.Time.Format("2006-01-02"),
			Real:      numericToFloat(r.RealHours),
			Simulador: numericToFloat(r.Simulador),
		})
	}

	// Helicópteros
	heloOut := make([]HorasHelicoptero, 0, len(heloRows))
	for _, r := range heloRows {
		heloOut = append(heloOut, HorasHelicoptero{Helo: r.Helo, Horas: numericToFloat(r.Horas)})
	}

	// Autoridad
	autOut := make([]HorasAutoridad, 0, len(autRows))
	for _, r := range autRows {
		autOut = append(autOut, HorasAutoridad{
			Autoridad: r.Autoridad, Abreviatura: r.Abreviatura, Horas: numericToFloat(r.Horas),
		})
	}

	// Pasajeros
	paxOut := make([]Pasajero, 0, len(paxRows))
	for _, r := range paxRows {
		paxOut = append(paxOut, Pasajero{Tipo: r.Tipo, Cantidad: int(r.Cantidad)})
	}

	// Capacidades básicas
	capbaOut := make([]HorasCapba, 0, len(capbaRows))
	for _, r := range capbaRows {
		capbaOut = append(capbaOut, HorasCapba{Capba: r.Capba, Horas: numericToFloat(r.Horas)})
	}

	return &DynamicStats{
		FechaInicio: rng.From.Format("2006-01-02"),
		FechaFin:    rng.To.Format("2006-01-02"),
		ResumenGeneral: ResumenGeneral{
			TotalHoras:      numericToFloat(totals.TotalHoras),
			TotalVuelos:     int(totals.TotalVuelos),
			HorasSimulador:  numericToFloat(totals.HorasSimulador),
			VuelosSimulador: int(totals.VuelosSimulador),
		},
		HorasDeVuelo:        vueloOut,
		HorasPorHelicoptero: heloOut,
		HorasPorAutoridad:   autOut,
		HorasPorEventoLugar: eventos,
		HorasPorPeriodo: HorasPeriodo{
			DiaReal:               numericToFloat(per.DiaReal),
			DiaSimulado:           numericToFloat(per.DiaSimulado),
			NocheSinGafasReal:     numericToFloat(per.NocheSinGafasReal),
			NocheSinGafasSimulado: numericToFloat(per.NocheSinGafasSimulado),
			GVNReal:               numericToFloat(per.GvnReal),
			AnvisReal:             numericToFloat(per.AnvisReal),
			IITReal:               numericToFloat(per.IitReal),
			GVNSimulado:           numericToFloat(per.GvnSimulado),
			AnvisSimulado:         numericToFloat(per.AnvisSimulado),
			IITSimulado:           numericToFloat(per.IitSimulado),
		},
		Pasajeros:     paxOut,
		HorasPorCapba: capbaOut,
	}, nil
}

// pgDate convierte time.Time → pgtype.Date.
func pgDate(t time.Time) pgtype.Date {
	return pgtype.Date{Time: t, Valid: true}
}

// numericToFloat extrae el float64 de un pgtype.Numeric. Devuelve 0 si el
// valor no es válido o no representable como float.
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
