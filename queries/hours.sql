-- ============================================================
-- Hours (Hito 4, lote 6)
--
-- Reimplementa sp_get_personNH90PeriodHours. El rango de fechas se
-- resuelve en Go (mismo parser que dashboard) y se pasan ya como dates.
-- Esto evita lógica de fechas en SQL y mantiene la query pura.
--
-- RLS explícita: $3 = escuadrilla_fk.
-- $4 = roles permitidos (array vacío = todos los roles).
-- $5 = incluir horas de arrastre (operations.previous_hour): modo "Totales".
--      previous_hour es acumulado vitalicio por persona (sin filtro de fecha) y
--      son horas reales, por lo que solo suman a la parte real (y al total).
--
-- Cambio de escuadrilla (el pasado se queda donde se voló): el roster siempre
-- se filtra por person_escuadrilla_fk actual ($3), así que una persona que se
-- mueve desaparece de la antigua. Para las horas registradas en Aether:
--   - modo por escuadrilla ($5=false): person_hour SOLO cuenta vuelos de la
--     escuadrilla actual (f.flight_escuadrilla_fk = $3) → "horas voladas aquí".
--   - modo Totales ($5=true): person_hour cruza escuadrillas para esa persona
--     (sin filtro de flight_escuadrilla_fk) → su histórico completo. Es una
--     exención acotada a la RLS-por-código: solo expone datos propios de
--     personas del roster actual, nunca de terceros.
-- previous_model_* y previous_hour son person-centric (sin escuadrilla_fk) y no
-- se ven afectados por este filtro.
-- ============================================================

-- name: EscuadrillaCreationDate :one
-- Fecha de creación de la escuadrilla; ancla el inicio del rango "histórico"
-- en hours.go (antes hardcodeado). $1 = escuadrilla_sk (de la sesión).
SELECT escuadrilla_creation_date
FROM detall.escuadrilla
WHERE escuadrilla_sk = $1;

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
    -- Totales ($5): histórico vitalicio → ignora el rango de fechas Y la escuadrilla.
    -- Por escuadrilla ($5=false): acota por rango $1/$2 y por la escuadrilla actual.
    WHERE ($5::bool OR (f.flight_date >= $1 AND f.flight_date <= $2))
      AND ($5::bool OR f.flight_escuadrilla_fk = $3)
    GROUP BY ph.person_hour_person_fk
),
real_agg AS (
    SELECT
        previous_model_real_hours_person_fk AS person_sk,
        SUM(previous_model_real_hours_day)::numeric        AS day,
        SUM(previous_model_real_hours_conv_night)::numeric AS night,
        SUM(previous_model_real_hours_gvn)::numeric        AS gvn
    FROM operations.previous_model_real_hour
    WHERE $5::bool OR (previous_model_real_hours_date >= $1 AND previous_model_real_hours_date <= $2)
    GROUP BY previous_model_real_hours_person_fk
),
sim_agg AS (
    SELECT
        previous_model_sim_hours_person_fk AS person_sk,
        SUM(previous_model_sim_hours_day)::numeric        AS day,
        SUM(previous_model_sim_hours_conv_night)::numeric AS night,
        SUM(previous_model_sim_hours_gvn)::numeric        AS gvn
    FROM operations.previous_model_sim_hour
    WHERE $5::bool OR (previous_model_sim_hours_date >= $1 AND previous_model_sim_hours_date <= $2)
    GROUP BY previous_model_sim_hours_person_fk
),
-- Horas de arrastre vitalicias por persona (modo "Totales"). El flag $5 las
-- activa; cuando es false, prev.* aporta 0 y la query equivale al modo NH90.
prev_agg AS (
    SELECT
        previous_hours_person_fk AS person_sk,
        CASE WHEN $5::bool THEN previous_hours_day        ELSE 0 END::numeric AS day,
        CASE WHEN $5::bool THEN previous_hours_conv_night ELSE 0 END::numeric AS night,
        CASE WHEN $5::bool THEN previous_hours_gvn        ELSE 0 END::numeric AS gvn
    FROM operations.previous_hour
)
SELECT
    p.person_nk,
    -- Días
    ROUND(COALESCE(ph.real_day, 0)  + COALESCE(r.day,   0) + COALESCE(pv.day, 0), 1)::numeric AS real_day_hour_qty,
    ROUND(COALESCE(ph.sim_day,  0)  + COALESCE(s.day,   0), 1)::numeric AS sim_day_hour_qty,
    ROUND(COALESCE(ph.real_day, 0)  + COALESCE(ph.sim_day, 0)
        + COALESCE(r.day, 0) + COALESCE(s.day, 0) + COALESCE(pv.day, 0), 1)::numeric          AS total_day_hour_qty,
    -- Noche
    ROUND(COALESCE(ph.real_night, 0) + COALESCE(r.night, 0) + COALESCE(pv.night, 0), 1)::numeric AS real_night_hour_qty,
    ROUND(COALESCE(ph.sim_night,  0) + COALESCE(s.night, 0), 1)::numeric AS sim_night_hour_qty,
    ROUND(COALESCE(ph.real_night, 0) + COALESCE(ph.sim_night, 0)
        + COALESCE(r.night, 0) + COALESCE(s.night, 0) + COALESCE(pv.night, 0), 1)::numeric      AS total_night_hour_qty,
    -- GVN
    ROUND(COALESCE(ph.real_gvn, 0)  + COALESCE(r.gvn, 0) + COALESCE(pv.gvn, 0), 1)::numeric    AS real_gvn_hour_qty,
    ROUND(COALESCE(ph.sim_gvn,  0)  + COALESCE(s.gvn, 0), 1)::numeric    AS sim_gvn_hour_qty,
    ROUND(COALESCE(ph.real_gvn, 0)  + COALESCE(ph.sim_gvn, 0)
        + COALESCE(r.gvn, 0) + COALESCE(s.gvn, 0) + COALESCE(pv.gvn, 0), 1)::numeric            AS total_gvn_hour_qty
FROM detall.v_person_ordered p
LEFT JOIN person_hour_agg ph ON ph.person_sk = p.person_sk
LEFT JOIN real_agg        r  ON r.person_sk  = p.person_sk
LEFT JOIN sim_agg         s  ON s.person_sk  = p.person_sk
LEFT JOIN prev_agg        pv ON pv.person_sk = p.person_sk
WHERE p.person_nk IS NOT NULL
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $3
  AND (COALESCE(cardinality($4::text[]), 0) = 0 OR p.person_rol = ANY($4::text[]))
ORDER BY p.order_position;

-- name: FormationPeriodHours :many
-- Horas de vuelo en formación (operations.formation_hour) por periodo, una fila
-- por persona del roster. Solo dos periodos relevantes: Día (period_fk=1) y GVN
-- (period_fk=3). Son horas reales registradas en Aether; no hay sim ni arrastre.
--
-- RLS explícita: el roster se filtra por person_escuadrilla_fk actual ($3).
-- $5 = modo "Totales": cruza escuadrillas (para personas que cambiaron de
-- escuadrilla). Por escuadrilla ($5=false): solo vuelos de la actual
-- (f.flight_escuadrilla_fk = $3). Totales ($5=true): todos los vuelos de la
-- persona → exención acotada a la RLS-por-código (solo datos propios del roster).
-- $1/$2 = rango de fechas (resuelto en Go). $4 = roles permitidos (vacío = todos).
WITH formation_agg AS (
    SELECT
        fh.formation_hour_person_fk AS person_sk,
        SUM(CASE WHEN fh.formation_hour_period_fk = 1 THEN fh.formation_hour_formation_qty ELSE 0 END)::numeric AS day,
        SUM(CASE WHEN fh.formation_hour_period_fk = 3 THEN fh.formation_hour_formation_qty ELSE 0 END)::numeric AS gvn
    FROM operations.formation_hour fh
    JOIN operations.flight f ON fh.formation_hour_flight_fk = f.flight_sk
    -- Totales ($5): ignora el rango de fechas Y la escuadrilla (histórico vitalicio).
    WHERE ($5::bool OR (f.flight_date >= $1 AND f.flight_date <= $2))
      AND ($5::bool OR f.flight_escuadrilla_fk = $3)
    GROUP BY fh.formation_hour_person_fk
)
SELECT
    p.person_nk,
    ROUND(COALESCE(fa.day, 0), 1)::numeric AS day_hour_qty,
    ROUND(COALESCE(fa.gvn, 0), 1)::numeric AS gvn_hour_qty
FROM detall.v_person_ordered p
LEFT JOIN formation_agg fa ON fa.person_sk = p.person_sk
WHERE p.person_nk IS NOT NULL
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $3
  AND (COALESCE(cardinality($4::text[]), 0) = 0 OR p.person_rol = ANY($4::text[]))
ORDER BY p.order_position;

-- name: GvntypeHours :many
-- Horas por tipo de gafas de visión nocturna (operations.gvntype_hour): IIT y
-- ANVIS, una fila por persona del roster. No hay periodo ni sim ni arrastre.
--
-- RLS explícita: roster por person_escuadrilla_fk actual ($3) y horas solo de
-- vuelos de la escuadrilla actual (f.flight_escuadrilla_fk = $3).
-- $1/$2 = rango de fechas (resuelto en Go). $4 = roles permitidos (vacío = todos).
WITH gvntype_agg AS (
    SELECT
        gh.gvntype_hour_person_fk AS person_sk,
        SUM(COALESCE(gh.gvntype_hour_iit_qty, 0))::numeric   AS iit,
        SUM(COALESCE(gh.gvntype_hour_anvis_qty, 0))::numeric AS anvis
    FROM operations.gvntype_hour gh
    JOIN operations.flight f ON gh.gvntype_hour_flight_fk = f.flight_sk
    WHERE f.flight_date >= $1 AND f.flight_date <= $2
      AND f.flight_escuadrilla_fk = $3
    GROUP BY gh.gvntype_hour_person_fk
)
SELECT
    p.person_nk,
    ROUND(COALESCE(ga.iit, 0), 1)::numeric   AS iit_hour_qty,
    ROUND(COALESCE(ga.anvis, 0), 1)::numeric AS anvis_hour_qty
FROM detall.v_person_ordered p
LEFT JOIN gvntype_agg ga ON ga.person_sk = p.person_sk
WHERE p.person_nk IS NOT NULL
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $3
  AND (COALESCE(cardinality($4::text[]), 0) = 0 OR p.person_rol = ANY($4::text[]))
ORDER BY p.order_position;

-- name: IftHours :many
-- Horas de vuelo por instrumentos (operations.ift_hour), una fila por persona del
-- roster.
--
-- RLS explícita: roster por person_escuadrilla_fk actual ($3).
-- $5 = modo "Totales": cruza escuadrillas (para personas que cambiaron de
-- escuadrilla) y suma el arrastre vitalicio operations.previous_hour.previous_hours_inst.
-- Por escuadrilla ($5=false): solo vuelos de la actual (f.flight_escuadrilla_fk = $3)
-- y sin arrastre. Totales ($5=true): exención acotada a la RLS-por-código (solo
-- datos propios del roster). $1/$2 = rango. $4 = roles (vacío = todos).
WITH ift_agg AS (
    SELECT
        ih.ift_hour_person_fk AS person_sk,
        SUM(ih.ift_hour_qty)::numeric AS ift
    FROM operations.ift_hour ih
    JOIN operations.flight f ON ih.ift_hour_flight_fk = f.flight_sk
    -- Totales ($5): ignora el rango de fechas Y la escuadrilla (histórico vitalicio).
    WHERE ($5::bool OR (f.flight_date >= $1 AND f.flight_date <= $2))
      AND ($5::bool OR f.flight_escuadrilla_fk = $3)
    GROUP BY ih.ift_hour_person_fk
),
prev_inst AS (
    SELECT
        previous_hours_person_fk AS person_sk,
        CASE WHEN $5::bool THEN previous_hours_inst ELSE 0 END::numeric AS inst
    FROM operations.previous_hour
)
SELECT
    p.person_nk,
    ROUND(COALESCE(ia.ift, 0) + COALESCE(pi.inst, 0), 1)::numeric AS ift_hour_qty
FROM detall.v_person_ordered p
LEFT JOIN ift_agg   ia ON ia.person_sk = p.person_sk
LEFT JOIN prev_inst pi ON pi.person_sk = p.person_sk
WHERE p.person_nk IS NOT NULL
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $3
  AND (COALESCE(cardinality($4::text[]), 0) = 0 OR p.person_rol = ANY($4::text[]))
ORDER BY p.order_position;

-- name: InstructorHours :many
-- Horas de vuelo como instructor (operations.instructor_hour), una fila por
-- persona del roster. Sin periodo, sim ni arrastre.
--
-- RLS explícita: roster por person_escuadrilla_fk actual ($3) y horas solo de
-- vuelos de la escuadrilla actual (f.flight_escuadrilla_fk = $3).
-- $1/$2 = rango de fechas (resuelto en Go). $4 = roles permitidos (vacío = todos).
WITH instructor_agg AS (
    SELECT
         insh.instructor_hour_person_fk AS person_sk,
        SUM(insh.instructor_hour_qty)::numeric AS instructor
    FROM operations.instructor_hour insh
    JOIN operations.flight f ON insh.instructor_hour_flight_fk = f.flight_sk
    WHERE f.flight_date >= $1 AND f.flight_date <= $2
      AND f.flight_escuadrilla_fk = $3
    GROUP BY insh.instructor_hour_person_fk
)
SELECT
    p.person_nk,
    ROUND(COALESCE(ia.instructor, 0), 1)::numeric AS instructor_hour_qty
FROM detall.v_person_ordered p
LEFT JOIN instructor_agg ia ON ia.person_sk = p.person_sk
WHERE p.person_nk IS NOT NULL
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $3
  AND (COALESCE(cardinality($4::text[]), 0) = 0 OR p.person_rol = ANY($4::text[]))
ORDER BY p.order_position;

-- name: CtaHours :many
-- Horas como Comandante de Aeronave (CTA) por persona del roster.
--
-- DE DÓNDE SALE EL SUMATORIO DE HORAS CTA: se suman las siguientes fuentes:
--   1) Vuelos en Aether: SUM(operations.flight.flight_total_hours) de los vuelos
--      en los que la persona figura como CTA (flight_person_cta_fk), acotados por
--      el rango $1/$2.
--   2) operations.previous_model_real_hour.previous_model_real_hours_cta: horas
--      CTA reales registradas con el modelo de aeronave anterior (rango $1/$2).
--   3) operations.previous_model_sim_hour.previous_model_sim_hours_cta: horas CTA
--      en simulador registradas con el modelo anterior (rango $1/$2).
--   4) SOLO en modo "Totales" ($5=true): operations.previous_hour.previous_hours_cta,
--      el arrastre vitalicio de horas CTA por persona (sin fecha ni escuadrilla).
-- Las tablas previous_* son person-centric (sin escuadrilla_fk); el filtro de
-- roster por $3 las acota a personas propias.
-- $5 = modo "Totales": cruza escuadrillas en la parte de vuelos (para personas
-- que cambiaron de escuadrilla) y añade el arrastre (4). Por escuadrilla
-- ($5=false): solo vuelos de la actual (flight_escuadrilla_fk = $3), sin arrastre.
-- Totales ($5=true): exención acotada a la RLS-por-código (solo datos propios del
-- roster). $4 = roles permitidos (vacío = todos).
WITH flight_cta AS (
    SELECT f.flight_person_cta_fk AS person_sk,
           SUM(f.flight_total_hours)::numeric AS cta
    FROM operations.flight f
    -- Totales ($5): ignora el rango de fechas Y la escuadrilla (histórico vitalicio).
    WHERE ($5::bool OR (f.flight_date >= $1 AND f.flight_date <= $2))
      AND ($5::bool OR f.flight_escuadrilla_fk = $3)
    GROUP BY f.flight_person_cta_fk
),
real_cta AS (
    SELECT previous_model_real_hours_person_fk AS person_sk,
           SUM(previous_model_real_hours_cta)::numeric AS cta
    FROM operations.previous_model_real_hour
    WHERE $5::bool OR (previous_model_real_hours_date >= $1 AND previous_model_real_hours_date <= $2)
    GROUP BY previous_model_real_hours_person_fk
),
sim_cta AS (
    SELECT previous_model_sim_hours_person_fk AS person_sk,
           SUM(previous_model_sim_hours_cta)::numeric AS cta
    FROM operations.previous_model_sim_hour
    WHERE $5::bool OR (previous_model_sim_hours_date >= $1 AND previous_model_sim_hours_date <= $2)
    GROUP BY previous_model_sim_hours_person_fk
),
prev_cta AS (
    SELECT previous_hours_person_fk AS person_sk,
           CASE WHEN $5::bool THEN previous_hours_cta ELSE 0 END::numeric AS cta
    FROM operations.previous_hour
)
SELECT
    p.person_nk,
    ROUND(COALESCE(fc.cta, 0) + COALESCE(rc.cta, 0) + COALESCE(sc.cta, 0)
        + COALESCE(pc.cta, 0), 1)::numeric AS cta_hour_qty
FROM detall.v_person_ordered p
LEFT JOIN flight_cta fc ON fc.person_sk = p.person_sk
LEFT JOIN real_cta   rc ON rc.person_sk = p.person_sk
LEFT JOIN sim_cta    sc ON sc.person_sk = p.person_sk
LEFT JOIN prev_cta   pc ON pc.person_sk = p.person_sk
WHERE p.person_nk IS NOT NULL
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $3
  AND (COALESCE(cardinality($4::text[]), 0) = 0 OR p.person_rol = ANY($4::text[]))
ORDER BY p.order_position;

-- name: WtHours :many
-- Horas de vuelo en Winch Trim (operations.wt_hour), una fila por persona del
-- roster (página /dotaciones/horas-vuelo). Sin periodo, sim ni arrastre: el modo
-- "Totales" NO incluye Winch Trim, así que esta query solo opera por escuadrilla.
--
-- RLS explícita: roster por person_escuadrilla_fk actual ($3) y horas solo de
-- vuelos de la escuadrilla actual (f.flight_escuadrilla_fk = $3).
-- $1/$2 = rango de fechas (resuelto en Go). $4 = roles permitidos (vacío = todos).
WITH wt_agg AS (
    SELECT
        wh.wt_hour_person_fk AS person_sk,
        SUM(wh.wt_hour_qty)::numeric AS wt
    FROM operations.wt_hour wh
    JOIN operations.flight f ON wh.wt_hour_flight_fk = f.flight_sk
    WHERE f.flight_date >= $1 AND f.flight_date <= $2
      AND f.flight_escuadrilla_fk = $3
    GROUP BY wh.wt_hour_person_fk
)
SELECT
    p.person_nk,
    ROUND(COALESCE(wa.wt, 0), 1)::numeric AS wt_hour_qty
FROM detall.v_person_ordered p
LEFT JOIN wt_agg wa ON wa.person_sk = p.person_sk
WHERE p.person_nk IS NOT NULL
  AND p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $3
  AND (COALESCE(cardinality($4::text[]), 0) = 0 OR p.person_rol = ANY($4::text[]))
ORDER BY p.order_position;
