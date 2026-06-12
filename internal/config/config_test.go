package config

import (
	"testing"
	"time"
)

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("AETHER_DATABASE_URL", "")
	if _, err := Load(); err == nil {
		t.Fatal("Load sin AETHER_DATABASE_URL debería fallar")
	}
}

func TestLoadDefaults(t *testing.T) {
	t.Setenv("AETHER_DATABASE_URL", "postgres://u:p@localhost:5432/db")
	t.Setenv("AETHER_ADDR", "")
	t.Setenv("AETHER_SESSION_TTL", "")
	t.Setenv("AETHER_COOKIE_SECURE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Addr != ":8080" {
		t.Errorf("Addr default: got %q, want :8080", cfg.Addr)
	}
	if cfg.SessionTTL != 8*time.Hour {
		t.Errorf("SessionTTL default: got %v, want 8h", cfg.SessionTTL)
	}
	if cfg.CookieSecure {
		t.Error("CookieSecure default debería ser false")
	}
}

func TestLoadParsesTTLFormats(t *testing.T) {
	cases := map[string]time.Duration{
		"12h":   12 * time.Hour,
		"30m":   30 * time.Minute,
		"43200": 43200 * time.Second,
	}
	for raw, want := range cases {
		t.Setenv("AETHER_DATABASE_URL", "postgres://u:p@localhost/db")
		t.Setenv("AETHER_SESSION_TTL", raw)
		cfg, err := Load()
		if err != nil {
			t.Errorf("Load con TTL %q: %v", raw, err)
			continue
		}
		if cfg.SessionTTL != want {
			t.Errorf("TTL %q: got %v, want %v", raw, cfg.SessionTTL, want)
		}
	}
}

func TestLoadRejectsBadTTL(t *testing.T) {
	for _, raw := range []string{"abc", "-5m", "0", "-300"} {
		t.Setenv("AETHER_DATABASE_URL", "postgres://u:p@localhost/db")
		t.Setenv("AETHER_SESSION_TTL", raw)
		if _, err := Load(); err == nil {
			t.Errorf("Load con TTL %q debería fallar", raw)
		}
	}
}
