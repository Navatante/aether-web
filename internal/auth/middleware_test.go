package auth

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func newTestContext(t *testing.T) echo.Context {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/flights", nil)
	rec := httptest.NewRecorder()
	return e.NewContext(req, rec)
}

func okHandler(c echo.Context) error { return c.NoContent(http.StatusOK) }

func TestRequirePermissionAllowsListedLevel(t *testing.T) {
	c := newTestContext(t)
	c.Set(ctxUserKey, &User{Username: "ops", PermissionLevel: PermOperacional})

	h := RequirePermission(PermOperacional, PermAdministrativo)(okHandler)
	if err := h(c); err != nil {
		t.Errorf("nivel permitido rechazado: %v", err)
	}
}

func TestRequirePermissionRejectsOtherLevels(t *testing.T) {
	for _, level := range []string{PermComun, PermSeguridad} {
		c := newTestContext(t)
		c.Set(ctxUserKey, &User{Username: "user", PermissionLevel: level})

		h := RequirePermission(PermOperacional)(okHandler)
		err := h(c)
		var he *echo.HTTPError
		if !errors.As(err, &he) || he.Code != http.StatusForbidden {
			t.Errorf("nivel %q: got %v, want 403", level, err)
		}
	}
}

func TestRequirePermissionWithoutUserIs401(t *testing.T) {
	c := newTestContext(t)
	h := RequirePermission(PermOperacional)(okHandler)
	err := h(c)
	var he *echo.HTTPError
	if !errors.As(err, &he) || he.Code != http.StatusUnauthorized {
		t.Errorf("sin usuario en contexto: got %v, want 401", err)
	}
}

func TestRequireAuthWithoutCookieIs401(t *testing.T) {
	c := newTestContext(t)
	h := RequireAuth(&Service{})(okHandler)
	err := h(c)
	var he *echo.HTTPError
	if !errors.As(err, &he) || he.Code != http.StatusUnauthorized {
		t.Errorf("sin cookie: got %v, want 401", err)
	}
}

func TestCurrentUserNilWhenAbsent(t *testing.T) {
	c := newTestContext(t)
	if u := CurrentUser(c); u != nil {
		t.Errorf("CurrentUser sin sesión: got %+v, want nil", u)
	}
}
