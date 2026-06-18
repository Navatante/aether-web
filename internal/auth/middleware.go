package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

// Nombre de la cookie de sesión y clave en echo.Context donde se inyecta el User.
const (
	CookieName = "aether_session"
	ctxUserKey = "auth.user"
)

// Niveles de permiso válidos. Espejo del CHECK chk_person_permission_level
// en detall.person (migración 0001).
//
// EXCEPCIÓN al modelo plano: PermSuperusuario es god-mode. A diferencia del
// resto (allow-list exacta, sin jerarquía), un Superusuario pasa cualquier
// RequirePermission (ver el bypass abajo). Es el único nivel jerárquico.
const (
	PermComun          = "Común"
	PermOperacional    = "Operacional"
	PermAdministrativo = "Administrativo"
	PermSeguridad      = "Seguridad"
	PermSuperusuario   = "Superusuario"
)

// RequireAuth valida la sesión y rechaza con 401 si no es válida. Inyecta
// el User en el contexto para los handlers downstream.
func RequireAuth(svc *Service) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			cookie, err := c.Cookie(CookieName)
			if err != nil || cookie.Value == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing session")
			}
			user, err := svc.Validate(c.Request().Context(), cookie.Value)
			if err != nil {
				if errors.Is(err, ErrSessionNotFound) {
					return echo.NewHTTPError(http.StatusUnauthorized, "invalid session")
				}
				return echo.NewHTTPError(http.StatusInternalServerError, "session validation failed")
			}
			// Garantía real del cambio forzado: mientras la cuenta tenga la
			// contraseña por defecto (must_change), la sesión solo sirve para
			// leer el propio estado y cambiar la contraseña. La redirección del
			// frontend es solo cosmética.
			if user.MustChangePassword && !isMustChangeAllowed(c.Path()) {
				return echo.NewHTTPError(http.StatusForbidden, "password change required")
			}
			c.Set(ctxUserKey, user)
			return next(c)
		}
	}
}

// RequirePermission rechaza con 403 si el usuario autenticado no tiene uno de
// los niveles indicados (allow-list, sin jerarquía — igual que el frontend).
// Debe encadenarse después de RequireAuth.
func RequirePermission(levels ...string) echo.MiddlewareFunc {
	allowed := make(map[string]struct{}, len(levels))
	for _, l := range levels {
		allowed[l] = struct{}{}
	}
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user := CurrentUser(c)
			if user == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing session")
			}
			// God-mode: el Superusuario pasa toda ruta protegida, presente o
			// futura, sin necesidad de listarlo en cada RequirePermission.
			if user.PermissionLevel == PermSuperusuario {
				return next(c)
			}
			if _, ok := allowed[user.PermissionLevel]; !ok {
				return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions")
			}
			return next(c)
		}
	}
}

// isMustChangeAllowed indica si la ruta puede usarse mientras la cuenta está
// pendiente de cambiar la contraseña por defecto: solo leer el propio estado
// (/auth/me) y cambiar la contraseña (/auth/change-password).
func isMustChangeAllowed(path string) bool {
	return strings.HasSuffix(path, "/auth/me") ||
		strings.HasSuffix(path, "/auth/change-password")
}

// CurrentUser devuelve el User inyectado por RequireAuth, o nil si no hay.
func CurrentUser(c echo.Context) *User {
	if v, ok := c.Get(ctxUserKey).(*User); ok {
		return v
	}
	return nil
}
