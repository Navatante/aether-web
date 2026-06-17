-- ============================================================
-- Training (Hito 4, lote 3)
--
-- Reimplementa sp_get_adiestramiento + sp_get_instruccion.
-- En vez de un SP gigante con FOR JSON anidado, troceamos en queries
-- pequeñas que el service compone en el shape final.
-- ============================================================


-- =============== adiestramiento ===============

-- name: AdiestramientoPapeletas :many
-- Papeletas filtradas por block IN ($1) y plan IN ('Adi Básico', 'Adi Avanzado').
SELECT papeleta_sk, papeleta_name, papeleta_description, papeleta_block, papeleta_plan,
       papeleta_pilot_crp_value, papeleta_dv_crp_value, papeleta_expiration, papeleta_order
FROM operations.papeleta
WHERE papeleta_plan IN ('Adiestramiento Básico', 'Adiestramiento Avanzado')
  AND papeleta_block = ANY($1::text[])
  AND papeleta_escuadrilla_fk = $2
ORDER BY papeleta_plan, papeleta_order NULLS LAST, papeleta_block, papeleta_name;

-- name: AdiestramientoPersonas :many
-- Por persona (filtrada por rol/escuadrilla): full_name, CRP, días sin volar/real/simulador.
WITH tripulantes AS (
    SELECT v.person_sk, v.person_nk, v.order_position, v.person_rol,
           v.person_rank, v.person_name, v.person_last_name_1, v.person_last_name_2
    FROM detall.v_person_ordered v
    WHERE v.person_rol = ANY($1::text[])
      AND v.person_current_flag = TRUE
      AND v.person_escuadrilla_fk = $2
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
    WHERE p.person_escuadrilla_fk = $2
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
dias_volar AS (
    SELECT p.person_sk,
        (CURRENT_DATE - MAX(f.flight_date))::int AS dias_sin_volar,
        (CURRENT_DATE - MAX(CASE WHEN LOWER(e.event_name) NOT LIKE '%simulador%' THEN f.flight_date END))::int AS dias_sin_vuelo_real,
        (CURRENT_DATE - MAX(CASE WHEN LOWER(e.event_name) LIKE '%simulador%' THEN f.flight_date END))::int AS dias_sin_simulador
    FROM detall.person p
    JOIN operations.person_hour ph ON ph.person_hour_person_fk = p.person_sk
    JOIN operations.flight      f  ON f.flight_sk = ph.person_hour_flight_fk
    JOIN operations.event       e  ON e.event_sk = f.flight_event_fk
    GROUP BY p.person_sk
)
SELECT
    t.person_sk,
    t.person_nk,
    t.order_position,
    BTRIM(t.person_rank || ' ' || t.person_name || ' ' || t.person_last_name_1 || ' ' || t.person_last_name_2)::text AS full_name,
    LEAST(COALESCE(c.crp_raw, 0), 100)::int AS crp,
    COALESCE(d.dias_sin_volar, -1)::int       AS dias_sin_volar,
    COALESCE(d.dias_sin_vuelo_real, -1)::int  AS dias_sin_vuelo_real,
    COALESCE(d.dias_sin_simulador, -1)::int   AS dias_sin_simulador
FROM tripulantes t
LEFT JOIN crp_por_persona c ON c.person_sk = t.person_sk
LEFT JOIN dias_volar      d ON d.person_sk = t.person_sk
ORDER BY t.order_position;

-- name: AdiestramientoPapeletasRealizadas :many
-- Última papeleta por (persona, session): días transcurridos, restantes, estado.
-- Filtramos por personas con rol en $1 y escuadrilla = $2.
-- period_fk = 0 ⇒ todos los periodos; 1/2/3 ⇒ solo papeletas voladas en ese periodo
-- (Día / Noche convencional / GVN), recalculando la "más reciente" dentro del periodo.
WITH papeletas_recientes AS (
    SELECT
        pcc.papeleta_crew_count_person_fk  AS person_fk,
        pcc.papeleta_crew_count_session_fk AS session_fk,
        (CURRENT_DATE - ff.flight_date)::int AS dias_transcurridos,
        ROW_NUMBER() OVER (
            PARTITION BY pcc.papeleta_crew_count_person_fk, pcc.papeleta_crew_count_session_fk
            ORDER BY ff.flight_date DESC
        ) AS rn
    FROM operations.papeleta_crew_count pcc
    JOIN operations.flight ff ON ff.flight_sk = pcc.papeleta_crew_count_flight_fk
    WHERE (sqlc.arg(period_fk)::int = 0 OR pcc.papeleta_crew_count_period_fk = sqlc.arg(period_fk)::int)
)
SELECT
    pr.person_fk AS person_sk,
    pr.session_fk,
    pr.dias_transcurridos,
    (dp.papeleta_expiration - pr.dias_transcurridos)::int AS dias_restantes,
    CASE
        WHEN pr.dias_transcurridos >= dp.papeleta_expiration THEN 'Expirado'
        WHEN pr.dias_transcurridos >= (dp.papeleta_expiration * 0.8) THEN 'Alerta'
        ELSE 'Vigente'
    END::text AS estado
FROM papeletas_recientes pr
JOIN operations.papeleta dp ON dp.papeleta_sk = pr.session_fk
JOIN detall.person p ON p.person_sk = pr.person_fk
WHERE pr.rn = 1
  AND dp.papeleta_expiration IS NOT NULL
  AND p.person_rol = ANY($1::text[])
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $2;


-- =============== instruccion ===============

-- name: InstruccionPapeletas :many
SELECT papeleta_sk, papeleta_name, papeleta_description, papeleta_block, papeleta_plan,
       papeleta_pilot_crp_value, papeleta_dv_crp_value, papeleta_expiration, papeleta_order
FROM operations.papeleta
WHERE papeleta_plan = ANY($1::text[])
  AND papeleta_escuadrilla_fk = $2
ORDER BY papeleta_plan, papeleta_order NULLS LAST, papeleta_block, papeleta_name;

-- name: InstruccionPersonas :many
SELECT
    p.person_sk,
    p.person_nk,
    BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' || p.person_last_name_2)::text AS full_name,
    p.order_position
FROM detall.v_person_ordered p
WHERE p.person_rol = ANY($1::text[])
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $2
ORDER BY p.order_position;

-- name: InstruccionPapeletasRealizadas :many
-- Última papeleta (MAX fecha) por (persona, session_fk) limitada a planes en $1.
-- Una papeleta se considera realizada tanto si se voló (papeleta_crew_count)
-- como si se impartió en Ground School (operations.ground_school).
SELECT
    person_sk,
    session_fk,
    MAX(fecha)::date AS flight_date
FROM (
    SELECT
        pcc.papeleta_crew_count_person_fk  AS person_sk,
        pcc.papeleta_crew_count_session_fk AS session_fk,
        f.flight_date                      AS fecha
    FROM operations.papeleta_crew_count pcc
    JOIN operations.papeleta dp ON dp.papeleta_sk = pcc.papeleta_crew_count_session_fk
    JOIN operations.flight  f  ON f.flight_sk = pcc.papeleta_crew_count_flight_fk
    JOIN detall.person      p  ON p.person_sk = pcc.papeleta_crew_count_person_fk
    WHERE dp.papeleta_plan = ANY($1::text[])
      AND p.person_rol = ANY($2::text[])
      AND p.person_current_flag = TRUE
      AND p.person_escuadrilla_fk = $3

    UNION ALL

    SELECT
        gs.ground_school_person_fk   AS person_sk,
        gs.ground_school_papeleta_fk AS session_fk,
        gs.ground_school_datetime::date AS fecha
    FROM operations.ground_school gs
    JOIN operations.papeleta dp ON dp.papeleta_sk = gs.ground_school_papeleta_fk
    JOIN detall.person      p  ON p.person_sk = gs.ground_school_person_fk
    WHERE dp.papeleta_plan = ANY($1::text[])
      AND p.person_rol = ANY($2::text[])
      AND p.person_current_flag = TRUE
      AND p.person_escuadrilla_fk = $3
      AND gs.ground_school_escuadrilla_fk = $3
) realizadas
GROUP BY person_sk, session_fk;
