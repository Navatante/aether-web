-- ============================================================
-- Horas extra (operations.extra_hour) — tabla unificada
--
-- Horas por persona (CTA, día, noche convencional, GVN, instrumentos) +
-- observaciones, con fecha (extra_hours_date), discriminador real/simulador
-- (extra_hours_is_real) y modelo de aeronave (extra_hours_model_fk →
-- operations.aircraft_model). Una persona puede tener varias filas, que se
-- suman en los cálculos de horas (queries/hours.sql) y en la vista agrupada
-- (ListExtraHourPersonTotals). El detalle por persona se devuelve con el modelo
-- para agruparlo en el frontend.
--
-- RLS por código: operations.extra_hour NO tiene escuadrilla_fk (es
-- person-centric), así que el aislamiento se hace vía la escuadrilla de la
-- persona (detall.person.person_escuadrilla_fk = $N). Todas las sentencias de
-- abajo lo aplican, por lo que quedan acotadas a personas de la escuadrilla
-- de la sesión.
-- ============================================================

-- name: InsertExtraHour :one
-- Inserta solo si la persona pertenece a la escuadrilla de la sesión ($11); si
-- no, no inserta ninguna fila (RETURNING vacío → ErrNoRows en el service).
INSERT INTO operations.extra_hour (
    extra_hours_date, extra_hours_person_fk, extra_hours_model_fk, extra_hours_is_real,
    extra_hours_cta, extra_hours_day, extra_hours_conv_night, extra_hours_gvn,
    extra_hours_inst, extra_hours_remarks
)
SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
WHERE EXISTS (
    SELECT 1 FROM detall.person
    WHERE person_sk = $2 AND person_escuadrilla_fk = $11
)
RETURNING extra_hours_sk;

-- name: UpdateExtraHour :execrows
-- Actualiza fecha, modelo, tipo, horas y observaciones (la persona del registro
-- no cambia). Acotado a registros de personas de la escuadrilla de la sesión ($11).
UPDATE operations.extra_hour eh
SET extra_hours_date        = $2,
    extra_hours_model_fk    = $3,
    extra_hours_is_real     = $4,
    extra_hours_cta         = $5,
    extra_hours_day         = $6,
    extra_hours_conv_night  = $7,
    extra_hours_gvn         = $8,
    extra_hours_inst        = $9,
    extra_hours_remarks     = $10
FROM detall.person p
WHERE eh.extra_hours_sk = $1
  AND p.person_sk = eh.extra_hours_person_fk
  AND p.person_escuadrilla_fk = $11;

-- name: DeleteExtraHour :execrows
DELETE FROM operations.extra_hour eh
USING detall.person p
WHERE eh.extra_hours_sk = $1
  AND p.person_sk = eh.extra_hours_person_fk
  AND p.person_escuadrilla_fk = $2;

-- name: ListExtraHourPersonTotals :many
-- Vista agrupada: una fila por persona con el conteo de registros y la SUMA de
-- cada métrica (todos los modelos y tipos combinados). Ordenado por el orden
-- canónico de personas (detall.v_person_ordered.order_position: rango,
-- antigüedad, escalafón…). Paginado por persona. $2 = filtro opcional por
-- nombre/NK (cadena vacía = sin filtro).
SELECT
    p.person_sk,
    p.person_nk,
    BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' ||
          COALESCE(p.person_last_name_2, ''))::text AS persona,
    COUNT(*)::int                          AS record_count,
    SUM(eh.extra_hours_cta)::float8        AS cta,
    SUM(eh.extra_hours_day)::float8        AS day,
    SUM(eh.extra_hours_conv_night)::float8 AS conv_night,
    SUM(eh.extra_hours_gvn)::float8        AS gvn,
    SUM(eh.extra_hours_inst)::float8       AS inst
FROM operations.extra_hour eh
JOIN detall.person p ON eh.extra_hours_person_fk = p.person_sk
JOIN detall.v_person_ordered vpo ON vpo.person_sk = p.person_sk
WHERE p.person_escuadrilla_fk = $1
  AND ($2::text = ''
       OR public.unaccent(p.person_nk) ILIKE public.unaccent('%' || $2 || '%')
       OR public.unaccent(BTRIM(p.person_rank || ' ' || p.person_last_name_1 || ' ' ||
                COALESCE(p.person_last_name_2, ''))) ILIKE public.unaccent('%' || $2 || '%')
       OR public.unaccent(p.person_name) ILIKE public.unaccent('%' || $2 || '%'))
GROUP BY p.person_sk, vpo.order_position
ORDER BY vpo.order_position
LIMIT $3 OFFSET $4;

-- name: CountExtraHourPersons :one
-- Número de personas (no de registros) que tienen horas extra, con el mismo
-- filtro de nombre que ListExtraHourPersonTotals.
SELECT COUNT(*)::int FROM (
    SELECT eh.extra_hours_person_fk
    FROM operations.extra_hour eh
    JOIN detall.person p ON eh.extra_hours_person_fk = p.person_sk
    WHERE p.person_escuadrilla_fk = $1
      AND ($2::text = ''
           OR public.unaccent(p.person_nk) ILIKE public.unaccent('%' || $2 || '%')
           OR public.unaccent(BTRIM(p.person_rank || ' ' || p.person_last_name_1 || ' ' ||
                    COALESCE(p.person_last_name_2, ''))) ILIKE public.unaccent('%' || $2 || '%')
           OR public.unaccent(p.person_name) ILIKE public.unaccent('%' || $2 || '%'))
    GROUP BY eh.extra_hours_person_fk
) t;

-- name: ListExtraHourByPerson :many
-- Detalle: registros individuales de UNA persona ($2), acotado a la escuadrilla
-- de la sesión ($1). Devuelve fecha, tipo (real/sim) y el modelo (sk + nombre
-- legible) para que el frontend agrupe por aircraft_model. Sin paginar (cada
-- persona tiene pocos registros). Orden: por modelo, luego fecha desc.
SELECT
    eh.extra_hours_sk,
    p.person_nk,
    BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' ||
          COALESCE(p.person_last_name_2, ''))::text AS persona,
    eh.extra_hours_person_fk,
    eh.extra_hours_date,
    eh.extra_hours_is_real,
    eh.extra_hours_model_fk,
    BTRIM(am.aircraft_make || ' ' || am.aircraft_model || ' ' || am.aircraft_variant)::text AS model_name,
    eh.extra_hours_cta::float8        AS cta,
    eh.extra_hours_day::float8        AS day,
    eh.extra_hours_conv_night::float8 AS conv_night,
    eh.extra_hours_gvn::float8        AS gvn,
    eh.extra_hours_inst::float8       AS inst,
    eh.extra_hours_remarks
FROM operations.extra_hour eh
JOIN detall.person p ON eh.extra_hours_person_fk = p.person_sk
JOIN operations.aircraft_model am ON eh.extra_hours_model_fk = am.aircraft_model_sk
WHERE p.person_escuadrilla_fk = $1
  AND eh.extra_hours_person_fk = $2
ORDER BY model_name, eh.extra_hours_date DESC, eh.extra_hours_sk DESC;
