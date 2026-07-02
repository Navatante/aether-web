-- ============================================================
-- Availability (Hito 4, lote 3)
--
-- Reimplementa sp_get_availability + CRUD de detall.absence.
-- Devuelve 3 listas (persons, absenses, person_comisions) filtradas
-- por mes/año recibido como parámetro.
-- ============================================================

-- name: AvailabilityPersons :many
SELECT
    p.person_sk,
    BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' || p.person_last_name_2)::text AS full_name,
    p.person_rol,
    p.rank_category AS escala
FROM detall.v_person_ordered p
WHERE p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $1
ORDER BY p.order_position;

-- name: AvailabilityAbsences :many
-- Filtra ausencias que se solapan con el mes [month_start, month_end].
-- sqlc.arg() fuerza nombres semánticos: sin él, sqlc nombraba los params por
-- la columna del WHERE y quedaban invertidos respecto a su significado.
SELECT
    a.absence_sk,
    a.absence_start_date,
    a.absence_end_date,
    (a.absence_end_date - a.absence_start_date + 1)::int AS absence_dias,
    a.absence_person_fk,
    r.absence_reason,
    a.absence_remark
FROM detall.absence a
JOIN detall.absence_reason r ON a.absence_reason_fk = r.absence_reason_sk
WHERE a.absence_start_date <= sqlc.arg(month_end)
  AND a.absence_end_date   >= sqlc.arg(month_start)
  AND a.absence_escuadrilla_fk = sqlc.arg(escuadrilla_fk);

-- name: AvailabilityComisiones :many
-- Comisiones que se solapan con el mes [month_start, month_end].
SELECT
    jpc.person_comision_sk,
    jpc.person_fk,
    c.comision_start_date,
    c.comision_end_date,
    (c.comision_end_date - c.comision_start_date + 1)::int AS comision_dias,
    l.comision_name AS comision_lugar
FROM detall.person_comision jpc
JOIN detall.comision c       ON jpc.comision_fk = c.comision_sk
JOIN detall.comision_lugar l ON c.comision_lugar_fk = l.comision_lugar_sk
WHERE c.comision_start_date <= sqlc.arg(month_end)
  AND c.comision_end_date   >= sqlc.arg(month_start)
  AND c.comision_escuadrilla_fk = sqlc.arg(escuadrilla_fk);

-- name: ResolveAbsenceReason :one
-- absence_reason del request puede venir como nombre o como id numérico.
-- Para el nombre, hacemos lookup. El handler trata el caso numérico antes de llamar.
SELECT absence_reason_sk
FROM detall.absence_reason
WHERE absence_reason = $1;

-- name: InsertAbsence :one
INSERT INTO detall.absence (
    absence_start_date, absence_end_date, absence_person_fk,
    absence_reason_fk, absence_remark, absence_escuadrilla_fk
) VALUES ($1, $2, $3, $4, $5, $6)
RETURNING absence_sk;

-- name: UpdateAbsence :execrows
UPDATE detall.absence
SET absence_start_date = $1,
    absence_end_date = $2,
    absence_reason_fk = $3,
    absence_remark = $4
WHERE absence_sk = $5
  AND absence_escuadrilla_fk = $6;

-- name: DeleteAbsence :execrows
DELETE FROM detall.absence
WHERE absence_sk = $1
  AND absence_escuadrilla_fk = $2;
