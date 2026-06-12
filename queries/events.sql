-- ============================================================
-- Events (Hito 4, lote 2)
-- Reemplaza operations.sp_get_events + add_event + update_event.
-- operations.event no tiene escuadrilla_fk → catálogo global.
-- ============================================================

-- name: GetEventsAll :many
SELECT event_sk, event_name, event_place
FROM operations.event
ORDER BY event_name;

-- name: CountEvents :one
SELECT COUNT(*)::int AS total FROM operations.event;

-- name: InsertEvent :one
-- Devuelve el sk para que el frontend pueda redirigir / seleccionar.
INSERT INTO operations.event (event_name, event_place)
VALUES ($1, $2)
RETURNING event_sk;

-- name: UpdateEvent :execrows
UPDATE operations.event
SET event_name = $1, event_place = $2
WHERE event_sk = $3;
