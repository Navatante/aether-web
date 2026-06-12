-- Queries de autenticación y sesiones (internal/auth).

-- name: GetLoginPerson :one
SELECT p.person_sk, p.person_user, p.person_name, p.person_last_name_1, p.person_last_name_2,
       p.person_nk, p.person_escuadrilla_fk, e.escuadrilla_code, e.escuadrilla_name,
       p.person_permission_level, p.person_password_hash
FROM detall.person p
JOIN detall.escuadrilla e ON e.escuadrilla_sk = p.person_escuadrilla_fk
WHERE p.person_user = $1 AND p.person_current_flag = TRUE;

-- name: CreateSession :exec
INSERT INTO detall.session (token_hash, person_fk, ip_address, expires_at)
VALUES (sqlc.arg(token_hash), sqlc.arg(person_fk), NULLIF(sqlc.arg(ip_address)::varchar, ''), sqlc.arg(expires_at));

-- name: DeleteSessionByTokenHash :exec
DELETE FROM detall.session WHERE token_hash = $1;

-- name: TouchSessionAndGetUser :one
-- Valida la sesión, actualiza last_seen_at y devuelve el usuario en un solo
-- round-trip (antes eran un UPDATE + un SELECT separados).
UPDATE detall.session s
SET last_seen_at = CURRENT_TIMESTAMP
FROM detall.person p
JOIN detall.escuadrilla e ON e.escuadrilla_sk = p.person_escuadrilla_fk
WHERE s.token_hash = $1
  AND s.expires_at > CURRENT_TIMESTAMP
  AND p.person_sk = s.person_fk
  AND p.person_current_flag = TRUE
RETURNING p.person_sk, p.person_user, p.person_name, p.person_last_name_1, p.person_last_name_2,
          p.person_nk, p.person_escuadrilla_fk, e.escuadrilla_code, e.escuadrilla_name,
          p.person_permission_level;

-- name: SetPersonPassword :execrows
UPDATE detall.person SET person_password_hash = $1 WHERE person_user = $2;

-- name: PurgeExpiredSessions :execrows
DELETE FROM detall.session WHERE expires_at <= CURRENT_TIMESTAMP;
