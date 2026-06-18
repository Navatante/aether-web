-- ============================================================
-- Horas extra del modelo de aeronave anterior (operations.extra_model_hour)
--
-- Horas por persona con fecha y discriminador real/simulador
-- (extra_model_hours_is_real). Sin restricción de unicidad: una persona puede
-- tener varias filas (se suman en los cálculos de horas y en la vista agrupada).
--
-- RLS por código: la tabla es person-centric (sin escuadrilla_fk); el
-- aislamiento se hace vía la escuadrilla de la persona
-- (detall.person.person_escuadrilla_fk = $N) en cada sentencia.
-- ============================================================

-- name: InsertExtraModelHour :one
-- Inserta solo si la persona pertenece a la escuadrilla de la sesión ($9); si
-- no, no inserta ninguna fila (RETURNING vacío → ErrNoRows en el service).
INSERT INTO operations.extra_model_hour (
    extra_model_hours_date, extra_model_hours_person_fk, extra_model_hours_is_real,
    extra_model_hours_cta, extra_model_hours_day, extra_model_hours_conv_night,
    extra_model_hours_gvn, extra_model_hours_inst, extra_model_hours_remarks
)
SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
WHERE EXISTS (
    SELECT 1 FROM detall.person
    WHERE person_sk = $2 AND person_escuadrilla_fk = $10
)
RETURNING extra_model_hours_sk;

-- name: UpdateExtraModelHour :execrows
-- Actualiza fecha, tipo y horas (la persona del registro no cambia). Acotado a
-- registros de personas de la escuadrilla de la sesión ($9).
UPDATE operations.extra_model_hour eh
SET extra_model_hours_date        = $2,
    extra_model_hours_is_real     = $3,
    extra_model_hours_cta         = $4,
    extra_model_hours_day         = $5,
    extra_model_hours_conv_night  = $6,
    extra_model_hours_gvn         = $7,
    extra_model_hours_inst        = $8,
    extra_model_hours_remarks     = $9
FROM detall.person p
WHERE eh.extra_model_hours_sk = $1
  AND p.person_sk = eh.extra_model_hours_person_fk
  AND p.person_escuadrilla_fk = $10;

-- name: DeleteExtraModelHour :execrows
DELETE FROM operations.extra_model_hour eh
USING detall.person p
WHERE eh.extra_model_hours_sk = $1
  AND p.person_sk = eh.extra_model_hours_person_fk
  AND p.person_escuadrilla_fk = $2;

-- name: ListExtraModelHourPersonTotals :many
-- Vista agrupada: una fila por persona con el conteo de registros y la SUMA de
-- cada métrica (real + simulador combinados). Ordenado por el orden canónico
-- (detall.v_person_ordered.order_position). Paginado por persona. $2 = filtro
-- opcional por nombre/NK (cadena vacía = sin filtro), ignorando acentos.
SELECT
    p.person_sk,
    p.person_nk,
    BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' ||
          COALESCE(p.person_last_name_2, ''))::text AS persona,
    COUNT(*)::int                                AS record_count,
    SUM(eh.extra_model_hours_cta)::float8        AS cta,
    SUM(eh.extra_model_hours_day)::float8        AS day,
    SUM(eh.extra_model_hours_conv_night)::float8 AS conv_night,
    SUM(eh.extra_model_hours_gvn)::float8        AS gvn,
    SUM(eh.extra_model_hours_inst)::float8       AS inst
FROM operations.extra_model_hour eh
JOIN detall.person p ON eh.extra_model_hours_person_fk = p.person_sk
JOIN detall.v_person_ordered vpo ON vpo.person_sk = p.person_sk
WHERE p.person_escuadrilla_fk = $1
  AND ($2::text = ''
       OR public.unaccent(p.person_nk) ILIKE public.unaccent('%' || $2 || '%')
       OR public.unaccent(BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' ||
                COALESCE(p.person_last_name_2, ''))) ILIKE public.unaccent('%' || $2 || '%')
       OR public.unaccent(p.person_name) ILIKE public.unaccent('%' || $2 || '%'))
GROUP BY p.person_sk, vpo.order_position
ORDER BY vpo.order_position
LIMIT $3 OFFSET $4;

-- name: CountExtraModelHourPersons :one
SELECT COUNT(*)::int FROM (
    SELECT eh.extra_model_hours_person_fk
    FROM operations.extra_model_hour eh
    JOIN detall.person p ON eh.extra_model_hours_person_fk = p.person_sk
    WHERE p.person_escuadrilla_fk = $1
      AND ($2::text = ''
           OR public.unaccent(p.person_nk) ILIKE public.unaccent('%' || $2 || '%')
           OR public.unaccent(BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' ||
                    COALESCE(p.person_last_name_2, ''))) ILIKE public.unaccent('%' || $2 || '%')
           OR public.unaccent(p.person_name) ILIKE public.unaccent('%' || $2 || '%'))
    GROUP BY eh.extra_model_hours_person_fk
) t;

-- name: ListExtraModelHourByPerson :many
-- Detalle: registros individuales de UNA persona ($2), acotado a la escuadrilla
-- de la sesión ($1). Sin paginar (cada persona tiene pocos registros).
SELECT
    eh.extra_model_hours_sk,
    p.person_nk,
    BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' ||
          COALESCE(p.person_last_name_2, ''))::text AS persona,
    eh.extra_model_hours_person_fk,
    eh.extra_model_hours_date,
    eh.extra_model_hours_is_real,
    eh.extra_model_hours_cta::float8        AS cta,
    eh.extra_model_hours_day::float8        AS day,
    eh.extra_model_hours_conv_night::float8 AS conv_night,
    eh.extra_model_hours_gvn::float8        AS gvn,
    eh.extra_model_hours_inst::float8       AS inst,
    eh.extra_model_hours_remarks
FROM operations.extra_model_hour eh
JOIN detall.person p ON eh.extra_model_hours_person_fk = p.person_sk
WHERE p.person_escuadrilla_fk = $1
  AND eh.extra_model_hours_person_fk = $2
ORDER BY eh.extra_model_hours_date DESC, eh.extra_model_hours_sk DESC;
