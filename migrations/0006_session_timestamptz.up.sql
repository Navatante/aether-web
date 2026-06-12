-- Las columnas de detall.session eran TIMESTAMP (sin zona): Go escribía la
-- hora local del servidor de la app y CURRENT_TIMESTAMP usa la zona del
-- servidor PostgreSQL, así que con zonas distintas las sesiones caducaban
-- mal (p.ej. +2h de vida con app en CEST y BD en UTC). timestamptz hace la
-- comparación correcta sea cual sea la zona de cada lado.
--
-- Las sesiones son efímeras: se truncan en vez de convertir valores ambiguos.
TRUNCATE detall.session;

ALTER TABLE detall.session
    ALTER COLUMN created_at   TYPE timestamptz USING created_at   AT TIME ZONE 'UTC',
    ALTER COLUMN expires_at   TYPE timestamptz USING expires_at   AT TIME ZONE 'UTC',
    ALTER COLUMN last_seen_at TYPE timestamptz USING last_seen_at AT TIME ZONE 'UTC';
