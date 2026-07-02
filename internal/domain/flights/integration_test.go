package flights_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/domain/flights"
	"github.com/14esc/aether-web/internal/testdb"
)

// seedFlightCatalog siembra los catálogos que exige un insert de vuelo. Los SKs
// generados arrancan en 1, igual que las constantes legacy del service
// (periodDay=1, appPrecision=1, landingTierra=1, projectileM3M=1…).
func seedFlightCatalog(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	stmts := []string{
		`INSERT INTO operations.period (period_name) VALUES ('Día'), ('Noche'), ('GVN')`,
		`INSERT INTO operations.ifr_app_type (ifr_app_type_name, ifr_app_type_type) VALUES
			('Precisión', 'IFR'), ('No precisión', 'IFR'), ('TD', 'VFR'), ('SP', 'VFR')`,
		`INSERT INTO operations.landing_place (landing_place_name) VALUES
			('Tierra'), ('Mono'), ('Multi'), ('Carrier')`,
		`INSERT INTO operations.projectile_type (projectile_type_name, projectile_type_weapon) VALUES
			('M3M', '12.70'), ('MAG-58', '7.62')`,
		`INSERT INTO operations.departure_arrival_place (departure_arrival_place_code, departure_arrival_place_name)
			VALUES ('LERT', 'Rota')`,
		`INSERT INTO operations.aircraft_model (aircraft_type, aircraft_make, aircraft_model, aircraft_variant, aircraft_is_multi_engine, aircraft_is_multi_pilot)
			VALUES ('Helicóptero', 'NH Industries', 'NH90', 'Caimán', true, true)`,
		`INSERT INTO operations.aircraft (aircraft_model_fk, aircraft_registration, aircraft_number, aircraft_escuadrilla_fk)
			VALUES (1, 'HT.29-01', '01', 1)`,
		`INSERT INTO operations.event_name (event_name_value) VALUES ('Adiestramiento')`,
		`INSERT INTO operations.event (event_name, event_place) VALUES ('Adiestramiento', 'Local')`,
	}
	for _, s := range stmts {
		if _, err := pool.Exec(ctx, s); err != nil {
			t.Fatalf("seed catálogo de vuelo: %v\n%s", err, s)
		}
	}
}

// flightForm construye un vuelo con un piloto y un DV que tocan varias tablas
// hijas: person_hour (x2), ift_hour, approach, landing, wt_hour y projectile.
func flightForm(pilot, dv int32) flights.FlightFormData {
	f := flights.FlightFormData{
		General: flights.GeneralData{
			Date:           "2026-05-10",
			DeparturePlace: 1,
			DepartureTime:  "09:00",
			ArrivalPlace:   1,
			ArrivalTime:    "10:30",
			Aircraft:       1,
			Event:          1,
			TotalHours:     "1.5",
		},
	}
	p := flights.PilotData{Name: pilot}
	p.PersonHour.HDay = "1.5"
	p.IftHour = "0.5"
	p.App.Precision = "1"
	p.Landing.Tierra.LDay = "2"
	f.Pilots = []flights.PilotData{p}

	d := flights.DvData{Name: dv}
	d.PersonHour.HDay = "1.5"
	d.WtHour = "0.5"
	d.Projectile.M3M = "10"
	f.Dvs = []flights.DvData{d}
	return f
}

func countRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool, table string, flightSk int32) int {
	t.Helper()
	col := map[string]string{
		"person_hour": "person_hour_flight_fk",
		"ift_hour":    "ift_hour_flight_fk",
		"approach":    "app_flight_fk",
		"landing":     "landing_flight_fk",
		"wt_hour":     "wt_hour_flight_fk",
		"projectile":  "projectile_flight_fk",
	}[table]
	var n int
	if err := pool.QueryRow(ctx,
		"SELECT count(*) FROM operations."+table+" WHERE "+col+" = $1", flightSk).Scan(&n); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return n
}

func TestFlightInsertTransactionalIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	svc := flights.NewService(pool)
	esc := testdb.EscuadrillaID
	seedFlightCatalog(t, ctx, pool)

	pilot := testdb.CreatePerson(t, ctx, pool, "piloto1", auth.PermOperacional)
	dv := testdb.CreatePerson(t, ctx, pool, "dv1", auth.PermComun)

	// Validaciones de entrada.
	if _, err := svc.Insert(ctx, esc, "op1", "::1", flights.FlightFormData{}); !errors.Is(err, flights.ErrInvalidInput) {
		t.Errorf("insert vacío: got %v, want ErrInvalidInput", err)
	}
	badDate := flightForm(pilot, dv)
	badDate.General.Date = "10/05/2026"
	if _, err := svc.Insert(ctx, esc, "op1", "::1", badDate); !errors.Is(err, flights.ErrInvalidInput) {
		t.Errorf("insert con fecha mala: got %v, want ErrInvalidInput", err)
	}

	// Insert completo.
	res, err := svc.Insert(ctx, esc, "op1", "10.0.0.5", flightForm(pilot, dv))
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	if !res.Success || res.FlightID <= 0 {
		t.Fatalf("insert result: %+v", res)
	}

	// Tablas hijas pobladas dentro de la misma transacción.
	for table, want := range map[string]int{
		"person_hour": 2, // piloto + dv
		"ift_hour":    1,
		"approach":    1,
		"landing":     1,
		"wt_hour":     1,
		"projectile":  1,
	} {
		if got := countRows(t, ctx, pool, table, res.FlightID); got != want {
			t.Errorf("%s: %d filas, want %d", table, got, want)
		}
	}

	// El trigger tr_audit_flight registró el alta con los GUCs de la sesión.
	var user, ip string
	if err := pool.QueryRow(ctx, `
		SELECT user_id, ip_address FROM detall.audit_log
		WHERE table_name = 'flight' AND operation = 'INSERT'
		ORDER BY audit_id DESC LIMIT 1`).Scan(&user, &ip); err != nil {
		t.Fatalf("audit_log: %v", err)
	}
	if user != "op1" || ip != "10.0.0.5" {
		t.Errorf("audit INSERT: user=%q ip=%q, want op1/10.0.0.5", user, ip)
	}

	// El listado propio lo devuelve con su tripulación; otra escuadrilla no lo ve.
	list, err := svc.List(ctx, esc, flights.ListQueryParams{})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if list.TotalCount != 1 || len(list.Items) != 1 {
		t.Fatalf("list: total=%d items=%d, want 1/1", list.TotalCount, len(list.Items))
	}
	other, err := svc.List(ctx, esc+1, flights.ListQueryParams{})
	if err != nil {
		t.Fatal(err)
	}
	if other.TotalCount != 0 {
		t.Errorf("list cross-escuadrilla: total=%d, want 0", other.TotalCount)
	}

	// Delete: otra escuadrilla no puede; la propia sí y cascadea las hijas.
	if err := svc.Delete(ctx, esc+1, "op1", "::1", res.FlightID); !errors.Is(err, flights.ErrNotFound) {
		t.Errorf("delete cross-escuadrilla: got %v, want ErrNotFound", err)
	}
	if err := svc.Delete(ctx, esc, "op1", "10.0.0.5", res.FlightID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if got := countRows(t, ctx, pool, "person_hour", res.FlightID); got != 0 {
		t.Errorf("person_hour tras delete: %d filas, want 0 (ON DELETE CASCADE)", got)
	}
	var delOps int
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM detall.audit_log
		WHERE table_name = 'flight' AND operation = 'DELETE'`).Scan(&delOps); err != nil {
		t.Fatal(err)
	}
	if delOps != 1 {
		t.Errorf("audit DELETE: %d filas, want 1", delOps)
	}
}

// TestFlightInsertRollbackIntegration comprueba la atomicidad: si una tabla
// hija falla (FK inexistente), el vuelo entero se revierte.
func TestFlightInsertRollbackIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	svc := flights.NewService(pool)
	esc := testdb.EscuadrillaID
	seedFlightCatalog(t, ctx, pool)

	pilot := testdb.CreatePerson(t, ctx, pool, "piloto1", auth.PermOperacional)

	form := flightForm(pilot, pilot)
	form.Dvs[0].Name = 99999 // persona inexistente → falla person_hour del DV

	if _, err := svc.Insert(ctx, esc, "op1", "::1", form); err == nil {
		t.Fatal("insert con DV inexistente debería fallar")
	}

	var n int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM operations.flight").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("flight tras rollback: %d filas, want 0 (transacción atómica)", n)
	}
}
