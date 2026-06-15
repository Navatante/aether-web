-- ============================================================
-- Papeletas (Hito 4, lote 2)
--
-- Fix RLS: add_papeleta y update_papeleta originales NO inyectaban
-- papeleta_escuadrilla_fk en SQL Server, pero la columna es NOT NULL.
-- En PG explícitamente:
--   - INSERT setea papeleta_escuadrilla_fk = $9 (de la sesión).
--   - UPDATE filtra por papeleta_escuadrilla_fk para impedir editar
--     papeletas de otra escuadrilla.
-- ============================================================

-- name: ListPapeletas :many
SELECT
    papeleta_sk, papeleta_name, papeleta_description,
    papeleta_block, papeleta_plan, papeleta_tv,
    papeleta_pilot_crp_value, papeleta_dv_crp_value, papeleta_expiration,
    papeleta_order
FROM operations.papeleta
WHERE papeleta_escuadrilla_fk = $1
ORDER BY papeleta_plan, papeleta_order NULLS LAST, papeleta_block, papeleta_name;

-- name: CountPapeletas :one
SELECT COUNT(*)::int AS total
FROM operations.papeleta
WHERE papeleta_escuadrilla_fk = $1;

-- name: InsertPapeleta :one
INSERT INTO operations.papeleta (
    papeleta_name, papeleta_description, papeleta_block, papeleta_plan,
    papeleta_tv, papeleta_pilot_crp_value, papeleta_dv_crp_value,
    papeleta_expiration, papeleta_order, papeleta_escuadrilla_fk
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING papeleta_sk;

-- name: UpdatePapeleta :execrows
UPDATE operations.papeleta
SET papeleta_name = $1,
    papeleta_description = $2,
    papeleta_block = $3,
    papeleta_plan = $4,
    papeleta_tv = $5,
    papeleta_pilot_crp_value = $6,
    papeleta_dv_crp_value = $7,
    papeleta_expiration = $8,
    papeleta_order = $9
WHERE papeleta_sk = $10 AND papeleta_escuadrilla_fk = $11;
