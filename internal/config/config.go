// Package config centraliza la lectura y validación de todas las variables
// de entorno AETHER_* que consume el binario. Es el único sitio del código
// donde se llama a os.Getenv para configuración del servidor.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

const (
	defaultAddr       = ":8080"
	defaultSessionTTL = 8 * time.Hour
)

type Config struct {
	// Addr es la dirección de escucha HTTP (AETHER_ADDR, default ":8080").
	Addr string
	// DatabaseURL es el DSN pgx de PostgreSQL (AETHER_DATABASE_URL, obligatoria).
	DatabaseURL string
	// SessionTTL es la vigencia de las sesiones (AETHER_SESSION_TTL,
	// duración Go o segundos, default 8h).
	SessionTTL time.Duration
	// CookieSecure marca la cookie de sesión como Secure
	// (AETHER_COOKIE_SECURE=true; requiere HTTPS).
	CookieSecure bool
	// TrustedProxy indica que hay un reverse proxy de confianza en loopback
	// (AETHER_TRUSTED_PROXY=true): la IP del cliente se lee de X-Forwarded-For.
	// Sin proxy debe quedar a false: la cabecera la puede enviar cualquiera.
	TrustedProxy bool
}

// Load lee el entorno y valida. Falla (en vez de usar defaults silenciosos)
// si falta configuración crítica como el DSN de la base de datos.
func Load() (Config, error) {
	cfg := Config{
		Addr:         os.Getenv("AETHER_ADDR"),
		DatabaseURL:  os.Getenv("AETHER_DATABASE_URL"),
		SessionTTL:   defaultSessionTTL,
		CookieSecure: os.Getenv("AETHER_COOKIE_SECURE") == "true",
		TrustedProxy: os.Getenv("AETHER_TRUSTED_PROXY") == "true",
	}
	if cfg.Addr == "" {
		cfg.Addr = defaultAddr
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("AETHER_DATABASE_URL no está definida (DSN de PostgreSQL, p.ej. postgres://user:pass@host:5432/aether)")
	}

	if raw := os.Getenv("AETHER_SESSION_TTL"); raw != "" {
		ttl, err := parseTTL(raw)
		if err != nil {
			return Config{}, fmt.Errorf("AETHER_SESSION_TTL no parseable (%q): acepta duración Go (\"8h\") o segundos (\"28800\")", raw)
		}
		cfg.SessionTTL = ttl
	}
	return cfg, nil
}

func parseTTL(raw string) (time.Duration, error) {
	if d, err := time.ParseDuration(raw); err == nil {
		if d <= 0 {
			return 0, errors.New("debe ser positiva")
		}
		return d, nil
	}
	secs, err := strconv.Atoi(raw)
	if err != nil || secs <= 0 {
		return 0, errors.New("formato inválido")
	}
	return time.Duration(secs) * time.Second, nil
}
