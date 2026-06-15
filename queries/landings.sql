-- ============================================================
-- Landings & Approaches (tomas y aproximaciones por piloto)
--
-- Agrega operations.landing (tomas) y operations.approach (aproximaciones)
-- por persona sobre un rango de fechas resuelto en Go (mismo parser que hours).
--
-- Tomas (landing_place_fk / landing_period_fk):
--   place: 1 Tierra, 2 Monospot, 3 Multispot, 4 Carrier
--   period: 1 Día, 2 Noche convencional, 3 GVN
-- Aproximaciones (app_type_fk):
--   1 Precisión, 2 No precisión (Instrumental); 3 Transition Down, 4 Search Pattern (SAR)
--
-- RLS explícita: $3 = escuadrilla_fk. $4 = roles permitidos (array vacío = todos).
-- El rango de fechas filtra por f.flight_date (la toma/aprox. hereda la fecha del vuelo).
-- ============================================================

-- name: LandingsApproachesByPilot :many
WITH
landing_agg AS (
    SELECT
        l.landing_person_fk AS person_sk,
        SUM(CASE WHEN l.landing_place_fk = 1 AND l.landing_period_fk = 1 THEN l.landing_qty ELSE 0 END)::int AS tierra_day,
        SUM(CASE WHEN l.landing_place_fk = 1 AND l.landing_period_fk = 2 THEN l.landing_qty ELSE 0 END)::int AS tierra_night,
        SUM(CASE WHEN l.landing_place_fk = 1 AND l.landing_period_fk = 3 THEN l.landing_qty ELSE 0 END)::int AS tierra_gvn,
        SUM(CASE WHEN l.landing_place_fk = 2 AND l.landing_period_fk = 1 THEN l.landing_qty ELSE 0 END)::int AS mono_day,
        SUM(CASE WHEN l.landing_place_fk = 2 AND l.landing_period_fk = 2 THEN l.landing_qty ELSE 0 END)::int AS mono_night,
        SUM(CASE WHEN l.landing_place_fk = 2 AND l.landing_period_fk = 3 THEN l.landing_qty ELSE 0 END)::int AS mono_gvn,
        SUM(CASE WHEN l.landing_place_fk = 3 AND l.landing_period_fk = 1 THEN l.landing_qty ELSE 0 END)::int AS multi_day,
        SUM(CASE WHEN l.landing_place_fk = 3 AND l.landing_period_fk = 2 THEN l.landing_qty ELSE 0 END)::int AS multi_night,
        SUM(CASE WHEN l.landing_place_fk = 3 AND l.landing_period_fk = 3 THEN l.landing_qty ELSE 0 END)::int AS multi_gvn,
        SUM(CASE WHEN l.landing_place_fk = 4 AND l.landing_period_fk = 1 THEN l.landing_qty ELSE 0 END)::int AS carrier_day,
        SUM(CASE WHEN l.landing_place_fk = 4 AND l.landing_period_fk = 2 THEN l.landing_qty ELSE 0 END)::int AS carrier_night,
        SUM(CASE WHEN l.landing_place_fk = 4 AND l.landing_period_fk = 3 THEN l.landing_qty ELSE 0 END)::int AS carrier_gvn
    FROM operations.landing l
    JOIN operations.flight f ON l.landing_flight_fk = f.flight_sk
    WHERE f.flight_date >= $1 AND f.flight_date <= $2
    GROUP BY l.landing_person_fk
),
approach_agg AS (
    SELECT
        a.app_person_fk AS person_sk,
        SUM(CASE WHEN a.app_type_fk = 1 THEN a.app_qty ELSE 0 END)::int AS app_precision,
        SUM(CASE WHEN a.app_type_fk = 2 THEN a.app_qty ELSE 0 END)::int AS app_no_precision,
        SUM(CASE WHEN a.app_type_fk = 3 THEN a.app_qty ELSE 0 END)::int AS app_transition_down,
        SUM(CASE WHEN a.app_type_fk = 4 THEN a.app_qty ELSE 0 END)::int AS app_search_pattern
    FROM operations.approach a
    JOIN operations.flight f ON a.app_flight_fk = f.flight_sk
    WHERE f.flight_date >= $1 AND f.flight_date <= $2
    GROUP BY a.app_person_fk
)
SELECT
    p.person_nk,
    COALESCE(l.tierra_day,   0)::int AS tierra_day_qty,
    COALESCE(l.tierra_night, 0)::int AS tierra_night_qty,
    COALESCE(l.tierra_gvn,   0)::int AS tierra_gvn_qty,
    COALESCE(l.mono_day,     0)::int AS mono_day_qty,
    COALESCE(l.mono_night,   0)::int AS mono_night_qty,
    COALESCE(l.mono_gvn,     0)::int AS mono_gvn_qty,
    COALESCE(l.multi_day,    0)::int AS multi_day_qty,
    COALESCE(l.multi_night,  0)::int AS multi_night_qty,
    COALESCE(l.multi_gvn,    0)::int AS multi_gvn_qty,
    COALESCE(l.carrier_day,  0)::int AS carrier_day_qty,
    COALESCE(l.carrier_night,0)::int AS carrier_night_qty,
    COALESCE(l.carrier_gvn,  0)::int AS carrier_gvn_qty,
    COALESCE(a.app_precision,       0)::int AS app_precision_qty,
    COALESCE(a.app_no_precision,    0)::int AS app_no_precision_qty,
    COALESCE(a.app_transition_down, 0)::int AS app_transition_down_qty,
    COALESCE(a.app_search_pattern,  0)::int AS app_search_pattern_qty
FROM detall.v_person_ordered p
LEFT JOIN landing_agg  l ON l.person_sk = p.person_sk
LEFT JOIN approach_agg a ON a.person_sk = p.person_sk
WHERE p.person_nk IS NOT NULL
  AND p.person_escuadrilla_fk = $3
  AND (COALESCE(cardinality($4::text[]), 0) = 0 OR p.person_rol = ANY($4::text[]))
ORDER BY p.order_position;
