TRUNCATE detall.session;

ALTER TABLE detall.session
    ALTER COLUMN created_at   TYPE timestamp USING created_at   AT TIME ZONE 'UTC',
    ALTER COLUMN expires_at   TYPE timestamp USING expires_at   AT TIME ZONE 'UTC',
    ALTER COLUMN last_seen_at TYPE timestamp USING last_seen_at AT TIME ZONE 'UTC';
