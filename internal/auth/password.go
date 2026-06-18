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
	ErrPasswordTooShort    = errors.New("auth: la contraseña debe tener al menos 8 caracteres")
	ErrPasswordIsDefault   = errors.New("auth: la contraseña no puede ser la contraseña por defecto")
)

// DefaultPassword es la contraseña que reciben las altas y los reseteos del
// Superusuario. Es de conocimiento general (se comunica verbalmente); por eso
// toda cuenta con esta contraseña queda marcada con person_password_must_change
// y se fuerza el cambio en el siguiente login. NUNCA debe usarse para decidir
// si hay que forzar el cambio (eso lo gobierna la columna booleana), solo como
// valor inicial conveniente.
const DefaultPassword = "aether"

// minPasswordLen es la longitud mínima exigida a una contraseña elegida por el
// usuario (no aplica al DefaultPassword, que es transitorio y forzado a cambio).
const minPasswordLen = 8

// ValidatePassword aplica la política mínima a una contraseña NUEVA elegida por
// el usuario: longitud mínima y que no sea la contraseña por defecto.
func ValidatePassword(password string) error {
	if len(password) < minPasswordLen {
		return ErrPasswordTooShort
	}
	if password == DefaultPassword {
		return ErrPasswordIsDefault
	}
	return nil
}

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
