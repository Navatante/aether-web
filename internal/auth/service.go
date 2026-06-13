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
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/queries"
)

var (
	ErrUnknownUser     = errors.New("auth: usuario desconocido")
	ErrSessionNotFound = errors.New("auth: sesión no encontrada o expirada")
	ErrPasswordNotSet  = errors.New("auth: el usuario no tiene contraseña configurada")
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
	q          *queries.Queries
	sessionTTL time.Duration
}

func NewService(pool *pgxpool.Pool, sessionTTL time.Duration) *Service {
	return &Service{q: queries.New(pool), sessionTTL: sessionTTL}
}

// Login verifica credenciales y crea una sesión. Devuelve el token claro
// (que va al cliente en cookie) y el usuario asociado.
func (s *Service) Login(ctx context.Context, username, password, ipAddress string) (string, *User, error) {
	row, err := s.q.GetLoginPerson(ctx, username)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, ErrUnknownUser
	}
	if err != nil {
		return "", nil, fmt.Errorf("load person: %w", err)
	}
	if row.PersonPasswordHash == nil || *row.PersonPasswordHash == "" {
		return "", nil, ErrPasswordNotSet
	}
	if err := VerifyPassword(password, *row.PersonPasswordHash); err != nil {
		return "", nil, err
	}

	token, tokenHash, err := newSessionToken()
	if err != nil {
		return "", nil, err
	}
	expires := time.Now().Add(s.sessionTTL)

	if err := s.q.CreateSession(ctx, queries.CreateSessionParams{
		TokenHash: tokenHash,
		PersonFk:  row.PersonSk,
		IpAddress: ipAddress,
		ExpiresAt: pgtype.Timestamptz{Time: expires, Valid: true},
	}); err != nil {
		return "", nil, fmt.Errorf("create session: %w", err)
	}

	u := User{
		ID:              int(row.PersonSk),
		Username:        row.PersonUser,
		Name:            row.PersonName,
		LastName1:       row.PersonLastName1,
		LastName2:       row.PersonLastName2,
		Nk:              row.PersonNk,
		EscuadrillaID:   int(row.PersonEscuadrillaFk),
		EscuadrillaCode: row.EscuadrillaCode,
		EscuadrillaName: row.EscuadrillaName,
		PermissionLevel: row.PersonPermissionLevel,
	}
	return token, &u, nil
}

// Logout borra la sesión asociada al token. Idempotente.
func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return s.q.DeleteSessionByTokenHash(ctx, hashToken(token))
}

// Validate busca la sesión por token, comprueba expires_at, actualiza
// last_seen_at y devuelve el User asociado — todo en un único round-trip.
func (s *Service) Validate(ctx context.Context, token string) (*User, error) {
	if token == "" {
		return nil, ErrSessionNotFound
	}
	row, err := s.q.TouchSessionAndGetUser(ctx, hashToken(token))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("touch session: %w", err)
	}
	return &User{
		ID:              int(row.PersonSk),
		Username:        row.PersonUser,
		Name:            row.PersonName,
		LastName1:       row.PersonLastName1,
		LastName2:       row.PersonLastName2,
		Nk:              row.PersonNk,
		EscuadrillaID:   int(row.PersonEscuadrillaFk),
		EscuadrillaCode: row.EscuadrillaCode,
		EscuadrillaName: row.EscuadrillaName,
		PermissionLevel: row.PersonPermissionLevel,
	}, nil
}

// SetPassword actualiza el hash de contraseña de un usuario existente.
// Usado por cmd/bootstrap. Devuelve número de filas afectadas.
func (s *Service) SetPassword(ctx context.Context, username, password string) (int64, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return 0, err
	}
	return s.q.SetPersonPassword(ctx, queries.SetPersonPasswordParams{
		PersonPasswordHash: &hash,
		PersonUser:         username,
	})
}

// SetPermissionLevel fija el nivel de permiso de un usuario existente.
// Usado por cmd/bootstrap (p. ej. para crear el primer Superusuario).
// Devuelve número de filas afectadas. El nivel se valida contra el CHECK de BD.
func (s *Service) SetPermissionLevel(ctx context.Context, username, level string) (int64, error) {
	return s.q.SetPersonPermissionLevelByUser(ctx, queries.SetPersonPermissionLevelByUserParams{
		PersonPermissionLevel: level,
		PersonUser:            username,
	})
}

// PurgeExpired elimina sesiones caducadas. Lo llama el job periódico de main.
func (s *Service) PurgeExpired(ctx context.Context) (int64, error) {
	return s.q.PurgeExpiredSessions(ctx)
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
