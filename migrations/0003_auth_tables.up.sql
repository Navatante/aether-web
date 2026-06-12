-- ============================================================
-- Auth (Hito 2)
--
-- Modelo de autenticación basado en:
--   - person.person_password_hash: argon2id PHC string.
--   - detall.session: sesiones server-side, una fila por sesión activa.
--     El cliente recibe un token aleatorio en cookie HttpOnly; en BD
--     guardamos SHA-256(token) — robo de la BD no permite reusar tokens.
-- ============================================================

ALTER TABLE detall.person
    ADD COLUMN person_password_hash VARCHAR(255);

CREATE TABLE detall.session (
    session_sk     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    token_hash     BYTEA       NOT NULL,
    person_fk      INTEGER     NOT NULL REFERENCES detall.person(person_sk) ON DELETE CASCADE,
    ip_address     VARCHAR(45),
    created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     TIMESTAMP   NOT NULL,
    last_seen_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ix_session_token_hash ON detall.session (token_hash);
CREATE INDEX ix_session_expires_at        ON detall.session (expires_at);
CREATE INDEX ix_session_person_fk         ON detall.session (person_fk);
