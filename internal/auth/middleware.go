package auth

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
)

// Nombre de la cookie de sesión y clave en echo.Context donde se inyecta el User.
const (
	CookieName = "aether_session"
	ctxUserKey = "auth.user"
)

// Niveles de permiso válidos. Espejo del CHECK chk_person_permission_level
// en detall.person (migración 0001).
const (
	PermComun          = "Común"
	PermOperacional    = "Operacional"
	PermAdministrativo = "Administrativo"
	PermSeguridad      = "Seguridad"
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
			if _, ok := allowed[user.PermissionLevel]; !ok {
				return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions")
			}
			return next(c)
		}
	}
}

// CurrentUser devuelve el User inyectado por RequireAuth, o nil si no hay.
func CurrentUser(c echo.Context) *User {
	if v, ok := c.Get(ctxUserKey).(*User); ok {
		return v
	}
	return nil
}
