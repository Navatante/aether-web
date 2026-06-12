package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Parámetros argon2id (RFC 9106 — m=64 MiB, t=3, p=2, salt=16, key=32).
const (
	argonMemoryKiB  = 64 * 1024
	argonIterations = 3
	argonParallel   = 2
	argonSaltLen    = 16
	argonKeyLen     = 32
)

var (
	ErrInvalidHash         = errors.New("auth: hash con formato inválido")
	ErrIncompatibleVersion = errors.New("auth: versión argon2 incompatible")
	ErrPasswordMismatch    = errors.New("auth: contraseña incorrecta")
)

// HashPassword devuelve un PHC string argon2id.
// Formato: $argon2id$v=19$m=65536,t=3,p=2$<salt-b64>$<hash-b64>
func HashPassword(password string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("salt: %w", err)
	}
	hash := argon2.IDKey([]byte(password), salt, argonIterations, argonMemoryKiB, argonParallel, argonKeyLen)
	enc := base64.RawStdEncoding
	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemoryKiB, argonIterations, argonParallel,
		enc.EncodeToString(salt), enc.EncodeToString(hash),
	), nil
}

// VerifyPassword compara una contraseña en claro con un PHC string.
// Devuelve nil si coincide, ErrPasswordMismatch si no, o errores de parseo.
func VerifyPassword(password, encoded string) error {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return ErrInvalidHash
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return ErrInvalidHash
	}
	if version != argon2.Version {
		return ErrIncompatibleVersion
	}

	var memory, iterations uint32
	var parallel uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallel); err != nil {
		return ErrInvalidHash
	}

	enc := base64.RawStdEncoding
	salt, err := enc.DecodeString(parts[4])
	if err != nil {
		return ErrInvalidHash
	}
	expected, err := enc.DecodeString(parts[5])
	if err != nil {
		return ErrInvalidHash
	}

	actual := argon2.IDKey([]byte(password), salt, iterations, memory, parallel, uint32(len(expected)))
	if subtle.ConstantTimeCompare(expected, actual) != 1 {
		return ErrPasswordMismatch
	}
	return nil
}
