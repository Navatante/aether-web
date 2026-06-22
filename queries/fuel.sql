-- ============================================================
-- Combustible (operations.fuel) — repostajes
--
-- Cada fila es un repostaje: fecha, aeronave (helo), lugar, pagador, evento,
-- fase, tipo de combustible y cantidad (litros). Los catálogos (fuel_place,
-- fuel_payer, fuel_phase, fuel_type) son globales; operations.event también.
--
-- RLS por código: operations.fuel NO tiene escuadrilla_fk. El aislamiento se
-- hace vía la aeronave del repostaje (fuel_helo_fk → operations.aircraft.
-- aircraft_escuadrilla_fk = $N). Todas las sentencias de abajo lo aplican, por
-- lo que quedan acotadas a aeronaves de la escuadrilla de la sesión.
-- ============================================================

-- name: ListFuel :many
-- Lista paginada de repostajes, acotada a la escuadrilla de la sesión ($1) vía
-- la aeronave. Si $2 (fuel_sk) != 0 busca ese registro concreto (ignorando el
-- mes); si $2 = 0 filtra por el rango del mes seleccionado ($3/$4). Devuelve
-- etiquetas resueltas + los *_fk (para precargar el formulario de edición).
SELECT
    f.fuel_sk,
    f.fuel_date,
    f.fuel_helo_fk,
    a.aircraft_number,
    f.fuel_place_fk,
    fp.fuel_place_name,
    fp.fuel_place_type,
    f.fuel_payer_fk,
    pay.fuel_payer_assignment_type_abbrev,
    pay.fuel_payer_name,
    f.fuel_event_fk,
    e.event_name,
    e.event_place,
    f.fuel_phase_fk,
    ph.fuel_phase,
    f.fuel_type_fk,
    ft.fuel_type,
    f.fuel_qty::float8 AS fuel_qty
FROM operations.fuel f
JOIN operations.aircraft a    ON a.aircraft_sk = f.fuel_helo_fk
JOIN operations.fuel_place fp ON fp.fuel_place_sk = f.fuel_place_fk
JOIN operations.fuel_payer pay ON pay.fuel_payer_sk = f.fuel_payer_fk
JOIN operations.event e       ON e.event_sk = f.fuel_event_fk
JOIN operations.fuel_phase ph ON ph.fuel_phase_sk = f.fuel_phase_fk
JOIN operations.fuel_type ft  ON ft.fuel_type_sk = f.fuel_type_fk
WHERE a.aircraft_escuadrilla_fk = $1
  AND ($2 = 0 OR f.fuel_sk = $2)
  AND ($2 <> 0 OR f.fuel_date BETWEEN $3 AND $4)
ORDER BY f.fuel_date DESC, f.fuel_sk DESC
LIMIT $5 OFFSET $6;

-- name: CountFuel :one
-- Número de repostajes con el mismo filtro que ListFuel.
SELECT COUNT(*)::int AS total
FROM operations.fuel f
JOIN operations.aircraft a ON a.aircraft_sk = f.fuel_helo_fk
WHERE a.aircraft_escuadrilla_fk = $1
  AND ($2 = 0 OR f.fuel_sk = $2)
  AND ($2 <> 0 OR f.fuel_date BETWEEN $3 AND $4);

-- ============================================================
-- Resumen del mes. Todas acotadas a la escuadrilla ($1) vía la aeronave y al
-- rango del mes ($2/$3).
-- ============================================================

-- name: FuelDetailGrouped :many
-- Detalle agregado del mes por (pagador, evento, fase, lugar). El servicio lo
-- agrupa por pagador (subtotal) para el informe seccionado. phase_sk ordena las
-- fases por el catálogo (Preparación antes que Ejecución).
SELECT
    pay.fuel_payer_assignment_type_abbrev AS payer,
    e.event_name        AS event,
    e.event_place       AS event_place,
    ph.fuel_phase       AS phase,
    fp.fuel_place_name  AS place_name,
    fp.fuel_place_type  AS place_type,
    SUM(f.fuel_qty)::float8 AS qty
FROM operations.fuel f
JOIN operations.aircraft a     ON a.aircraft_sk = f.fuel_helo_fk
JOIN operations.fuel_payer pay ON pay.fuel_payer_sk = f.fuel_payer_fk
JOIN operations.event e        ON e.event_sk = f.fuel_event_fk
JOIN operations.fuel_phase ph  ON ph.fuel_phase_sk = f.fuel_phase_fk
JOIN operations.fuel_place fp  ON fp.fuel_place_sk = f.fuel_place_fk
WHERE a.aircraft_escuadrilla_fk = $1
  AND f.fuel_date BETWEEN $2 AND $3
GROUP BY pay.fuel_payer_assignment_type_abbrev, e.event_name, e.event_place,
         ph.fuel_phase, ph.fuel_phase_sk, fp.fuel_place_name, fp.fuel_place_type
ORDER BY pay.fuel_payer_assignment_type_abbrev, e.event_name, ph.fuel_phase_sk, fp.fuel_place_name;

-- name: InsertFuel :one
-- Inserta solo si la aeronave ($2) pertenece a la escuadrilla de la sesión ($9);
-- si no, no inserta ninguna fila (RETURNING vacío → ErrNoRows en el service).
INSERT INTO operations.fuel (
    fuel_date, fuel_helo_fk, fuel_place_fk, fuel_payer_fk,
    fuel_event_fk, fuel_phase_fk, fuel_type_fk, fuel_qty
)
SELECT $1, $2, $3, $4, $5, $6, $7, $8
WHERE EXISTS (
    SELECT 1 FROM operations.aircraft
    WHERE aircraft_sk = $2 AND aircraft_escuadrilla_fk = $9
)
RETURNING fuel_sk;

-- name: UpdateFuel :execrows
-- Actualiza un repostaje, acotado a aeronaves de la escuadrilla de la sesión
-- ($10): tanto la fila actual como la nueva aeronave ($3) deben pertenecer a
-- la escuadrilla.
UPDATE operations.fuel f
SET fuel_date     = $2,
    fuel_helo_fk  = $3,
    fuel_place_fk = $4,
    fuel_payer_fk = $5,
    fuel_event_fk = $6,
    fuel_phase_fk = $7,
    fuel_type_fk  = $8,
    fuel_qty      = $9
FROM operations.aircraft a
WHERE f.fuel_sk = $1
  AND a.aircraft_sk = f.fuel_helo_fk
  AND a.aircraft_escuadrilla_fk = $10
  AND EXISTS (
      SELECT 1 FROM operations.aircraft a2
      WHERE a2.aircraft_sk = $3 AND a2.aircraft_escuadrilla_fk = $10
  );

-- name: DeleteFuel :execrows
-- Borra un repostaje solo si su aeronave pertenece a la escuadrilla ($2).
DELETE FROM operations.fuel f
USING operations.aircraft a
WHERE f.fuel_sk = $1
  AND a.aircraft_sk = f.fuel_helo_fk
  AND a.aircraft_escuadrilla_fk = $2;
