-- ============================================================
-- Dashboard (Hito 3)
--
-- Reimplementación de sp_get_dashboard_static_stats y
-- sp_get_dashboard_dynamic_stats. La composición final del JSON
-- vive en Go; estas queries devuelven filas tipadas que el service
-- ensambla.
--
-- RLS explícita: cada query toma $1 = escuadrilla_id y filtra
-- person.person_escuadrilla_fk o flight.flight_escuadrilla_fk.
-- ============================================================


-- =============== STATIC STATS ===============

-- name: GetStaticPilotsStats :one
SELECT
    COUNT(DISTINCT p.person_sk)::int                                                  AS total,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk = 1 THEN p.person_sk END)::int        AS pqm,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk = 2 THEN p.person_sk END)::int        AS h2p,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk = 3 THEN p.person_sk END)::int        AS hac,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk = 4 THEN p.person_sk END)::int        AS ip,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk = 5 THEN p.person_sk END)::int        AS fcp,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk IN (4, 5) THEN p.person_sk END)::int  AS ip_fcp
FROM detall.person p
LEFT JOIN operations.crew_qualification cq ON cq.person_fk = p.person_sk
WHERE p.person_rol = 'Piloto'
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $1;


-- name: GetStaticCrewStats :one
SELECT
    COUNT(DISTINCT p.person_sk)::int                                                                 AS total,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk IN (6, 7) THEN p.person_sk END)::int                 AS alumnos,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk = 8 THEN p.person_sk END)::int                       AS dotaciones,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk = 9 THEN p.person_sk END)::int                       AS cabezas,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk = 10 THEN p.person_sk END)::int                      AS dv_instructores,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk = 11 THEN p.person_sk END)::int                      AS dv_pruebas,
    COUNT(DISTINCT CASE WHEN cq.crew_ratings_fk IN (10, 11) THEN p.person_sk END)::int               AS dv_instructores_y_pruebas,
    COUNT(DISTINCT CASE WHEN p.person_rol IN ('Nadador', 'Dotación/Nadador') THEN p.person_sk END)::int AS nadadores
FROM detall.person p
LEFT JOIN operations.crew_qualification cq ON cq.person_fk = p.person_sk
WHERE p.person_rol IN ('Dotación', 'Nadador', 'Dotación/Nadador')
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $1;


-- name: GetStaticMantenedoresStats :one
SELECT
    COUNT(DISTINCT p.person_sk)::int                                                AS total,
    COUNT(DISTINCT CASE WHEN ncq.notcrew_rating_fk = 1 THEN p.person_sk END)::int   AS b1,
    COUNT(DISTINCT CASE WHEN ncq.notcrew_rating_fk = 2 THEN p.person_sk END)::int   AS b2,
    COUNT(DISTINCT CASE WHEN ncq.notcrew_rating_fk = 3 THEN p.person_sk END)::int   AS lv
FROM detall.person p
JOIN detall.notcrew_qualification ncq ON ncq.person_fk = p.person_sk
WHERE ncq.notcrew_rating_fk IN (1, 2, 3)
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $1;


-- name: GetStaticAdministrativosStats :one
SELECT
    COUNT(DISTINCT p.person_sk)::int                                                       AS total,
    COUNT(DISTINCT CASE WHEN p.person_division = 'Detall' THEN p.person_sk END)::int       AS detall,
    COUNT(DISTINCT CASE WHEN p.person_division = 'Operaciones' THEN p.person_sk END)::int  AS operaciones,
    COUNT(DISTINCT CASE WHEN p.person_division LIKE '%Mantenimiento%' THEN p.person_sk END)::int AS mantenimiento
FROM detall.person p
LEFT JOIN detall.notcrew_qualification ncq ON ncq.person_fk = p.person_sk
WHERE p.person_rol = 'No Tripulante'
  AND ncq.person_fk IS NULL
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $1;


-- name: GetStaticPersonalTotalStats :one
SELECT
    COUNT(DISTINCT p.person_sk)::int                                                          AS total,
    COUNT(DISTINCT CASE WHEN r.rank_category = 'Oficiales' THEN p.person_sk END)::int         AS oficiales,
    COUNT(DISTINCT CASE WHEN r.rank_category = 'Suboficiales' THEN p.person_sk END)::int      AS suboficiales,
    COUNT(DISTINCT CASE WHEN r.rank_category = 'Tropa y marinería' THEN p.person_sk END)::int AS tropa_marineria
FROM detall.person p
JOIN detall.rank r ON p.person_rank = r.rank_name
WHERE p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $1;


-- name: GetStaticCRPAverage :one
-- CRP medio: por persona, suma de valores de papeleta_pilot/dv_crp_value de
-- papeletas registradas y NO caducadas (flight_date >= CURRENT_DATE - papeleta_expiration).
-- Cap a 100 por persona, luego AVG global.
WITH tripulantes AS (
    SELECT p.person_sk, p.person_rol
    FROM detall.person p
    WHERE p.person_rol <> 'No Tripulante'
      AND p.person_current_flag = TRUE
      AND p.person_escuadrilla_fk = $1
),
papeletas_validas AS (
    SELECT DISTINCT
        pcc.papeleta_crew_count_person_fk AS person_sk,
        pap.papeleta_sk,
        CASE WHEN p.person_rol = 'Piloto' THEN pap.papeleta_pilot_crp_value
             ELSE pap.papeleta_dv_crp_value END AS crp_value
    FROM operations.papeleta_crew_count pcc
    JOIN operations.papeleta pap ON pcc.papeleta_crew_count_session_fk = pap.papeleta_sk
    JOIN operations.flight f     ON pcc.papeleta_crew_count_flight_fk = f.flight_sk
    JOIN detall.person p         ON pcc.papeleta_crew_count_person_fk = p.person_sk
    WHERE p.person_escuadrilla_fk = $1
      AND pap.papeleta_expiration IS NOT NULL
      AND f.flight_date >= (CURRENT_DATE - pap.papeleta_expiration)
      AND (
            (p.person_rol = 'Piloto' AND pap.papeleta_pilot_crp_value IS NOT NULL)
         OR (p.person_rol <> 'Piloto' AND pap.papeleta_dv_crp_value IS NOT NULL)
      )
),
crp_por_persona AS (
    SELECT person_sk, SUM(crp_value)::numeric AS crp_raw
    FROM papeletas_validas
    GROUP BY person_sk
),
crp_capped AS (
    SELECT t.person_sk,
           LEAST(COALESCE(c.crp_raw, 0), 100) AS crp_total
    FROM tripulantes t
    LEFT JOIN crp_por_persona c ON c.person_sk = t.person_sk
)
SELECT COALESCE(ROUND(AVG(crp_total), 0), 0)::int AS crp FROM crp_capped;


-- name: GetStaticAirflowAverage :one
-- Airflow medio: por persona (rol piloto/dotación), si días sin volar >= 60 → 0,
-- en otro caso 100 - dias/60 * 100. Promedio global.
WITH dias_por_persona AS (
    SELECT
        p.person_sk,
        COALESCE(
            (CURRENT_DATE - MAX(f.flight_date)),  -- dias_sin_volar, INT
            -1
        ) AS dias_sin_volar
    FROM detall.person p
    LEFT JOIN operations.person_hour ph ON ph.person_hour_person_fk = p.person_sk
    LEFT JOIN operations.flight f       ON f.flight_sk = ph.person_hour_flight_fk
    WHERE p.person_rol IN ('Piloto', 'Dotación', 'Dotación/Nadador')
      AND p.person_current_flag = TRUE
      AND p.person_escuadrilla_fk = $1
    GROUP BY p.person_sk
)
SELECT COALESCE(ROUND(AVG(
    CASE WHEN dias_sin_volar = -1 THEN 0.0
         WHEN dias_sin_volar >= 60 THEN 0.0
         ELSE 100.0 - (dias_sin_volar::numeric / 60.0) * 100.0
    END
), 0), 0)::int AS airflow
FROM dias_por_persona;


-- =============== DYNAMIC STATS ===============

-- name: GetDynamicTotals :one
SELECT
    COUNT(*)::int                                                                         AS total_vuelos,
    COALESCE(SUM(f.flight_total_hours), 0)::numeric                                       AS total_horas,
    COUNT(*) FILTER (WHERE LOWER(e.event_name) LIKE '%simulador%')::int                   AS vuelos_simulador,
    COALESCE(SUM(f.flight_total_hours) FILTER (WHERE LOWER(e.event_name) LIKE '%simulador%'), 0)::numeric AS horas_simulador
FROM operations.flight f
JOIN operations.event e ON f.flight_event_fk = e.event_sk
WHERE f.flight_date >= $1
  AND f.flight_date <  $2
  AND f.flight_escuadrilla_fk = $3;


-- name: GetDynamicHorasVuelo :many
SELECT
    f.flight_date                                                                                  AS date,
    ROUND(SUM(CASE WHEN LOWER(e.event_name) NOT LIKE '%simulador%' THEN f.flight_total_hours ELSE 0 END), 1)::numeric AS real_hours,
    ROUND(SUM(CASE WHEN LOWER(e.event_name) LIKE '%simulador%'     THEN f.flight_total_hours ELSE 0 END), 1)::numeric AS simulador
FROM operations.flight f
JOIN operations.event e ON f.flight_event_fk = e.event_sk
WHERE f.flight_date >= $1
  AND f.flight_date <  $2
  AND f.flight_escuadrilla_fk = $3
GROUP BY f.flight_date
HAVING SUM(f.flight_total_hours) > 0
ORDER BY f.flight_date;


-- name: GetDynamicHorasHelicoptero :many
SELECT
    h.aircraft_number                          AS helo,
    ROUND(SUM(f.flight_total_hours), 1)::numeric AS horas
FROM operations.flight f
JOIN operations.aircraft h ON f.flight_aircraft_fk = h.aircraft_sk
WHERE f.flight_date >= $1
  AND f.flight_date <  $2
  AND f.flight_escuadrilla_fk = $3
  AND h.aircraft_registration NOT IN ('898', '899', '999')
GROUP BY h.aircraft_number
HAVING SUM(f.flight_total_hours) > 0
ORDER BY SUM(f.flight_total_hours) DESC;


-- name: GetDynamicHorasAutoridad :many
SELECT
    a.authority_name                       AS autoridad,
    a.authority_abrv                       AS abreviatura,
    ROUND(SUM(ch.cupo_hour_qty), 2)::numeric AS horas
FROM operations.cupo_hour ch
JOIN operations.authority a ON ch.cupo_authority_fk = a.authority_sk
JOIN operations.flight f    ON ch.cupo_flight_fk = f.flight_sk
WHERE f.flight_date >= $1
  AND f.flight_date <  $2
  AND f.flight_escuadrilla_fk = $3
  AND a.authority_name <> 'Simulador'
GROUP BY a.authority_name, a.authority_abrv
HAVING SUM(ch.cupo_hour_qty) > 0
ORDER BY SUM(ch.cupo_hour_qty) DESC;


-- name: GetDynamicHorasEventoLugar :many
-- Devuelve filas planas (evento, lugar, horas); Go agrupa por evento → map[lugar]horas.
SELECT
    e.event_name                                AS evento,
    COALESCE(e.event_place, 'Sin lugar')        AS lugar,
    ROUND(SUM(f.flight_total_hours), 1)::numeric AS horas
FROM operations.flight f
JOIN operations.event e ON f.flight_event_fk = e.event_sk
WHERE f.flight_date >= $1
  AND f.flight_date <  $2
  AND f.flight_escuadrilla_fk = $3
GROUP BY e.event_name, e.event_place
HAVING SUM(f.flight_total_hours) > 0
ORDER BY e.event_name, e.event_place;


-- name: GetDynamicHorasPeriodo :one
SELECT
    COALESCE(SUM(CASE WHEN p.period_sk = 1 AND e.event_name <> 'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END), 0)::numeric AS dia_real,
    COALESCE(SUM(CASE WHEN p.period_sk = 1 AND e.event_name =  'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END), 0)::numeric AS dia_simulado,
    COALESCE(SUM(CASE WHEN p.period_sk = 2 AND e.event_name <> 'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END), 0)::numeric AS noche_sin_gafas_real,
    COALESCE(SUM(CASE WHEN p.period_sk = 2 AND e.event_name =  'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END), 0)::numeric AS noche_sin_gafas_simulado,
    COALESCE(SUM(CASE WHEN p.period_sk = 3 AND e.event_name <> 'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END), 0)::numeric AS gvn_real,
    COALESCE(SUM(CASE WHEN p.period_sk = 3 AND e.event_name <> 'Simulador' THEN gh.gvntype_hour_anvis_qty ELSE 0 END), 0)::numeric AS anvis_real,
    COALESCE(SUM(CASE WHEN p.period_sk = 3 AND e.event_name <> 'Simulador' THEN gh.gvntype_hour_iit_qty ELSE 0 END), 0)::numeric AS iit_real,
    COALESCE(SUM(CASE WHEN p.period_sk = 3 AND e.event_name =  'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END), 0)::numeric AS gvn_simulado,
    COALESCE(SUM(CASE WHEN p.period_sk = 3 AND e.event_name =  'Simulador' THEN gh.gvntype_hour_anvis_qty ELSE 0 END), 0)::numeric AS anvis_simulado,
    COALESCE(SUM(CASE WHEN p.period_sk = 3 AND e.event_name =  'Simulador' THEN gh.gvntype_hour_iit_qty ELSE 0 END), 0)::numeric AS iit_simulado
FROM operations.person_hour ph
JOIN operations.flight f ON f.flight_sk = ph.person_hour_flight_fk
JOIN operations.period p ON p.period_sk = ph.person_hour_period_fk
JOIN operations.event  e ON e.event_sk = f.flight_event_fk
LEFT JOIN operations.gvntype_hour gh
    ON gh.gvntype_hour_flight_fk = ph.person_hour_flight_fk
   AND gh.gvntype_hour_person_fk = f.flight_person_cta_fk
WHERE f.flight_person_cta_fk = ph.person_hour_person_fk
  AND f.flight_date >= $1
  AND f.flight_date <  $2
  AND f.flight_escuadrilla_fk = $3;


-- name: GetDynamicPasajeros :many
SELECT
    pt.passenger_type_name        AS tipo,
    SUM(p.passenger_qty)::int     AS cantidad
FROM operations.passenger p
JOIN operations.passenger_type pt ON pt.passenger_type_sk = p.passenger_type_fk
JOIN operations.flight f          ON f.flight_sk = p.passenger_flight_fk
WHERE f.flight_date >= $1
  AND f.flight_date <  $2
  AND f.flight_escuadrilla_fk = $3
GROUP BY pt.passenger_type_name
HAVING SUM(p.passenger_qty) > 0
ORDER BY SUM(p.passenger_qty) DESC;


-- name: GetDynamicHorasCapba :many
SELECT
    c.capba_name                              AS capba,
    ROUND(SUM(ch.capba_hour_qty), 1)::numeric AS horas
FROM operations.capba_hour ch
JOIN operations.capba c  ON c.capba_id = ch.capba_capba_fk
JOIN operations.flight f ON f.flight_sk = ch.capba_flight_fk
WHERE f.flight_date >= $1
  AND f.flight_date <  $2
  AND f.flight_escuadrilla_fk = $3
GROUP BY c.capba_name
HAVING SUM(ch.capba_hour_qty) > 0
ORDER BY SUM(ch.capba_hour_qty) DESC;
