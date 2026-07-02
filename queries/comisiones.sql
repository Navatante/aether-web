-- ============================================================
-- Comisiones (Hito 4, lote 4)
--
-- Reimplementa sp_get_comisiones, sp_get_dias_comision + CRUD de
-- detall.comision, detall.comision_lugar, detall.person_comision.
--
-- Fix RLS: update/delete de comisión filtran por escuadrilla_fk.
-- detall.comision_lugar NO tiene escuadrilla_fk (catálogo global) →
-- las mutaciones se protegen sólo con RequireAuth.
-- ============================================================


-- =============== Resolvers (name → sk) ===============

-- name: ResolveComisionType :one
SELECT comision_type_sk FROM detall.comision_type WHERE name = $1;

-- name: ResolveComisionLugar :one
SELECT comision_lugar_sk FROM detall.comision_lugar WHERE comision_name = $1;


-- =============== Comisión CRUD ===============

-- name: InsertComision :one
INSERT INTO detall.comision (
    comision_start_date, comision_end_date,
    comision_type_fk, comision_lugar_fk,
    comision_escuadrilla_fk, comision_esfuerzo,
    comision_departure_time, comision_arrival_time, comision_code
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING comision_sk;

-- name: UpdateComision :execrows
UPDATE detall.comision
SET comision_start_date    = $1,
    comision_end_date      = $2,
    comision_type_fk       = $3,
    comision_lugar_fk      = $4,
    comision_esfuerzo      = $5,
    comision_departure_time = $6,
    comision_arrival_time   = $7,
    comision_code           = $8
WHERE comision_sk = $9 AND comision_escuadrilla_fk = $10;

-- name: DeleteComision :execrows
DELETE FROM detall.comision
WHERE comision_sk = $1 AND comision_escuadrilla_fk = $2;


-- =============== Comisión listings ===============

-- name: ListComisiones :many
-- Paginado + filtros opcionales. Convención:
--   $2 = comision_sk filtro (0 → sin filtro)
--   $3 = date_from (pgtype.Date.Valid=false → sin filtro)
--   $4 = date_to   (idem)
SELECT
    c.comision_sk,
    c.comision_start_date,
    c.comision_end_date,
    (c.comision_end_date - c.comision_start_date + 1)::int AS dias,
    cl.comision_name                                       AS lugar,
    ct.name                                                AS tipo,
    c.comision_esfuerzo                                    AS esfuerzo,
    c.comision_departure_time                              AS hora_salida,
    c.comision_arrival_time                                AS hora_llegada,
    c.comision_code                                        AS codigo
FROM detall.comision c
JOIN detall.comision_lugar cl ON c.comision_lugar_fk = cl.comision_lugar_sk
JOIN detall.comision_type  ct ON c.comision_type_fk  = ct.comision_type_sk
WHERE c.comision_escuadrilla_fk = $1
  AND ($2 = 0     OR c.comision_sk          = $2)
  AND ($3::date IS NULL OR c.comision_start_date >= $3)
  AND ($4::date IS NULL OR c.comision_end_date   <= $4)
ORDER BY c.comision_sk DESC
LIMIT $5 OFFSET $6;

-- name: CountComisiones :one
SELECT COUNT(*)::int
FROM detall.comision c
WHERE c.comision_escuadrilla_fk = $1
  AND ($2 = 0     OR c.comision_sk          = $2)
  AND ($3::date IS NULL OR c.comision_start_date >= $3)
  AND ($4::date IS NULL OR c.comision_end_date   <= $4);

-- name: ListComisionPeople :many
-- Personas asignadas a las comisiones de una página, en una sola query (bulk,
-- como las tablas hijas de flights); Go agrupa por comision_fk. Ordenadas por
-- la vista canónica. rancheria_dias = 0 si la persona no hizo ranchería.
SELECT
    pc.comision_fk,
    pc.person_comision_sk,
    BTRIM(p.person_rank || ' ' || p.person_last_name_1 || ' ' || p.person_last_name_2)::text AS nombre,
    p.order_position AS orden,
    COALESCE(pcr.dias, 0)::int AS rancheria_dias
FROM detall.person_comision pc
JOIN detall.v_person_ordered p ON pc.person_fk = p.person_sk
LEFT JOIN detall.person_comision_rancheria pcr ON pcr.person_comision_fk = pc.person_comision_sk
WHERE pc.comision_fk = ANY($1::int[])
ORDER BY pc.comision_fk, p.order_position;

-- name: ListComisionPeopleExpanded :many
-- Variante con campos separados (espejo de get_comision_people en Rust), bulk.
SELECT
    pc.comision_fk,
    p.person_sk,
    p.person_nk,
    p.person_rank,
    p.person_name,
    p.person_last_name_1,
    p.person_last_name_2
FROM detall.person_comision pc
JOIN detall.person p ON pc.person_fk = p.person_sk
WHERE pc.comision_fk = ANY($1::int[])
ORDER BY pc.comision_fk, p.person_rank, p.person_name;


-- =============== comision_lugar CRUD ===============

-- name: LugarExistsByName :one
SELECT EXISTS (
    SELECT 1 FROM detall.comision_lugar WHERE LOWER(comision_name) = LOWER($1)
) AS exists;

-- name: LugarExistsByNameOther :one
SELECT EXISTS (
    SELECT 1 FROM detall.comision_lugar
    WHERE comision_name = $1 AND comision_lugar_sk <> $2
) AS exists;

-- name: InsertComisionLugar :one
INSERT INTO detall.comision_lugar (comision_name)
VALUES ($1)
RETURNING comision_lugar_sk, comision_name;

-- name: UpdateComisionLugar :execrows
UPDATE detall.comision_lugar SET comision_name = $1
WHERE comision_lugar_sk = $2;

-- name: LugarUsageCount :one
SELECT COUNT(*)::int FROM detall.comision WHERE comision_lugar_fk = $1;

-- name: DeleteComisionLugar :execrows
DELETE FROM detall.comision_lugar WHERE comision_lugar_sk = $1;


-- =============== person_comision (assign + delete) ===============

-- name: GetComisionDates :one
-- Devuelve las fechas y comprueba que la comisión existe en la escuadrilla.
SELECT comision_start_date, comision_end_date
FROM detall.comision
WHERE comision_sk = $1 AND comision_escuadrilla_fk = $2;

-- name: PersonsInEscuadrilla :many
-- De entre los person_sk dados, devuelve los que pertenecen a la escuadrilla.
-- Sirve para validar en el bulk-assign que no se asignan personas de otra
-- escuadrilla (los person_sk vienen del cliente y no están acotados de otro modo).
SELECT person_sk
FROM detall.person
WHERE person_sk = ANY($1::int[])
  AND person_escuadrilla_fk = $2;

-- name: PersonFullName :one
-- Para mensajes de error en bulk assign.
SELECT
    BTRIM(
        COALESCE(NULLIF(BTRIM(person_rank), ''), '')         || ' ' ||
        COALESCE(NULLIF(BTRIM(person_name), ''), '')         || ' ' ||
        COALESCE(NULLIF(BTRIM(person_last_name_1), ''), '')  || ' ' ||
        COALESCE(NULLIF(BTRIM(person_last_name_2), ''), '')
    )::text AS full_name
FROM detall.person WHERE person_sk = $1;

-- name: PersonAlreadyInComision :one
SELECT EXISTS (
    SELECT 1 FROM detall.person_comision
    WHERE comision_fk = $1 AND person_fk = $2
) AS exists;

-- name: PersonHasOverlapComision :one
-- Otra comisión cualquiera del person que solapa con [start, end].
SELECT EXISTS (
    SELECT 1
    FROM detall.person_comision pc
    JOIN detall.comision c ON c.comision_sk = pc.comision_fk
    WHERE pc.person_fk = $1
      AND $2::date <= c.comision_end_date
      AND $3::date >= c.comision_start_date
) AS exists;

-- name: PersonHasOverlapAbsence :one
SELECT EXISTS (
    SELECT 1 FROM detall.absence
    WHERE absence_person_fk = $1
      AND $2::date <= absence_end_date
      AND $3::date >= absence_start_date
) AS exists;

-- name: InsertPersonToComision :exec
INSERT INTO detall.person_comision (comision_fk, person_fk) VALUES ($1, $2);

-- name: InsertPersonComisionRancheria :exec
-- Marca con días de ranchería a un participante ya insertado, resolviendo su
-- person_comision_sk desde (comision_fk, person_fk).
INSERT INTO detall.person_comision_rancheria (person_comision_fk, dias)
SELECT pc.person_comision_sk, sqlc.arg(dias)::int
FROM detall.person_comision pc
WHERE pc.comision_fk = sqlc.arg(comision_fk) AND pc.person_fk = sqlc.arg(person_fk);

-- name: DeletePersonFromComision :execrows
DELETE FROM detall.person_comision
WHERE comision_fk = $1 AND person_fk = $2;

-- name: DeletePersonComisionBySk :execrows
DELETE FROM detall.person_comision
WHERE person_comision_sk = $1
  AND comision_fk IN (
      SELECT comision_sk FROM detall.comision WHERE comision_escuadrilla_fk = $2
  );


-- =============== sp_get_dias_comision ===============

-- name: DiasComision :many
-- $1 = fechaFin (NULL → CURRENT_DATE en handler). fechaInicio = fechaFin - 365.
-- Devuelve per-persona días totales por categoría de comisión:
--   - Categorías "no caducan": SUMA días totales históricos.
--   - Categorías "sí caducan" (OMP/UNADEST/UNAEMB): SUMA solapamiento con [fechaInicio, fechaFin].
WITH ventana AS (
    SELECT $1::date AS fecha_fin, ($1::date - 365) AS fecha_inicio
)
SELECT
    p.person_sk,
    p.person_rank,
    BTRIM(p.person_name || ' ' || p.person_last_name_1 || ' ' || p.person_last_name_2)::text AS full_name,
    p.person_rol,
    p.rank_category AS escala,
    EXISTS (
        SELECT 1 FROM detall.notcrew_qualification fnr
        JOIN detall.notcrew_rating_type dnr ON fnr.notcrew_rating_fk = dnr.notcrew_rating_sk
        WHERE fnr.person_fk = p.person_sk AND dnr.notcrew_rating_abrv = 'B1'
    ) AS b1,
    EXISTS (
        SELECT 1 FROM detall.notcrew_qualification fnr
        JOIN detall.notcrew_rating_type dnr ON fnr.notcrew_rating_fk = dnr.notcrew_rating_sk
        WHERE fnr.person_fk = p.person_sk AND dnr.notcrew_rating_abrv = 'B2'
    ) AS b2,
    EXISTS (
        SELECT 1 FROM detall.notcrew_qualification fnr
        JOIN detall.notcrew_rating_type dnr ON fnr.notcrew_rating_fk = dnr.notcrew_rating_sk
        WHERE fnr.person_fk = p.person_sk AND dnr.notcrew_rating_abrv = 'LV'
    ) AS lv,
    COALESCE((
        SELECT SUM((fc.comision_end_date - fc.comision_start_date + 1))::int
        FROM detall.person_comision jpc
        JOIN detall.comision fc       ON jpc.comision_fk = fc.comision_sk
        JOIN detall.comision_type dct ON fc.comision_type_fk = dct.comision_type_sk
        WHERE jpc.person_fk = p.person_sk
          AND dct.name = 'Base o de Corta duración ordenadas por COMFLOAN'
    ), 0)::int AS dias_base_corta_duracion,
    COALESCE((
        SELECT SUM((fc.comision_end_date - fc.comision_start_date + 1))::int
        FROM detall.person_comision jpc
        JOIN detall.comision fc       ON jpc.comision_fk = fc.comision_sk
        JOIN detall.comision_type dct ON fc.comision_type_fk = dct.comision_type_sk
        WHERE jpc.person_fk = p.person_sk
          AND dct.name = 'Despliegues ordenados por COMFLOAN'
    ), 0)::int AS dias_despliegues,
    COALESCE((
        SELECT SUM((fc.comision_end_date - fc.comision_start_date + 1))::int
        FROM detall.person_comision jpc
        JOIN detall.comision fc       ON jpc.comision_fk = fc.comision_sk
        JOIN detall.comision_type dct ON fc.comision_type_fk = dct.comision_type_sk
        WHERE jpc.person_fk = p.person_sk
          AND dct.name = 'Ofertadas por otros mandos y de carácter voluntario'
    ), 0)::int AS dias_voluntarias,
    COALESCE((
        SELECT SUM(
            (LEAST(fc.comision_end_date, w.fecha_fin)
             - GREATEST(fc.comision_start_date, w.fecha_inicio) + 1)
        )::int
        FROM detall.person_comision jpc
        JOIN detall.comision fc       ON jpc.comision_fk = fc.comision_sk
        JOIN detall.comision_type dct ON fc.comision_type_fk = dct.comision_type_sk
        CROSS JOIN ventana w
        WHERE jpc.person_fk = p.person_sk
          AND dct.name = 'OMP como UNAEMB o UNADEST'
          AND fc.comision_start_date <= w.fecha_fin
          AND fc.comision_end_date   >= w.fecha_inicio
    ), 0)::int AS dias_omp,
    COALESCE((
        SELECT SUM(
            (LEAST(fc.comision_end_date, w.fecha_fin)
             - GREATEST(fc.comision_start_date, w.fecha_inicio) + 1)
        )::int
        FROM detall.person_comision jpc
        JOIN detall.comision fc       ON jpc.comision_fk = fc.comision_sk
        JOIN detall.comision_type dct ON fc.comision_type_fk = dct.comision_type_sk
        CROSS JOIN ventana w
        WHERE jpc.person_fk = p.person_sk
          AND dct.name = 'UNADEST nacionales o extranjero'
          AND fc.comision_start_date <= w.fecha_fin
          AND fc.comision_end_date   >= w.fecha_inicio
    ), 0)::int AS dias_unadest,
    COALESCE((
        SELECT SUM(
            (LEAST(fc.comision_end_date, w.fecha_fin)
             - GREATEST(fc.comision_start_date, w.fecha_inicio) + 1)
        )::int
        FROM detall.person_comision jpc
        JOIN detall.comision fc       ON jpc.comision_fk = fc.comision_sk
        JOIN detall.comision_type dct ON fc.comision_type_fk = dct.comision_type_sk
        CROSS JOIN ventana w
        WHERE jpc.person_fk = p.person_sk
          AND dct.name = 'UNAEMB nacionales o extranjero'
          AND fc.comision_start_date <= w.fecha_fin
          AND fc.comision_end_date   >= w.fecha_inicio
    ), 0)::int AS dias_unaemb,
    COALESCE((
        SELECT SUM(r.dias)::int
        FROM detall.person_comision jpc
        JOIN detall.person_comision_rancheria r ON r.person_comision_fk = jpc.person_comision_sk
        WHERE jpc.person_fk = p.person_sk
    ), 0)::int AS dias_rancheria
FROM detall.v_person_ordered p
WHERE p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $2
ORDER BY p.order_position, p.person_last_name_1, p.person_last_name_2;


-- =============== Desglose días de comisión por persona ===============
-- Detalle de las comisiones que componen el total de una categoría para una
-- persona (lo que se muestra al pinchar una celda en "Días de comisión").
-- Espejan la aritmética de DiasComision para que el sumatorio de `dias` cuadre.

-- name: ListPersonComisionesByType :many
-- Categorías "no caducan": dias = duración total de la comisión.
-- $1 = person_sk, $2 = comision_type.name, $3 = escuadrilla de la sesión.
-- RLS: person_sk viene de un query param del cliente; el JOIN a person con
-- person_escuadrilla_fk impide leer el desglose de personas de otra escuadrilla.
SELECT
    c.comision_sk,
    c.comision_code,
    c.comision_start_date,
    c.comision_end_date,
    cl.comision_name                                       AS lugar,
    (c.comision_end_date - c.comision_start_date + 1)::int AS dias
FROM detall.person_comision pc
JOIN detall.person        p  ON pc.person_fk      = p.person_sk
JOIN detall.comision      c  ON pc.comision_fk    = c.comision_sk
JOIN detall.comision_type ct ON c.comision_type_fk = ct.comision_type_sk
JOIN detall.comision_lugar cl ON c.comision_lugar_fk = cl.comision_lugar_sk
WHERE pc.person_fk = $1
  AND ct.name = $2
  AND p.person_escuadrilla_fk = $3
ORDER BY c.comision_start_date DESC;

-- name: ListPersonComisionesByTypeWindowed :many
-- Categorías "sí caducan" (OMP/UNADEST/UNAEMB): dias = solapamiento con
-- [fechaFin-365, fechaFin]. $1 = person_sk, $2 = comision_type.name,
-- $3 = fechaFin, $4 = escuadrilla de la sesión (RLS, ver ListPersonComisionesByType).
WITH ventana AS (
    SELECT $3::date AS fecha_fin, ($3::date - 365) AS fecha_inicio
)
SELECT
    c.comision_sk,
    c.comision_code,
    c.comision_start_date,
    c.comision_end_date,
    cl.comision_name AS lugar,
    (LEAST(c.comision_end_date, w.fecha_fin)
     - GREATEST(c.comision_start_date, w.fecha_inicio) + 1)::int AS dias
FROM detall.person_comision pc
JOIN detall.person        p  ON pc.person_fk      = p.person_sk
JOIN detall.comision      c  ON pc.comision_fk    = c.comision_sk
JOIN detall.comision_type ct ON c.comision_type_fk = ct.comision_type_sk
JOIN detall.comision_lugar cl ON c.comision_lugar_fk = cl.comision_lugar_sk
CROSS JOIN ventana w
WHERE pc.person_fk = $1
  AND ct.name = $2
  AND c.comision_start_date <= w.fecha_fin
  AND c.comision_end_date   >= w.fecha_inicio
  AND p.person_escuadrilla_fk = $4
ORDER BY c.comision_start_date DESC;

-- name: ListPersonRancheria :many
-- Ranchería: dias = person_comision_rancheria.dias (independiente del tipo).
-- $1 = person_sk, $2 = escuadrilla de la sesión (RLS, ver ListPersonComisionesByType).
SELECT
    c.comision_sk,
    c.comision_code,
    c.comision_start_date,
    c.comision_end_date,
    cl.comision_name AS lugar,
    r.dias::int      AS dias
FROM detall.person_comision pc
JOIN detall.person         p  ON pc.person_fk        = p.person_sk
JOIN detall.comision       c  ON pc.comision_fk      = c.comision_sk
JOIN detall.comision_lugar cl ON c.comision_lugar_fk = cl.comision_lugar_sk
JOIN detall.person_comision_rancheria r ON r.person_comision_fk = pc.person_comision_sk
WHERE pc.person_fk = $1
  AND p.person_escuadrilla_fk = $2
ORDER BY c.comision_start_date DESC;
