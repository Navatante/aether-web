package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUnknownUser       = errors.New("auth: usuario desconocido")
	ErrSessionNotFound   = errors.New("auth: sesión no encontrada o expirada")
	ErrPasswordNotSet    = errors.New("auth: el usuario no tiene contraseña configurada")
)

// User es el sujeto autenticado. Lo pone el middleware en echo.Context.
type User struct {
	ID              int
	Username        string
	Name            string
	LastName1       string
	LastName2       string
	Nk              *string // indicativo (person_nk), nullable
	EscuadrillaID   int
	EscuadrillaCode string
	EscuadrillaName string
	PermissionLevel string
}

type Service struct {
	pool       *pgxpool.Pool
	sessionTTL time.Duration
}

func NewService(pool *pgxpool.Pool, sessionTTL time.Duration) *Service {
	return &Service{pool: pool, sessionTTL: sessionTTL}
}

// Login verifica credenciales y crea una sesión. Devuelve el token claro
// (que va al cliente en cookie) y el usuario asociado.
func (s *Service) Login(ctx context.Context, username, password, ipAddress string) (string, *User, error) {
	const q = `
		SELECT p.person_sk, p.person_user, p.person_name, p.person_last_name_1, p.person_last_name_2,
		       p.person_nk, p.person_escuadrilla_fk, e.escuadrilla_code, e.escuadrilla_name,
		       p.person_permission_level, p.person_password_hash
		FROM detall.person p
		JOIN detall.escuadrilla e ON e.escuadrilla_sk = p.person_escuadrilla_fk
		WHERE p.person_user = $1 AND p.person_current_flag = TRUE`
	var (
		u    User
		hash *string
	)
	err := s.pool.QueryRow(ctx, q, username).Scan(
		&u.ID, &u.Username, &u.Name, &u.LastName1, &u.LastName2,
		&u.Nk, &u.EscuadrillaID, &u.EscuadrillaCode, &u.EscuadrillaName,
		&u.PermissionLevel, &hash,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, ErrUnknownUser
	}
	if err != nil {
		return "", nil, fmt.Errorf("load person: %w", err)
	}
	if hash == nil || *hash == "" {
		return "", nil, ErrPasswordNotSet
	}
	if err := VerifyPassword(password, *hash); err != nil {
		return "", nil, err
	}

	token, tokenHash, err := newSessionToken()
	if err != nil {
		return "", nil, err
	}
	expires := time.Now().Add(s.sessionTTL)

	_, err = s.pool.Exec(ctx,
		`INSERT INTO detall.session (token_hash, person_fk, ip_address, expires_at)
		 VALUES ($1, $2, NULLIF($3, ''), $4)`,
		tokenHash, u.ID, ipAddress, expires,
	)
	if err != nil {
		return "", nil, fmt.Errorf("create session: %w", err)
	}
	return token, &u, nil
}

// Logout borra la sesión asociada al token. Idempotente.
func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	hash := hashToken(token)
	_, err := s.pool.Exec(ctx, `DELETE FROM detall.session WHERE token_hash = $1`, hash)
	return err
}

// Validate busca la sesión por token, comprueba expires_at y actualiza last_seen_at.
// Devuelve el User asociado.
func (s *Service) Validate(ctx context.Context, token string) (*User, error) {
	if token == "" {
		return nil, ErrSessionNotFound
	}
	hash := hashToken(token)

	const q = `
		UPDATE detall.session
		SET last_seen_at = CURRENT_TIMESTAMP
		WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP
		RETURNING person_fk`
	var personID int
	err := s.pool.QueryRow(ctx, q, hash).Scan(&personID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("touch session: %w", err)
	}

	const qUser = `
		SELECT p.person_sk, p.person_user, p.person_name, p.person_last_name_1, p.person_last_name_2,
		       p.person_nk, p.person_escuadrilla_fk, e.escuadrilla_code, e.escuadrilla_name,
		       p.person_permission_level
		FROM detall.person p
		JOIN detall.escuadrilla e ON e.escuadrilla_sk = p.person_escuadrilla_fk
		WHERE p.person_sk = $1 AND p.person_current_flag = TRUE`
	var u User
	if err := s.pool.QueryRow(ctx, qUser, personID).Scan(
		&u.ID, &u.Username, &u.Name, &u.LastName1, &u.LastName2,
		&u.Nk, &u.EscuadrillaID, &u.EscuadrillaCode, &u.EscuadrillaName,
		&u.PermissionLevel,
	); err != nil {
		return nil, fmt.Errorf("load person: %w", err)
	}
	return &u, nil
}

// SetPassword actualiza el hash de contraseña de un usuario existente.
// Usado por cmd/bootstrap. Devuelve número de filas afectadas.
func (s *Service) SetPassword(ctx context.Context, username, password string) (int64, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return 0, err
	}
	tag, err := s.pool.Exec(ctx,
		`UPDATE detall.person SET person_password_hash = $1 WHERE person_user = $2`,
		hash, username,
	)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// PurgeExpired elimina sesiones caducadas. Útil para un job periódico.
func (s *Service) PurgeExpired(ctx context.Context) (int64, error) {
	tag, err := s.pool.Exec(ctx, `DELETE FROM detall.session WHERE expires_at <= CURRENT_TIMESTAMP`)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// ============================================================
// Token helpers
// ============================================================

const sessionTokenBytes = 32

// newSessionToken genera 32 bytes aleatorios y devuelve (tokenClaro, sha256(token)).
// El token claro va al cliente; sólo el hash se guarda en BD.
func newSessionToken() (string, []byte, error) {
	buf := make([]byte, sessionTokenBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", nil, fmt.Errorf("token rand: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(buf)
	hash := sha256.Sum256([]byte(token))
	return token, hash[:], nil
}

func hashToken(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}
