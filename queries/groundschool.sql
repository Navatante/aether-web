-- ============================================================
-- Ground School (operations.ground_school)
--
-- Registro de asistencia a clases de teoría (papeleta) por persona y fecha.
-- Una sesión registra una papeleta + fecha para N personas → N filas.
-- RLS por código: filtro explícito por ground_school_escuadrilla_fk = $1.
-- ============================================================

-- name: InsertGroundSchool :one
INSERT INTO operations.ground_school (
    ground_school_datetime, ground_school_person_fk,
    ground_school_papeleta_fk, ground_school_escuadrilla_fk
) VALUES ($1, $2, $3, $4)
RETURNING ground_school_sk;

-- name: DeleteGroundSchool :execrows
DELETE FROM operations.ground_school
WHERE ground_school_sk = $1 AND ground_school_escuadrilla_fk = $2;

-- name: ListGroundSchool :many
-- Paginado + filtro opcional por $2 = ground_school_sk (0=sin filtro).
SELECT
    gs.ground_school_sk,
    gs.ground_school_datetime,
    p.person_nk,
    BTRIM(p.person_rank || ' ' || p.person_last_name_1 || ' ' ||
          COALESCE(p.person_last_name_2, ''))::text AS persona,
    pap.papeleta_name,
    pap.papeleta_block,
    pap.papeleta_description
FROM operations.ground_school gs
JOIN detall.person       p   ON gs.ground_school_person_fk   = p.person_sk
JOIN operations.papeleta pap ON gs.ground_school_papeleta_fk = pap.papeleta_sk
WHERE gs.ground_school_escuadrilla_fk = $1
  AND ($2::int = 0 OR gs.ground_school_sk = $2)
ORDER BY gs.ground_school_datetime DESC, gs.ground_school_sk DESC
LIMIT $3 OFFSET $4;

-- name: CountGroundSchool :one
SELECT COUNT(*)::int
FROM operations.ground_school gs
WHERE gs.ground_school_escuadrilla_fk = $1
  AND ($2::int = 0 OR gs.ground_school_sk = $2);
