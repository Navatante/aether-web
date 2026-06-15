-- ============================================================
-- Projectiles (proyectiles disparados por dotación)
--
-- Agrega operations.projectile por persona sobre un rango de fechas resuelto
-- en Go (mismo parser que hours/landings), filtrando por dotación.
--
-- projectile_type_fk: 1 = M3M (7.62), 2 = MAG58 (12.7).
--
-- Solo dotación: person_rol NOT IN ('Piloto', 'No Tripulante') — regla fija de
-- esta página (/dotaciones/proyectiles), por eso va en la propia query.
-- RLS explícita: $3 = escuadrilla_fk. Rango por f.flight_date.
-- ============================================================

-- name: ProjectilesByCrew :many
WITH projectile_agg AS (
    SELECT
        pr.projectile_person_fk AS person_sk,
        SUM(CASE WHEN pr.projectile_type_fk = 1 THEN pr.projectile_qty ELSE 0 END)::int AS m3m,
        SUM(CASE WHEN pr.projectile_type_fk = 2 THEN pr.projectile_qty ELSE 0 END)::int AS mag58
    FROM operations.projectile pr
    JOIN operations.flight f ON pr.projectile_flight_fk = f.flight_sk
    WHERE f.flight_date >= $1 AND f.flight_date <= $2
    GROUP BY pr.projectile_person_fk
)
SELECT
    p.person_nk,
    COALESCE(pa.m3m,   0)::int AS m3m_qty,
    COALESCE(pa.mag58, 0)::int AS mag58_qty
FROM detall.v_person_ordered p
LEFT JOIN projectile_agg pa ON pa.person_sk = p.person_sk
WHERE p.person_nk IS NOT NULL
  AND p.person_escuadrilla_fk = $3
  AND p.person_rol NOT IN ('Piloto', 'No Tripulante')
ORDER BY p.order_position;
