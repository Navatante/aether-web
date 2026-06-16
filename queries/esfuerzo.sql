-- ============================================================
-- Esfuerzo (Hito 4, lote 6)
--
-- Reimplementa sp_get_esfuerzo: por persona activa, suma de días de
-- comisión "con esfuerzo" en los últimos 730 días (con clipping de
-- comisiones que parcialmente se solapan con el rango).
--
-- Ajuste del último día (llegada): el día de llegada NO genera esfuerzo
-- cuando es laborable (L-V y no festivo) y se llega antes de las 14:00.
-- Solo aplica a comisiones multi-día cuyo último día cae dentro de la
-- ventana (si está recortado por la derecha, el día de llegada queda
-- fuera y no hay nada que restar). La salida es informativa.
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
            - CASE
                WHEN fc.comision_end_date <= w.fecha_fin                  -- último día dentro de la ventana
                 AND fc.comision_end_date >  fc.comision_start_date       -- comisión multi-día
                 AND EXTRACT(ISODOW FROM fc.comision_end_date) < 6        -- laborable (L-V)
                 AND fc.comision_arrival_time < TIME '14:00'              -- llegada en horario laboral
                 AND NOT EXISTS (
                     SELECT 1 FROM detall.festivos f
                     WHERE f.festivo_dia = fc.comision_end_date
                 )
                THEN 1 ELSE 0
              END
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
