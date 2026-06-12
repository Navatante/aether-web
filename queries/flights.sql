-- ============================================================
-- Flights (Hito 4, lote 7)
--
-- Reimplementa db_insert_flight (transacción con ~10 tablas hijas),
-- db_delete_flight y sp_get_flights_with_flexible_crew.
--
-- Convenciones de SK (del seed/legacy):
--   period:        1=día, 2=noche, 3=gvn
--   ifr_app_type:  1=precision, 2=no_precision, 3=td, 4=sp
--   landing_place: 1=tierra, 2=mono-spot, 3=multi-spot, 4=carrier
--   projectile:    1=m3m, 2=mag58
-- ============================================================


-- =============== INSERT MASTER + DEPENDIENTES ===============

-- name: InsertFlight :one
INSERT INTO operations.flight (
    flight_date, flight_departure_place, flight_departure_time,
    flight_arrival_place, flight_arrival_time,
    flight_aircraft_fk, flight_event_fk, flight_person_cta_fk,
    flight_escuadrilla_fk, flight_total_hours
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING flight_sk;

-- name: InsertPersonHour :exec
INSERT INTO operations.person_hour (
    person_hour_flight_fk, person_hour_person_fk,
    person_hour_period_fk, person_hour_hour_qty
) VALUES ($1, $2, $3, $4);

-- name: InsertGvntypeHour :exec
INSERT INTO operations.gvntype_hour (
    gvntype_hour_flight_fk, gvntype_hour_person_fk,
    gvntype_hour_iit_qty, gvntype_hour_anvis_qty
) VALUES ($1, $2, $3, $4);

-- name: InsertIftHour :exec
INSERT INTO operations.ift_hour (
    ift_hour_flight_fk, ift_hour_person_fk, ift_hour_qty
) VALUES ($1, $2, $3);

-- name: InsertInstructorHour :exec
INSERT INTO operations.instructor_hour (
    instructor_hour_flight_fk, instructor_hour_person_fk, instructor_hour_qty
) VALUES ($1, $2, $3);

-- name: InsertFormationHour :exec
INSERT INTO operations.formation_hour (
    formation_hour_flight_fk, formation_hour_person_fk,
    formation_hour_period_fk, formation_hour_formation_qty
) VALUES ($1, $2, $3, $4);

-- name: InsertApproach :exec
INSERT INTO operations.approach (
    app_flight_fk, app_person_fk, app_type_fk, app_qty
) VALUES ($1, $2, $3, $4);

-- name: InsertLanding :exec
INSERT INTO operations.landing (
    landing_flight_fk, landing_person_fk,
    landing_place_fk, landing_period_fk, landing_qty
) VALUES ($1, $2, $3, $4, $5);

-- name: InsertWtHour :exec
INSERT INTO operations.wt_hour (
    wt_hour_flight_fk, wt_hour_person_fk, wt_hour_qty
) VALUES ($1, $2, $3);

-- name: InsertProjectile :exec
INSERT INTO operations.projectile (
    projectile_flight_fk, projectile_person_fk,
    projectile_type_fk, projectile_qty
) VALUES ($1, $2, $3, $4);

-- name: InsertPapeletaCrewCount :exec
INSERT INTO operations.papeleta_crew_count (
    papeleta_crew_count_flight_fk, papeleta_crew_count_person_fk,
    papeleta_crew_count_session_fk, papeleta_crew_count_period_fk
) VALUES ($1, $2, $3, $4);

-- name: InsertCupoHour :exec
INSERT INTO operations.cupo_hour (
    cupo_flight_fk, cupo_authority_fk, cupo_hour_qty
) VALUES ($1, $2, $3);

-- name: InsertPassenger :exec
INSERT INTO operations.passenger (
    passenger_flight_fk, passenger_type_fk, passenger_qty, passenger_route
) VALUES ($1, $2, $3, $4);


-- =============== DELETE (cascade en BD elimina hijos) ===============

-- name: DeleteFlight :execrows
DELETE FROM operations.flight
WHERE flight_sk = $1 AND flight_escuadrilla_fk = $2;


-- =============== LIST (sp_get_flights_with_flexible_crew) ===============

-- name: ListFlights :many
-- Paginado + filtros opcionales. $2 = flight_sk (0=sin filtro), $3/$4 = date_from/to (NULL=sin filtro).
SELECT
    f.flight_sk,
    f.flight_date,
    f.flight_departure_time,
    f.flight_total_hours,
    h.aircraft_number,
    e.event_name,
    e.event_place,
    cta.person_rank        AS cta_rank,
    cta.person_last_name_1 AS cta_lastname1,
    cta.person_last_name_2 AS cta_lastname2
FROM operations.flight f
JOIN operations.aircraft h  ON f.flight_aircraft_fk = h.aircraft_sk
JOIN operations.event    e  ON f.flight_event_fk    = e.event_sk
JOIN detall.person       cta ON f.flight_person_cta_fk = cta.person_sk
WHERE f.flight_escuadrilla_fk = $1
  AND ($2 = 0 OR f.flight_sk = $2)
  AND ($3::date IS NULL OR f.flight_date >= $3)
  AND ($4::date IS NULL OR f.flight_date <= $4)
ORDER BY f.flight_date DESC, f.flight_sk DESC
LIMIT $5 OFFSET $6;

-- name: CountFlights :one
SELECT COUNT(*)::int
FROM operations.flight f
WHERE f.flight_escuadrilla_fk = $1
  AND ($2 = 0 OR f.flight_sk = $2)
  AND ($3::date IS NULL OR f.flight_date >= $3)
  AND ($4::date IS NULL OR f.flight_date <= $4);


-- =============== BULK FETCHES por flight_sk[] (para componer JSON) ===============

-- name: FlightCrew :many
-- Personas que tienen al menos 1 person_hour para los vuelos dados.
SELECT DISTINCT
    p.person_sk,
    p.person_nk,
    p.order_position,
    p.person_rol,
    BTRIM(p.person_rank || ' ' || p.person_last_name_1 || ' ' || p.person_last_name_2)::text AS nombre,
    ph.person_hour_flight_fk AS flight_sk
FROM detall.v_person_ordered p
JOIN operations.person_hour ph ON ph.person_hour_person_fk = p.person_sk
WHERE ph.person_hour_flight_fk = ANY($1::int[])
ORDER BY ph.person_hour_flight_fk, p.order_position;

-- name: FlightPersonHours :many
SELECT person_hour_flight_fk AS flight_sk, person_hour_person_fk AS person_sk,
       person_hour_period_fk AS period_fk, person_hour_hour_qty::numeric AS qty
FROM operations.person_hour
WHERE person_hour_flight_fk = ANY($1::int[]);

-- name: FlightGvntypeHours :many
SELECT gvntype_hour_flight_fk AS flight_sk, gvntype_hour_person_fk AS person_sk,
       COALESCE(gvntype_hour_iit_qty, 0)::numeric AS iit,
       COALESCE(gvntype_hour_anvis_qty, 0)::numeric AS anvis
FROM operations.gvntype_hour
WHERE gvntype_hour_flight_fk = ANY($1::int[]);

-- name: FlightIftHours :many
SELECT ift_hour_flight_fk AS flight_sk, ift_hour_person_fk AS person_sk,
       ift_hour_qty::numeric AS qty
FROM operations.ift_hour
WHERE ift_hour_flight_fk = ANY($1::int[]);

-- name: FlightInstructorHours :many
SELECT instructor_hour_flight_fk AS flight_sk, instructor_hour_person_fk AS person_sk,
       instructor_hour_qty::numeric AS qty
FROM operations.instructor_hour
WHERE instructor_hour_flight_fk = ANY($1::int[]);

-- name: FlightFormationHours :many
SELECT formation_hour_flight_fk AS flight_sk, formation_hour_person_fk AS person_sk,
       formation_hour_period_fk AS period_fk,
       COALESCE(formation_hour_formation_qty, 0)::numeric AS qty
FROM operations.formation_hour
WHERE formation_hour_flight_fk = ANY($1::int[]);

-- name: FlightApproaches :many
SELECT app_flight_fk AS flight_sk, app_person_fk AS person_sk,
       app_type_fk AS type_fk, app_qty AS qty
FROM operations.approach
WHERE app_flight_fk = ANY($1::int[]);

-- name: FlightLandings :many
SELECT landing_flight_fk AS flight_sk, landing_person_fk AS person_sk,
       landing_place_fk AS place_fk, landing_period_fk AS period_fk,
       landing_qty AS qty
FROM operations.landing
WHERE landing_flight_fk = ANY($1::int[]);

-- name: FlightWtHours :many
SELECT wt_hour_flight_fk AS flight_sk, wt_hour_person_fk AS person_sk,
       wt_hour_qty::numeric AS qty
FROM operations.wt_hour
WHERE wt_hour_flight_fk = ANY($1::int[]);

-- name: FlightProjectiles :many
SELECT projectile_flight_fk AS flight_sk, projectile_person_fk AS person_sk,
       projectile_type_fk AS type_fk, projectile_qty AS qty
FROM operations.projectile
WHERE projectile_flight_fk = ANY($1::int[]);

-- name: FlightPapeletas :many
SELECT pcc.papeleta_crew_count_flight_fk  AS flight_sk,
       pcc.papeleta_crew_count_person_fk  AS person_sk,
       pap.papeleta_name                  AS nombre,
       pap.papeleta_description           AS descripcion,
       pcc.papeleta_crew_count_period_fk  AS periodo
FROM operations.papeleta_crew_count pcc
JOIN operations.papeleta pap ON pap.papeleta_sk = pcc.papeleta_crew_count_session_fk
WHERE pcc.papeleta_crew_count_flight_fk = ANY($1::int[]);

-- name: FlightCupos :many
SELECT ch.cupo_flight_fk AS flight_sk,
       a.authority_name  AS autoridad,
       ch.cupo_hour_qty::numeric AS horas
FROM operations.cupo_hour ch
JOIN operations.authority a ON a.authority_sk = ch.cupo_authority_fk
WHERE ch.cupo_flight_fk = ANY($1::int[]);

-- name: FlightPassengers :many
SELECT p.passenger_flight_fk AS flight_sk,
       pt.passenger_type_name AS tipo,
       p.passenger_qty AS cantidad,
       p.passenger_route AS ruta
FROM operations.passenger p
JOIN operations.passenger_type pt ON pt.passenger_type_sk = p.passenger_type_fk
WHERE p.passenger_flight_fk = ANY($1::int[]);
