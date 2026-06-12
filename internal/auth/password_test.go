package auth

import (
	"errors"
	"strings"
	"testing"
)

func TestHashAndVerifyPassword(t *testing.T) {
	hash, err := HashPassword("s3creto-fuerte")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("hash no tiene formato PHC argon2id: %q", hash)
	}
	if err := VerifyPassword("s3creto-fuerte", hash); err != nil {
		t.Errorf("VerifyPassword con la contraseña correcta: %v", err)
	}
	if err := VerifyPassword("otra-cosa", hash); !errors.Is(err, ErrPasswordMismatch) {
		t.Errorf("VerifyPassword con contraseña incorrecta: got %v, want ErrPasswordMismatch", err)
	}
}

func TestHashPasswordSaltsAreUnique(t *testing.T) {
	h1, err := HashPassword("misma")
	if err != nil {
		t.Fatal(err)
	}
	h2, err := HashPassword("misma")
	if err != nil {
		t.Fatal(err)
	}
	if h1 == h2 {
		t.Error("dos hashes de la misma contraseña no deberían coincidir (salt aleatorio)")
	}
}

func TestVerifyPasswordRejectsMalformedHash(t *testing.T) {
	for _, encoded := range []string{
		"",
		"texto-plano",
		"$argon2i$v=19$m=65536,t=3,p=2$c2FsdA$aGFzaA", // variante no soportada
		"$argon2id$v=19$m=65536$c2FsdA$aGFzaA",        // params incompletos
	} {
		if err := VerifyPassword("x", encoded); !errors.Is(err, ErrInvalidHash) {
			t.Errorf("VerifyPassword(%q): got %v, want ErrInvalidHash", encoded, err)
		}
	}
}

func TestNewSessionTokenIsRandomAndHashed(t *testing.T) {
	tok1, hash1, err := newSessionToken()
	if err != nil {
		t.Fatal(err)
	}
	tok2, _, err := newSessionToken()
	if err != nil {
		t.Fatal(err)
	}
	if tok1 == tok2 {
		t.Error("dos tokens consecutivos no deberían coincidir")
	}
	if len(hash1) != 32 {
		t.Errorf("hash sha256 debería medir 32 bytes, mide %d", len(hash1))
	}
	if got := hashToken(tok1); string(got) != string(hash1) {
		t.Error("hashToken(token) no coincide con el hash devuelto por newSessionToken")
	}
}
