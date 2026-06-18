-- ============================================================
-- Ratings (Hito 4, lote 5)
--
-- Reimplementa los 5 SPs de ratings (model, operational, generalTactical,
-- leadership, maintenance) + CRUD de crew_qualification y notcrew_qualification.
--
-- Bug fixes vs Rust:
--   - INSERTs originales NO setean escuadrilla_fk (NOT NULL en BD) → fallarían.
--     Aquí se inyecta desde la sesión.
--   - DELETEs originales no filtran por escuadrilla. Aquí WHERE incluye RLS.
-- ============================================================


-- =============== CRUD crew_qualification ===============

-- name: AddCrewRating :one
INSERT INTO operations.crew_qualification (
    person_fk, crew_ratings_fk, date_qualified, crew_qualification_escuadrilla_fk
) VALUES ($1, $2, $3, $4)
RETURNING crew_rating_sk;

-- name: DeleteCrewRating :execrows
DELETE FROM operations.crew_qualification
WHERE crew_rating_sk = $1
  AND crew_qualification_escuadrilla_fk = $2;


-- =============== CRUD notcrew_qualification ===============

-- name: AddNotCrewRating :one
INSERT INTO detall.notcrew_qualification (
    person_fk, notcrew_rating_fk, date_qualified, notcrew_qualification_escuadrilla_fk
) VALUES ($1, $2, $3, $4)
RETURNING notcrew_ratings_sk;

-- name: DeleteNotCrewRating :execrows
DELETE FROM detall.notcrew_qualification
WHERE notcrew_ratings_sk = $1
  AND notcrew_qualification_escuadrilla_fk = $2;


-- =============== sp_get_modelRatings ===============

-- name: RatingsCatalog :many
-- Catálogo filtrable por type/role para componer múltiples sub-listas.
-- $1 = type (NULL/empty = todos), $2 = role[] (NULL/empty = todos).
SELECT crew_rating_sk, name, abbreviation, type, role
FROM operations.crew_rating_type
WHERE ($1::text IS NULL OR $1 = '' OR type = $1)
  AND (COALESCE(cardinality($2::text[]), 0) = 0 OR role = ANY($2::text[]))
ORDER BY crew_rating_sk;

-- name: NotCrewRatingsCatalog :many
SELECT notcrew_rating_sk, notcrew_rating_name, notcrew_rating_abrv
FROM detall.notcrew_rating_type
ORDER BY notcrew_rating_sk;

-- name: PersonsByRoles :many
-- Personas activas filtradas por rol[] dentro de una escuadrilla.
SELECT
    p.person_sk,
    p.person_nk,
    p.order_position,
    BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' || p.person_last_name_2)::text AS full_name,
    p.person_rol
FROM detall.v_person_ordered p
WHERE p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $1
  AND p.person_rol = ANY($2::text[])
ORDER BY p.order_position;

-- name: CrewQualificationsByPersonAndType :many
-- Calificaciones por persona, filtradas por (type, role[]) y escuadrilla.
-- Sólo las que tienen date_qualified, ordenadas por crew_ratings_fk.
SELECT
    cq.crew_rating_sk,
    cq.person_fk,
    cq.crew_ratings_fk,
    TO_CHAR(cq.date_qualified, 'YYYY-MM-DD')::text AS date_qualified
FROM operations.crew_qualification cq
JOIN operations.crew_rating_type cr ON cq.crew_ratings_fk = cr.crew_rating_sk
JOIN detall.person p ON p.person_sk = cq.person_fk
WHERE cq.date_qualified IS NOT NULL
  AND p.person_escuadrilla_fk = $1
  AND cr.type = $2
  AND ($3::text[] IS NULL OR COALESCE(cardinality($3::text[]), 0) = 0 OR cr.role = ANY($3::text[]))
ORDER BY cq.person_fk, cq.crew_ratings_fk;

-- name: NotCrewQualificationsByPerson :many
SELECT
    ncq.notcrew_ratings_sk,
    ncq.person_fk,
    ncq.notcrew_rating_fk,
    TO_CHAR(ncq.date_qualified, 'YYYY-MM-DD')::text AS date_qualified
FROM detall.notcrew_qualification ncq
JOIN detall.person p ON p.person_sk = ncq.person_fk
WHERE ncq.date_qualified IS NOT NULL
  AND p.person_escuadrilla_fk = $1
ORDER BY ncq.person_fk, ncq.notcrew_rating_fk;


-- =============== sp_get_operationalRatings ===============

-- name: OperationalPersonMetrics :many
-- Devuelve por persona (Piloto/Dotación/Dotación-Nadador) las métricas necesarias
-- para calcular calificacion_abrv en Go: horas_365, crp_total, h2p_reciente,
-- dv_reciente, pi1_piloto, pi2_piloto, pi1_dotacion, pi2_dotacion.
-- $1 = escuadrilla_fk
WITH horas_vuelo AS (
    SELECT person_sk, SUM(horas)::numeric AS total_horas_365 FROM (
        SELECT jph.person_hour_person_fk AS person_sk, jph.person_hour_hour_qty AS horas
        FROM operations.person_hour jph
        JOIN operations.flight ff ON jph.person_hour_flight_fk = ff.flight_sk
        WHERE ff.flight_date >= CURRENT_DATE - 365
        UNION ALL
        SELECT pmrh.extra_model_real_hours_person_fk,
               (pmrh.extra_model_real_hours_day + pmrh.extra_model_real_hours_conv_night + pmrh.extra_model_real_hours_gvn)
        FROM operations.extra_model_real_hour pmrh
        WHERE pmrh.extra_model_real_hours_date >= CURRENT_DATE - 365
        UNION ALL
        SELECT pmsh.extra_model_sim_hours_person_fk,
               (pmsh.extra_model_sim_hours_day + pmsh.extra_model_sim_hours_conv_night + pmsh.extra_model_sim_hours_gvn)
        FROM operations.extra_model_sim_hour pmsh
        WHERE pmsh.extra_model_sim_hours_date >= CURRENT_DATE - 365
    ) th GROUP BY person_sk
),
papeletas_validas AS (
    SELECT DISTINCT pcc.papeleta_crew_count_person_fk AS person_sk, pap.papeleta_sk,
        CASE WHEN p.person_rol = 'Piloto' THEN pap.papeleta_pilot_crp_value ELSE pap.papeleta_dv_crp_value END AS crp_value
    FROM operations.papeleta_crew_count pcc
    JOIN operations.papeleta pap ON pcc.papeleta_crew_count_session_fk = pap.papeleta_sk
    JOIN operations.flight   ff  ON pcc.papeleta_crew_count_flight_fk  = ff.flight_sk
    JOIN detall.person       p   ON pcc.papeleta_crew_count_person_fk  = p.person_sk
    WHERE p.person_escuadrilla_fk = $1
      AND pap.papeleta_expiration IS NOT NULL
      AND ff.flight_date >= (CURRENT_DATE - pap.papeleta_expiration)
      AND (
            (p.person_rol = 'Piloto' AND pap.papeleta_pilot_crp_value IS NOT NULL)
         OR (p.person_rol <> 'Piloto' AND pap.papeleta_dv_crp_value IS NOT NULL)
      )
),
crp_por_persona AS (
    SELECT person_sk, LEAST(SUM(crp_value), 100)::numeric AS crp_total
    FROM papeletas_validas
    GROUP BY person_sk
),
calificaciones_recientes AS (
    SELECT cq.person_fk AS person_sk,
        BOOL_OR(cr.abbreviation = 'H2P' AND cq.date_qualified IS NOT NULL
                AND (CURRENT_DATE - cq.date_qualified) < 365) AS h2p_reciente,
        BOOL_OR(cr.abbreviation = 'DV' AND cq.date_qualified IS NOT NULL
                AND (CURRENT_DATE - cq.date_qualified) < 365) AS dv_reciente
    FROM operations.crew_qualification cq
    JOIN operations.crew_rating_type cr ON cq.crew_ratings_fk = cr.crew_rating_sk
    WHERE cr.abbreviation IN ('H2P','DV')
    GROUP BY cq.person_fk
),
planes_papeletas AS (
    SELECT pcc.papeleta_crew_count_person_fk AS person_sk,
           pap.papeleta_plan,
           COUNT(DISTINCT pap.papeleta_sk) AS papeletas_completadas,
           (SELECT COUNT(*) FROM operations.papeleta WHERE papeleta_plan = pap.papeleta_plan) AS papeletas_requeridas
    FROM operations.papeleta_crew_count pcc
    JOIN operations.papeleta pap ON pcc.papeleta_crew_count_session_fk = pap.papeleta_sk
    WHERE pap.papeleta_plan IS NOT NULL
    GROUP BY pcc.papeleta_crew_count_person_fk, pap.papeleta_plan
),
plan_completado AS (
    SELECT person_sk, papeleta_plan,
           (papeletas_completadas >= papeletas_requeridas) AS completado
    FROM planes_papeletas
)
-- Exenciones PI1 (datos legacy hardcoded del SP original) se aplican en IN
-- en lugar de un CTE con VALUES porque sqlc descarta el SELECT list
-- cuando ve `SELECT * FROM (VALUES ...)` o aliasing complejo.
SELECT
    p.person_sk,
    p.person_nk,
    p.order_position,
    BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' || p.person_last_name_2)::text AS full_name,
    p.person_rol,
    COALESCE(hv.total_horas_365, 0)::numeric AS horas_365,
    COALESCE(crp.crp_total, 0)::numeric AS crp_total,
    COALESCE(cr.h2p_reciente, FALSE) AS h2p_reciente,
    COALESCE(cr.dv_reciente, FALSE)  AS dv_reciente,
    -- ::bool fuerza el tipo en sqlc; COALESCE evita NULL cuando LEFT JOIN está vacío.
    (COALESCE(BOOL_OR(
        (pc.papeleta_plan = 'Instrucción 1 Piloto' AND pc.completado)
        OR (p.person_rol = 'Piloto' AND p.person_sk IN (1,2,3,4,5,6,7,9,10,18,19,20,30,66,67,68))
    ), FALSE))::bool AS pi1_piloto,
    (COALESCE(BOOL_OR(pc.papeleta_plan = 'Instrucción 2 Piloto' AND pc.completado), FALSE))::bool AS pi2_piloto,
    (COALESCE(BOOL_OR(
        (pc.papeleta_plan = 'Instrucción 1 Dotación' AND pc.completado)
        OR (p.person_rol IN ('Dotación','Dotación/Nadador')
            AND p.person_sk IN (11,12,31,34,35,40,41,45,46,58,61,64,69,70))
    ), FALSE))::bool AS pi1_dotacion,
    (COALESCE(BOOL_OR(pc.papeleta_plan = 'Instrucción 2 Dotación' AND pc.completado), FALSE))::bool AS pi2_dotacion
FROM detall.v_person_ordered p
LEFT JOIN horas_vuelo            hv ON p.person_sk = hv.person_sk
LEFT JOIN crp_por_persona        crp ON p.person_sk = crp.person_sk
LEFT JOIN calificaciones_recientes cr ON p.person_sk = cr.person_sk
LEFT JOIN plan_completado        pc ON p.person_sk = pc.person_sk
WHERE p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $1
  AND p.person_rol IN ('Piloto','Dotación','Dotación/Nadador')
GROUP BY p.person_sk, p.person_nk, p.order_position, p.person_rank, p.person_name,
         p.person_last_name_1, p.person_last_name_2, p.person_rol,
         hv.total_horas_365, crp.crp_total, cr.h2p_reciente, cr.dv_reciente
ORDER BY p.order_position;


-- =============== sp_get_generalTacticalRatings ===============

-- name: GeneralTacticalPersonMetrics :many
-- Métricas detalladas por persona para calcular el `state` de las
-- calificaciones generales/tácticas (crew_ratings_fk 12-18).
-- $1 = escuadrilla_fk
WITH
horas_365 AS (
    SELECT person_sk,
        SUM(d)::numeric AS vfr_diurno_365,
        SUM(n)::numeric AS vfr_nocturno_365,
        SUM(g)::numeric AS gvn_365
    FROM (
        SELECT jph.person_hour_person_fk AS person_sk,
            CASE WHEN jph.person_hour_period_fk = 1 THEN jph.person_hour_hour_qty ELSE 0 END AS d,
            CASE WHEN jph.person_hour_period_fk IN (2,3) THEN jph.person_hour_hour_qty ELSE 0 END AS n,
            CASE WHEN jph.person_hour_period_fk = 3 THEN jph.person_hour_hour_qty ELSE 0 END AS g
        FROM operations.person_hour jph
        JOIN operations.flight ff ON jph.person_hour_flight_fk = ff.flight_sk
        WHERE ff.flight_date >= CURRENT_DATE - 365
        UNION ALL
        SELECT pmrh.extra_model_real_hours_person_fk,
            pmrh.extra_model_real_hours_day, pmrh.extra_model_real_hours_conv_night, pmrh.extra_model_real_hours_gvn
        FROM operations.extra_model_real_hour pmrh
        WHERE pmrh.extra_model_real_hours_date >= CURRENT_DATE - 365
        UNION ALL
        SELECT pmsh.extra_model_sim_hours_person_fk,
            pmsh.extra_model_sim_hours_day, pmsh.extra_model_sim_hours_conv_night, pmsh.extra_model_sim_hours_gvn
        FROM operations.extra_model_sim_hour pmsh
        WHERE pmsh.extra_model_sim_hours_date >= CURRENT_DATE - 365
    ) th GROUP BY person_sk
),
horas_gvn_90 AS (
    SELECT person_sk, SUM(g)::numeric AS gvn_90 FROM (
        SELECT jph.person_hour_person_fk AS person_sk, jph.person_hour_hour_qty AS g
        FROM operations.person_hour jph
        JOIN operations.flight ff ON jph.person_hour_flight_fk = ff.flight_sk
        WHERE ff.flight_date >= CURRENT_DATE - 90 AND jph.person_hour_period_fk = 3
        UNION ALL
        SELECT pmrh.extra_model_real_hours_person_fk, pmrh.extra_model_real_hours_gvn
        FROM operations.extra_model_real_hour pmrh
        WHERE pmrh.extra_model_real_hours_date >= CURRENT_DATE - 90
        UNION ALL
        SELECT pmsh.extra_model_sim_hours_person_fk, pmsh.extra_model_sim_hours_gvn
        FROM operations.extra_model_sim_hour pmsh
        WHERE pmsh.extra_model_sim_hours_date >= CURRENT_DATE - 90
    ) th GROUP BY person_sk
),
horas_ifr_365 AS (
    -- IFT hours en últimos 365 días.
    SELECT iph.ift_hour_person_fk AS person_sk, SUM(iph.ift_hour_qty)::numeric AS ifr_365
    FROM operations.ift_hour iph
    JOIN operations.flight ff ON iph.ift_hour_flight_fk = ff.flight_sk
    WHERE ff.flight_date >= CURRENT_DATE - 365
    GROUP BY iph.ift_hour_person_fk
),
apps_365 AS (
    -- Aproximaciones IFR de precisión y no-precisión por persona.
    -- ifr_app_type.type='Precisión' vs 'No precisión'.
    SELECT a.app_person_fk AS person_sk,
        SUM(CASE WHEN it.ifr_app_type_type = 'Precisión' THEN a.app_qty ELSE 0 END)::int AS app_precision_365,
        SUM(CASE WHEN it.ifr_app_type_type = 'No precisión' THEN a.app_qty ELSE 0 END)::int AS app_no_precision_365
    FROM operations.approach a
    JOIN operations.flight ff ON a.app_flight_fk = ff.flight_sk
    JOIN operations.ifr_app_type it ON a.app_type_fk = it.ifr_app_type_sk
    WHERE ff.flight_date >= CURRENT_DATE - 365
    GROUP BY a.app_person_fk
),
tomas_182 AS (
    -- Aterrizajes por (persona × periodo × tipo de buque) en últimos 182 días.
    -- landing.landing_period_fk: 1=día, 2=noche convencional, 3=GVN.
    -- landing_place.landing_place_name: 'Buque/Multi-Spot', 'Buque/Mono-Spot', 'Buque/LHD-LPD (Carrier)', etc.
    SELECT l.landing_person_fk AS person_sk,
        SUM(CASE WHEN l.landing_period_fk = 1 AND lp.landing_place_name LIKE 'Buque%' THEN l.landing_qty ELSE 0 END)::int AS dia_buque,
        SUM(CASE WHEN l.landing_period_fk = 1 AND lp.landing_place_name ILIKE '%mono%' THEN l.landing_qty ELSE 0 END)::int AS dia_mono,
        SUM(CASE WHEN l.landing_period_fk = 1 AND lp.landing_place_name ILIKE '%multi%' THEN l.landing_qty ELSE 0 END)::int AS dia_multi,
        SUM(CASE WHEN l.landing_period_fk = 1 AND lp.landing_place_name ILIKE '%carrier%' THEN l.landing_qty ELSE 0 END)::int AS dia_carrier,
        SUM(CASE WHEN l.landing_period_fk = 2 AND lp.landing_place_name LIKE 'Buque%' THEN l.landing_qty ELSE 0 END)::int AS nocheconv_buque,
        SUM(CASE WHEN l.landing_period_fk = 2 AND lp.landing_place_name ILIKE '%mono%' THEN l.landing_qty ELSE 0 END)::int AS nocheconv_mono,
        SUM(CASE WHEN l.landing_period_fk = 2 AND lp.landing_place_name ILIKE '%multi%' THEN l.landing_qty ELSE 0 END)::int AS nocheconv_multi,
        SUM(CASE WHEN l.landing_period_fk = 2 AND lp.landing_place_name ILIKE '%carrier%' THEN l.landing_qty ELSE 0 END)::int AS nocheconv_carrier,
        SUM(CASE WHEN l.landing_period_fk = 3 AND lp.landing_place_name LIKE 'Buque%' THEN l.landing_qty ELSE 0 END)::int AS gvn_buque,
        SUM(CASE WHEN l.landing_period_fk = 3 AND lp.landing_place_name ILIKE '%mono%' THEN l.landing_qty ELSE 0 END)::int AS gvn_mono,
        SUM(CASE WHEN l.landing_period_fk = 3 AND lp.landing_place_name ILIKE '%multi%' THEN l.landing_qty ELSE 0 END)::int AS gvn_multi,
        SUM(CASE WHEN l.landing_period_fk = 3 AND lp.landing_place_name ILIKE '%carrier%' THEN l.landing_qty ELSE 0 END)::int AS gvn_carrier
    FROM operations.landing l
    JOIN operations.flight        ff ON l.landing_flight_fk = ff.flight_sk
    JOIN operations.landing_place lp ON l.landing_place_fk  = lp.landing_place_sk
    WHERE ff.flight_date >= CURRENT_DATE - 182
    GROUP BY l.landing_person_fk
)
SELECT
    p.person_sk,
    p.person_nk,
    p.order_position,
    BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' || p.person_last_name_2)::text AS full_name,
    p.person_rol,
    COALESCE(h.vfr_diurno_365, 0)::numeric    AS vfr_diurno_365,
    COALESCE(h.vfr_nocturno_365, 0)::numeric  AS vfr_nocturno_365,
    COALESCE(h.gvn_365, 0)::numeric           AS gvn_365,
    COALESCE(g.gvn_90, 0)::numeric            AS gvn_90,
    COALESCE(i.ifr_365, 0)::numeric           AS ifr_365,
    COALESCE(a.app_precision_365, 0)::int     AS app_precision_365,
    COALESCE(a.app_no_precision_365, 0)::int  AS app_no_precision_365,
    COALESCE(t.dia_buque, 0)::int             AS dia_buque,
    COALESCE(t.dia_mono, 0)::int              AS dia_mono,
    COALESCE(t.dia_multi, 0)::int             AS dia_multi,
    COALESCE(t.dia_carrier, 0)::int           AS dia_carrier,
    COALESCE(t.nocheconv_buque, 0)::int       AS nocheconv_buque,
    COALESCE(t.nocheconv_mono, 0)::int        AS nocheconv_mono,
    COALESCE(t.nocheconv_multi, 0)::int       AS nocheconv_multi,
    COALESCE(t.nocheconv_carrier, 0)::int     AS nocheconv_carrier,
    COALESCE(t.gvn_buque, 0)::int             AS gvn_buque,
    COALESCE(t.gvn_mono, 0)::int              AS gvn_mono,
    COALESCE(t.gvn_multi, 0)::int             AS gvn_multi,
    COALESCE(t.gvn_carrier, 0)::int           AS gvn_carrier
FROM detall.v_person_ordered p
LEFT JOIN horas_365     h ON p.person_sk = h.person_sk
LEFT JOIN horas_gvn_90  g ON p.person_sk = g.person_sk
LEFT JOIN horas_ifr_365 i ON p.person_sk = i.person_sk
LEFT JOIN apps_365      a ON p.person_sk = a.person_sk
LEFT JOIN tomas_182     t ON p.person_sk = t.person_sk
WHERE p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $1
  AND p.person_rol IN ('Piloto','Dotación','Dotación/Nadador')
ORDER BY p.order_position;

-- name: GeneralTacticalQualifications :many
-- Calificaciones generales/tácticas (crew_ratings_fk 12-18) por persona,
-- con date_qualified. El state se calcula en Go combinando con las métricas.
SELECT
    cq.crew_rating_sk,
    cq.person_fk,
    cq.crew_ratings_fk,
    TO_CHAR(cq.date_qualified, 'YYYY-MM-DD')::text AS date_qualified
FROM operations.crew_qualification cq
JOIN detall.person p ON p.person_sk = cq.person_fk
WHERE p.person_escuadrilla_fk = $1
  AND cq.crew_ratings_fk IN (12,13,14,15,16,17,18)
ORDER BY cq.person_fk, cq.crew_ratings_fk;
