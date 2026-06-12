-- ============================================================
-- Lookups (Hito 4, lote 1)
--
-- Traducción de src-tauri/src/database/commands/lookups.rs (29 fns).
-- RLS explícita: $1 = escuadrilla_id en cada query que lo necesita.
-- ============================================================


-- =============== Reads: catálogos para selectores (sk + label) ===============

-- name: LookupAircrafts :many
-- get_aircrafts (frontend): selector de aeronaves activas.
SELECT aircraft_sk, aircraft_number
FROM operations.aircraft
WHERE aircraft_current_flag = TRUE
  AND aircraft_escuadrilla_fk = $1
ORDER BY aircraft_number;

-- name: LookupAircraftsManage :many
-- get_aircrafts_manage: vista completa para gestión.
SELECT aircraft_sk, aircraft_registration, aircraft_number, aircraft_current_flag,
       aircraft_type, aircraft_make, aircraft_model, aircraft_variant,
       aircraft_is_multi_engine, aircraft_is_multi_pilot
FROM operations.aircraft
WHERE aircraft_escuadrilla_fk = $1
ORDER BY aircraft_number;

-- name: LookupDepartureArrivalPlaces :many
SELECT departure_arrival_place_sk, departure_arrival_place_code, departure_arrival_place_name
FROM operations.departure_arrival_place
ORDER BY departure_arrival_place_name;

-- name: LookupEventsManage :many
-- get_events_manage: nombre y lugar separados.
SELECT event_sk, event_name, event_place
FROM operations.event
ORDER BY event_name, event_place;

-- name: LookupEvents :many
-- get_events_lookup: "nombre - lugar" concatenado.
SELECT event_sk, (event_name || ' - ' || event_place)::text AS event_label
FROM operations.event
ORDER BY event_label;

-- name: LookupAuthorities :many
SELECT authority_sk, authority_name
FROM operations.authority
ORDER BY authority_name;

-- name: LookupPilots :many
-- get_pilots_lookup: pilotos ordenados por la vista canónica.
SELECT person_sk, person_nk
FROM detall.v_person_ordered
WHERE person_rol = 'Piloto'
  AND person_escuadrilla_fk = $1
ORDER BY order_position;

-- name: LookupCrew :many
-- get_crew_lookup: dotación (no pilotos, no no-tripulantes).
SELECT person_sk, person_nk
FROM detall.v_person_ordered
WHERE person_rol NOT IN ('Piloto', 'No Tripulante')
  AND person_escuadrilla_fk = $1
ORDER BY order_position;

-- name: LookupPapeletas :many
SELECT papeleta_sk, papeleta_name
FROM operations.papeleta
WHERE papeleta_escuadrilla_fk = $1
ORDER BY papeleta_name;

-- name: LookupPassengerTypes :many
SELECT passenger_type_sk, passenger_type_name
FROM operations.passenger_type
ORDER BY passenger_type_name;

-- name: LookupComisionTypes :many
SELECT comision_type_sk, name, origin
FROM detall.comision_type
ORDER BY origin;

-- name: LookupComisionLugares :many
SELECT comision_lugar_sk, comision_name
FROM detall.comision_lugar
ORDER BY comision_name;

-- name: LookupRecentComisiones :many
-- TOP 20 (LIMIT 20) más recientes. esfuerzo: boolean (en SQL Server era BIT
-- y el Rust intentaba leer como string, lo que devolvía NULL).
SELECT
    c.comision_sk,
    cl.comision_name                       AS lugar,
    ct.name                                AS tipo,
    TO_CHAR(c.comision_start_date, 'YYYY-MM-DD') AS fecha_inicio,
    TO_CHAR(c.comision_end_date,   'YYYY-MM-DD') AS fecha_fin,
    c.comision_esfuerzo                    AS esfuerzo
FROM detall.comision c
LEFT JOIN detall.comision_lugar cl ON c.comision_lugar_fk = cl.comision_lugar_sk
LEFT JOIN detall.comision_type  ct ON c.comision_type_fk  = ct.comision_type_sk
WHERE c.comision_escuadrilla_fk = $1
ORDER BY c.comision_sk DESC
LIMIT 20;

-- name: LookupPersonsForComision :many
SELECT person_sk, person_rank, person_name, person_last_name_1, person_last_name_2
FROM detall.v_person_ordered
WHERE person_escuadrilla_fk = $1
ORDER BY order_position;

-- name: LookupPersons :many
-- get_persons_lookup: "rank name last_name_1 [last_name_2]".
SELECT
    person_sk,
    (person_rank || ' ' || person_name || ' ' || person_last_name_1 ||
     CASE WHEN COALESCE(person_last_name_2, '') = '' THEN '' ELSE ' ' || person_last_name_2 END
    )::text AS full_name
FROM detall.v_person_ordered
WHERE person_escuadrilla_fk = $1
ORDER BY order_position;


-- =============== Reads: catálogos plano (Vec<String>) ===============

-- name: LookupEventNames :many
SELECT event_name_value FROM operations.event_name ORDER BY event_name_value;

-- name: LookupPapeletaBloques :many
SELECT papeleta_block_name FROM operations.papeleta_block ORDER BY papeleta_block_name;

-- name: LookupPapeletaPlanes :many
SELECT papeleta_plan_name FROM operations.papeleta_plan ORDER BY papeleta_plan_name;

-- name: LookupPersonEspecialidades :many
SELECT especialidad_name FROM detall.especialidad ORDER BY especialidad_name;

-- name: LookupPersonEmpleos :many
-- Ordenados por precedencia militar (rank_order).
SELECT rank_name FROM detall.rank ORDER BY rank_order;

-- name: LookupPersonDivisiones :many
SELECT division_name FROM detall.division ORDER BY division_name;

-- name: LookupPersonRoles :many
SELECT person_rol_name FROM detall.person_rol ORDER BY person_rol_name;


-- =============== Mutaciones ===============

-- name: AddDepartureArrivalPlace :exec
-- code se normaliza a uppercase en Go.
INSERT INTO operations.departure_arrival_place (departure_arrival_place_code, departure_arrival_place_name)
VALUES ($1, $2);

-- name: DeleteDepartureArrivalPlace :execrows
DELETE FROM operations.departure_arrival_place WHERE departure_arrival_place_sk = $1;

-- name: AddAircraft :exec
INSERT INTO operations.aircraft (
    aircraft_type, aircraft_make, aircraft_model, aircraft_variant,
    aircraft_registration, aircraft_number, aircraft_current_flag,
    aircraft_is_multi_engine, aircraft_is_multi_pilot, aircraft_escuadrilla_fk
) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9);

-- name: DeleteAircraft :execrows
DELETE FROM operations.aircraft
WHERE aircraft_sk = $1 AND aircraft_escuadrilla_fk = $2;

-- name: UpdateAircraftCurrentFlag :one
-- Devuelve el flag persistido para que el handler pueda verificar.
UPDATE operations.aircraft
SET aircraft_current_flag = $1
WHERE aircraft_sk = $2 AND aircraft_escuadrilla_fk = $3
RETURNING aircraft_current_flag;

-- name: UpsertEventName :exec
-- Idempotente: si el nombre ya existe, no hace nada.
INSERT INTO operations.event_name (event_name_value)
VALUES ($1)
ON CONFLICT (event_name_value) DO NOTHING;

-- name: AddEvent :exec
INSERT INTO operations.event (event_name, event_place) VALUES ($1, $2);

-- name: DeleteEvent :execrows
DELETE FROM operations.event WHERE event_sk = $1;
