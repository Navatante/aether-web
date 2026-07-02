package auth

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"
)

// Handlers agrupa los endpoints /api/v1/auth/*.
type Handlers struct {
	svc          *Service
	cookieSecure bool
	cookieTTL    time.Duration
}

func NewHandlers(svc *Service, sessionTTL time.Duration, cookieSecure bool) *Handlers {
	return &Handlers{
		svc:          svc,
		cookieSecure: cookieSecure,
		cookieTTL:    sessionTTL,
	}
}

// newCredentialLimiter frena fuerza bruta por IP en endpoints que verifican
// contraseñas: ráfaga de 3 intentos, luego 1 cada 5s. Cada endpoint recibe su
// propia instancia (buckets independientes) para que agotar el de login no
// bloquee un cambio de contraseña legítimo.
func newCredentialLimiter() echo.MiddlewareFunc {
	return middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      rate.Limit(0.2),
			Burst:     3,
			ExpiresIn: 10 * time.Minute,
		}),
	})
}

// Register monta /auth/login, /auth/logout y /auth/me bajo `g`.
func (h *Handlers) Register(g *echo.Group) {
	g.POST("/auth/login", h.Login, newCredentialLimiter())
	g.POST("/auth/logout", h.Logout)
	g.GET("/auth/me", h.Me)
	g.POST("/auth/change-password", h.ChangePassword, RequireAuth(h.svc), newCredentialLimiter())
}

type loginReq struct {
	User     string `json:"user"`
	Password string `json:"password"`
}

type userDTO struct {
	ID                 int     `json:"id"`
	Username           string  `json:"username"`
	Name               string  `json:"name"`
	LastName1          string  `json:"lastName1"`
	LastName2          string  `json:"lastName2"`
	Nk                 *string `json:"nk"`
	EscuadrillaID      int     `json:"escuadrillaId"`
	EscuadrillaCode    string  `json:"escuadrillaCode"`
	EscuadrillaName    string  `json:"escuadrillaName"`
	PermissionLevel    string  `json:"permissionLevel"`
	MustChangePassword bool    `json:"mustChangePassword"`
}

func toDTO(u *User) userDTO {
	return userDTO{
		ID:                 u.ID,
		Username:           u.Username,
		Name:               u.Name,
		LastName1:          u.LastName1,
		LastName2:          u.LastName2,
		Nk:                 u.Nk,
		EscuadrillaID:      u.EscuadrillaID,
		EscuadrillaCode:    u.EscuadrillaCode,
		EscuadrillaName:    u.EscuadrillaName,
		PermissionLevel:    u.PermissionLevel,
		MustChangePassword: u.MustChangePassword,
	}
}

type changePasswordReq struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func (h *Handlers) Login(c echo.Context) error {
	var req loginReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.User == "" || req.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "user and password are required")
	}

	token, user, err := h.svc.Login(c.Request().Context(), req.User, req.Password, c.RealIP())
	if err != nil {
		// Respuesta genérica: no filtrar si el fallo es por usuario inexistente o password.
		if errors.Is(err, ErrUnknownUser) || errors.Is(err, ErrPasswordMismatch) || errors.Is(err, ErrPasswordNotSet) {
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid credentials")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "login failed")
	}

	h.setSessionCookie(c, token)
	return c.JSON(http.StatusOK, toDTO(user))
}

func (h *Handlers) Logout(c echo.Context) error {
	cookie, err := c.Cookie(CookieName)
	if err == nil && cookie.Value != "" {
		_ = h.svc.Logout(c.Request().Context(), cookie.Value)
	}
	h.clearSessionCookie(c)
	return c.NoContent(http.StatusNoContent)
}

func (h *Handlers) Me(c echo.Context) error {
	cookie, err := c.Cookie(CookieName)
	if err != nil || cookie.Value == "" {
		return c.NoContent(http.StatusNoContent)
	}
	user, err := h.svc.Validate(c.Request().Context(), cookie.Value)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			return c.NoContent(http.StatusNoContent)
		}
		return err
	}
	return c.JSON(http.StatusOK, toDTO(user))
}

func (h *Handlers) ChangePassword(c echo.Context) error {
	user := CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "no session")
	}
	var req changePasswordReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	err := h.svc.ChangeOwnPassword(c.Request().Context(), int32(user.ID), user.Username, c.RealIP(), req.CurrentPassword, req.NewPassword)
	switch {
	case errors.Is(err, ErrPasswordTooShort):
		return echo.NewHTTPError(http.StatusBadRequest, "la contraseña debe tener al menos 8 caracteres")
	case errors.Is(err, ErrPasswordIsDefault):
		return echo.NewHTTPError(http.StatusBadRequest, "la contraseña no puede ser la contraseña por defecto")
	case errors.Is(err, ErrPasswordMismatch), errors.Is(err, ErrPasswordNotSet):
		return echo.NewHTTPError(http.StatusUnauthorized, "la contraseña actual no es correcta")
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handlers) setSessionCookie(c echo.Context, token string) {
	c.SetCookie(&http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(h.cookieTTL),
	})
}

func (h *Handlers) clearSessionCookie(c echo.Context) {
	c.SetCookie(&http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}
