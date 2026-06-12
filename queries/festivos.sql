-- ============================================================
-- Festivos (Hito 4, lote 2)
-- Catálogo global (sin escuadrilla_fk en la tabla).
-- ============================================================

-- name: ListFestivos :many
SELECT festivo_sk, festivo_dia, festivo_motivo
FROM detall.festivos
ORDER BY festivo_dia;

-- name: FestivoExistsOnDate :one
-- Comportamiento heredado: bloquear cualquier 2º festivo en la misma fecha,
-- aunque el motivo difiera (más estricto que UQ_festivo en BD).
SELECT EXISTS (
    SELECT 1 FROM detall.festivos WHERE festivo_dia = $1
) AS exists;

-- name: FestivoExistsOnDateOtherSk :one
SELECT EXISTS (
    SELECT 1 FROM detall.festivos WHERE festivo_dia = $1 AND festivo_sk <> $2
) AS exists;

-- name: InsertFestivo :one
INSERT INTO detall.festivos (festivo_dia, festivo_motivo)
VALUES ($1, $2)
RETURNING festivo_sk;

-- name: UpdateFestivo :execrows
UPDATE detall.festivos
SET festivo_dia = $1, festivo_motivo = $2
WHERE festivo_sk = $3;

-- name: DeleteFestivo :execrows
DELETE FROM detall.festivos WHERE festivo_sk = $1;
