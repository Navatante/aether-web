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
	t.Setenv("AETHER_TRUSTED_PROXY", "")

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
	if cfg.TrustedProxy {
		t.Error("TrustedProxy default debería ser false")
	}
}

func TestLoadTrustedProxyOnlyTrue(t *testing.T) {
	for raw, want := range map[string]bool{"true": true, "1": false, "yes": false, "TRUE": false} {
		t.Setenv("AETHER_DATABASE_URL", "postgres://u:p@localhost/db")
		t.Setenv("AETHER_TRUSTED_PROXY", raw)
		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load con AETHER_TRUSTED_PROXY=%q: %v", raw, err)
		}
		if cfg.TrustedProxy != want {
			t.Errorf("AETHER_TRUSTED_PROXY=%q: got %v, want %v", raw, cfg.TrustedProxy, want)
		}
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
