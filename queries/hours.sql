-- ============================================================
-- Hours (Hito 4, lote 6)
--
-- Reimplementa sp_get_personNH90PeriodHours. El rango de fechas se
-- resuelve en Go (mismo parser que dashboard) y se pasan ya como dates.
-- Esto evita lógica de fechas en SQL y mantiene la query pura.
--
-- RLS explícita: $3 = escuadrilla_fk.
-- $4 = roles permitidos (array vacío = todos los roles).
-- ============================================================

-- name: NH90PeriodHours :many
WITH
person_hour_agg AS (
    SELECT
        ph.person_hour_person_fk AS person_sk,
        SUM(CASE WHEN ph.person_hour_period_fk = 1 AND e.event_name <> 'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END)::numeric AS real_day,
        SUM(CASE WHEN ph.person_hour_period_fk = 1 AND e.event_name =  'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END)::numeric AS sim_day,
        SUM(CASE WHEN ph.person_hour_period_fk = 2 AND e.event_name <> 'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END)::numeric AS real_night,
        SUM(CASE WHEN ph.person_hour_period_fk = 2 AND e.event_name =  'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END)::numeric AS sim_night,
        SUM(CASE WHEN ph.person_hour_period_fk = 3 AND e.event_name <> 'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END)::numeric AS real_gvn,
        SUM(CASE WHEN ph.person_hour_period_fk = 3 AND e.event_name =  'Simulador' THEN ph.person_hour_hour_qty ELSE 0 END)::numeric AS sim_gvn
    FROM operations.person_hour ph
    JOIN operations.flight  f ON ph.person_hour_flight_fk = f.flight_sk
    JOIN operations.event   e ON f.flight_event_fk = e.event_sk
    WHERE f.flight_date >= $1 AND f.flight_date <= $2
    GROUP BY ph.person_hour_person_fk
),
real_agg AS (
    SELECT
        previous_model_real_hours_person_fk AS person_sk,
        SUM(previous_model_real_hours_day)::numeric        AS day,
        SUM(previous_model_real_hours_conv_night)::numeric AS night,
        SUM(previous_model_real_hours_gvn)::numeric        AS gvn
    FROM operations.previous_model_real_hour
    WHERE previous_model_real_hours_date >= $1 AND previous_model_real_hours_date <= $2
    GROUP BY previous_model_real_hours_person_fk
),
sim_agg AS (
    SELECT
        previous_model_sim_hours_person_fk AS person_sk,
        SUM(previous_model_sim_hours_day)::numeric        AS day,
        SUM(previous_model_sim_hours_conv_night)::numeric AS night,
        SUM(previous_model_sim_hours_gvn)::numeric        AS gvn
    FROM operations.previous_model_sim_hour
    WHERE previous_model_sim_hours_date >= $1 AND previous_model_sim_hours_date <= $2
    GROUP BY previous_model_sim_hours_person_fk
)
SELECT
    p.person_nk,
    -- Días
    ROUND(COALESCE(ph.real_day, 0)  + COALESCE(r.day,   0), 1)::numeric AS real_day_hour_qty,
    ROUND(COALESCE(ph.sim_day,  0)  + COALESCE(s.day,   0), 1)::numeric AS sim_day_hour_qty,
    ROUND(COALESCE(ph.real_day, 0)  + COALESCE(ph.sim_day, 0)
        + COALESCE(r.day, 0) + COALESCE(s.day, 0), 1)::numeric            AS total_day_hour_qty,
    -- Noche
    ROUND(COALESCE(ph.real_night, 0) + COALESCE(r.night, 0), 1)::numeric AS real_night_hour_qty,
    ROUND(COALESCE(ph.sim_night,  0) + COALESCE(s.night, 0), 1)::numeric AS sim_night_hour_qty,
    ROUND(COALESCE(ph.real_night, 0) + COALESCE(ph.sim_night, 0)
        + COALESCE(r.night, 0) + COALESCE(s.night, 0), 1)::numeric        AS total_night_hour_qty,
    -- GVN
    ROUND(COALESCE(ph.real_gvn, 0)  + COALESCE(r.gvn, 0), 1)::numeric    AS real_gvn_hour_qty,
    ROUND(COALESCE(ph.sim_gvn,  0)  + COALESCE(s.gvn, 0), 1)::numeric    AS sim_gvn_hour_qty,
    ROUND(COALESCE(ph.real_gvn, 0)  + COALESCE(ph.sim_gvn, 0)
        + COALESCE(r.gvn, 0) + COALESCE(s.gvn, 0), 1)::numeric            AS total_gvn_hour_qty
FROM detall.v_person_ordered p
LEFT JOIN person_hour_agg ph ON ph.person_sk = p.person_sk
LEFT JOIN real_agg        r  ON r.person_sk  = p.person_sk
LEFT JOIN sim_agg         s  ON s.person_sk  = p.person_sk
WHERE p.person_nk IS NOT NULL
  AND p.person_escuadrilla_fk = $3
  AND (COALESCE(cardinality($4::text[]), 0) = 0 OR p.person_rol = ANY($4::text[]))
ORDER BY p.order_position;
