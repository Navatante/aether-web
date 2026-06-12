-- ============================================================
-- Esfuerzo (Hito 4, lote 6)
--
-- Reimplementa sp_get_esfuerzo: por persona activa, suma de días de
-- comisión "con esfuerzo" en los últimos 730 días (con clipping de
-- comisiones que parcialmente se solapan con el rango).
--
-- RLS explícita: $2 = escuadrilla_fk.
-- $1 = fecha_fin (Go la calcula con today si viene vacía).
-- ============================================================

-- name: Esfuerzo :many
WITH ventana AS (
    SELECT $1::date AS fecha_fin, ($1::date - 730) AS fecha_inicio
)
SELECT
    BTRIM(p.person_rank || ' ' || p.person_name || ' ' || p.person_last_name_1 || ' ' || p.person_last_name_2)::text AS full_name,
    p.rank_category AS escala,
    COALESCE((
        SELECT SUM(
            (LEAST(fc.comision_end_date, w.fecha_fin)
             - GREATEST(fc.comision_start_date, w.fecha_inicio) + 1)
        )::int
        FROM detall.person_comision jpc
        JOIN detall.comision fc ON jpc.comision_fk = fc.comision_sk
        CROSS JOIN ventana w
        WHERE jpc.person_fk = p.person_sk
          AND fc.comision_esfuerzo = TRUE
          AND fc.comision_start_date <= w.fecha_fin
          AND fc.comision_end_date   >= w.fecha_inicio
    ), 0)::int AS dias_esfuerzo
FROM detall.v_person_ordered p
WHERE p.person_current_flag = TRUE
  AND p.person_escuadrilla_fk = $2
ORDER BY p.order_position;
