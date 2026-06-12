package auth_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/testdb"
)

func TestAuthFlowIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	svc := auth.NewService(pool, time.Hour)

	testdb.CreatePerson(t, ctx, pool, "piloto1", auth.PermOperacional)

	// Sin contraseña configurada → credenciales inválidas.
	if _, _, err := svc.Login(ctx, "piloto1", "loquesea", "127.0.0.1"); !errors.Is(err, auth.ErrPasswordNotSet) {
		t.Fatalf("login sin password: got %v, want ErrPasswordNotSet", err)
	}

	if n, err := svc.SetPassword(ctx, "piloto1", "secreta-123"); err != nil || n != 1 {
		t.Fatalf("SetPassword: n=%d err=%v", n, err)
	}

	// Contraseña incorrecta.
	if _, _, err := svc.Login(ctx, "piloto1", "mala", "127.0.0.1"); !errors.Is(err, auth.ErrPasswordMismatch) {
		t.Fatalf("login con password mala: got %v, want ErrPasswordMismatch", err)
	}
	// Usuario inexistente.
	if _, _, err := svc.Login(ctx, "nadie", "x", "127.0.0.1"); !errors.Is(err, auth.ErrUnknownUser) {
		t.Fatalf("login usuario inexistente: got %v, want ErrUnknownUser", err)
	}

	// Login correcto.
	token, user, err := svc.Login(ctx, "piloto1", "secreta-123", "127.0.0.1")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if token == "" || user == nil {
		t.Fatal("login: token o user vacíos")
	}
	if user.PermissionLevel != auth.PermOperacional || user.EscuadrillaID != int(testdb.EscuadrillaID) {
		t.Errorf("user inesperado: %+v", user)
	}

	// Validate devuelve el mismo usuario.
	got, err := svc.Validate(ctx, token)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if got.Username != "piloto1" || got.PermissionLevel != auth.PermOperacional {
		t.Errorf("validate user inesperado: %+v", got)
	}

	// Token desconocido.
	if _, err := svc.Validate(ctx, "token-falso"); !errors.Is(err, auth.ErrSessionNotFound) {
		t.Errorf("validate token falso: got %v, want ErrSessionNotFound", err)
	}

	// Logout invalida la sesión (idempotente).
	if err := svc.Logout(ctx, token); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if _, err := svc.Validate(ctx, token); !errors.Is(err, auth.ErrSessionNotFound) {
		t.Errorf("validate tras logout: got %v, want ErrSessionNotFound", err)
	}
	if err := svc.Logout(ctx, token); err != nil {
		t.Errorf("logout repetido debería ser idempotente: %v", err)
	}
}

func TestExpiredSessionsIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()

	testdb.CreatePerson(t, ctx, pool, "piloto2", auth.PermComun)
	expired := auth.NewService(pool, -time.Hour) // las sesiones nacen caducadas
	if _, err := expired.SetPassword(ctx, "piloto2", "secreta-123"); err != nil {
		t.Fatal(err)
	}
	token, _, err := expired.Login(ctx, "piloto2", "secreta-123", "")
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	if _, err := expired.Validate(ctx, token); !errors.Is(err, auth.ErrSessionNotFound) {
		t.Errorf("sesión caducada debería rechazarse: got %v", err)
	}

	n, err := expired.PurgeExpired(ctx)
	if err != nil {
		t.Fatalf("purge: %v", err)
	}
	if n != 1 {
		t.Errorf("purge: borradas %d sesiones, want 1", n)
	}
}
