package auth

import (
	"errors"
	"net/http"
	"os"
	"time"

	"github.com/labstack/echo/v4"
)

// Handlers agrupa los endpoints /api/v1/auth/*.
type Handlers struct {
	svc          *Service
	cookieSecure bool
	cookieTTL    time.Duration
}

func NewHandlers(svc *Service, sessionTTL time.Duration) *Handlers {
	return &Handlers{
		svc:          svc,
		cookieSecure: os.Getenv("AETHER_COOKIE_SECURE") == "true",
		cookieTTL:    sessionTTL,
	}
}

// Register monta /auth/login, /auth/logout y /auth/me bajo `g`.
func (h *Handlers) Register(g *echo.Group) {
	g.POST("/auth/login", h.Login)
	g.POST("/auth/logout", h.Logout)
	g.GET("/auth/me", h.Me, RequireAuth(h.svc))
}

type loginReq struct {
	User     string `json:"user"`
	Password string `json:"password"`
}

type userDTO struct {
	ID              int    `json:"id"`
	Username        string `json:"username"`
	Name            string `json:"name"`
	LastName1       string `json:"lastName1"`
	LastName2       string `json:"lastName2"`
	EscuadrillaID   int    `json:"escuadrillaId"`
	EscuadrillaCode string `json:"escuadrillaCode"`
	EscuadrillaName string `json:"escuadrillaName"`
	PermissionLevel string `json:"permissionLevel"`
}

func toDTO(u *User) userDTO {
	return userDTO{
		ID:              u.ID,
		Username:        u.Username,
		Name:            u.Name,
		LastName1:       u.LastName1,
		LastName2:       u.LastName2,
		EscuadrillaID:   u.EscuadrillaID,
		EscuadrillaCode: u.EscuadrillaCode,
		EscuadrillaName: u.EscuadrillaName,
		PermissionLevel: u.PermissionLevel,
	}
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
	user := CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "no session")
	}
	return c.JSON(http.StatusOK, toDTO(user))
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
