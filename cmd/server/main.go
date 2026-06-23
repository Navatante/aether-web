package main

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/config"
	"github.com/14esc/aether-web/internal/db"
	"github.com/14esc/aether-web/internal/domain/availability"
	"github.com/14esc/aether-web/internal/domain/comisiones"
	"github.com/14esc/aether-web/internal/domain/dashboard"
	"github.com/14esc/aether-web/internal/domain/esfuerzo"
	"github.com/14esc/aether-web/internal/domain/events"
	"github.com/14esc/aether-web/internal/domain/extrahours"
	"github.com/14esc/aether-web/internal/domain/festivos"
	"github.com/14esc/aether-web/internal/domain/flights"
	"github.com/14esc/aether-web/internal/domain/flightsafety"
	"github.com/14esc/aether-web/internal/domain/fuel"
	"github.com/14esc/aether-web/internal/domain/groundschool"
	"github.com/14esc/aether-web/internal/domain/hours"
	"github.com/14esc/aether-web/internal/domain/landings"
	"github.com/14esc/aether-web/internal/domain/lookups"
	"github.com/14esc/aether-web/internal/domain/papeletas"
	"github.com/14esc/aether-web/internal/domain/persons"
	"github.com/14esc/aether-web/internal/domain/projectiles"
	"github.com/14esc/aether-web/internal/domain/ratings"
	"github.com/14esc/aether-web/internal/domain/training"
	"github.com/14esc/aether-web/internal/httpx"
	"github.com/14esc/aether-web/web"
)

const (
	shutdownTimeout      = 10 * time.Second
	sessionPurgeInterval = time.Hour
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("aether-web terminó con error", slog.Any("err", err))
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// ctx se cancela con SIGINT/SIGTERM: dispara el apagado ordenado.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.New(ctx, db.DefaultConfig(cfg.DatabaseURL))
	if err != nil {
		return err
	}
	defer pool.Close()

	authSvc := auth.NewService(pool, cfg.SessionTTL)
	authHandlers := auth.NewHandlers(authSvc, cfg.SessionTTL, cfg.CookieSecure)

	distFS, err := web.DistFS()
	if err != nil {
		return err
	}

	e := echo.New()
	e.HideBanner = true
	// La IP del cliente alimenta la auditoría (sesiones, tr_audit_flight) y los
	// logs: no puede ser falsificable. Sin proxy se usa la IP de la conexión TCP
	// e ignoramos X-Forwarded-For. Con AETHER_TRUSTED_PROXY=true se honra el XFF,
	// pero confiando solo en loopback (el default de Echo incluye rangos privados,
	// que en una intranet son los propios clientes).
	if cfg.TrustedProxy {
		e.IPExtractor = echo.ExtractIPFromXFFHeader(
			echo.TrustLinkLocal(false),
			echo.TrustPrivateNet(false),
		)
	} else {
		e.IPExtractor = echo.ExtractIPDirect()
	}
	e.HTTPErrorHandler = httpx.NewHTTPErrorHandler(logger)
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	e.Use(requestLogger(logger))
	e.Use(middleware.BodyLimit("2M"))

	dashboardHandlers := dashboard.NewHandlers(dashboard.NewService(pool))
	lookupsHandlers := lookups.NewHandlers(lookups.NewService(pool))
	eventsHandlers := events.NewHandlers(events.NewService(pool))
	festivosHandlers := festivos.NewHandlers(festivos.NewService(pool))
	papeletasHandlers := papeletas.NewHandlers(papeletas.NewService(pool))
	personsHandlers := persons.NewHandlers(persons.NewService(pool))
	availabilityHandlers := availability.NewHandlers(availability.NewService(pool))
	trainingHandlers := training.NewHandlers(training.NewService(pool))
	comisionesHandlers := comisiones.NewHandlers(comisiones.NewService(pool))
	ratingsHandlers := ratings.NewHandlers(ratings.NewService(pool))
	hoursHandlers := hours.NewHandlers(hours.NewService(pool))
	landingsHandlers := landings.NewHandlers(landings.NewService(pool))
	projectilesHandlers := projectiles.NewHandlers(projectiles.NewService(pool))
	esfuerzoHandlers := esfuerzo.NewHandlers(esfuerzo.NewService(pool))
	flightsHandlers := flights.NewHandlers(flights.NewService(pool))
	groundSchoolHandlers := groundschool.NewHandlers(groundschool.NewService(pool))
	extraHoursHandlers := extrahours.NewHandlers(extrahours.NewService(pool))
	fuelHandlers := fuel.NewHandlers(fuel.NewService(pool))
	flightSafetyHandlers := flightsafety.NewHandlers(flightsafety.NewService(pool))

	api := e.Group("/api/v1")
	api.GET("/health", healthHandler(pool))
	httpx.RegisterFrontendLogs(api, logger)
	authHandlers.Register(api)
	dashboardHandlers.Register(api, authSvc)
	lookupsHandlers.Register(api, authSvc)
	eventsHandlers.Register(api, authSvc)
	festivosHandlers.Register(api, authSvc)
	papeletasHandlers.Register(api, authSvc)
	personsHandlers.Register(api, authSvc)
	availabilityHandlers.Register(api, authSvc)
	trainingHandlers.Register(api, authSvc)
	comisionesHandlers.Register(api, authSvc)
	ratingsHandlers.Register(api, authSvc)
	hoursHandlers.Register(api, authSvc)
	landingsHandlers.Register(api, authSvc)
	projectilesHandlers.Register(api, authSvc)
	esfuerzoHandlers.Register(api, authSvc)
	flightsHandlers.Register(api, authSvc)
	groundSchoolHandlers.Register(api, authSvc)
	extraHoursHandlers.Register(api, authSvc)
	fuelHandlers.Register(api, authSvc)
	flightSafetyHandlers.Register(api, authSvc)

	e.GET("/*", spaHandler(distFS))

	// Timeouts del servidor: cortan conexiones colgadas (slowloris, clientes
	// que no leen). Write generoso para los listados pesados de vuelos.
	e.Server.ReadHeaderTimeout = 5 * time.Second
	e.Server.ReadTimeout = 30 * time.Second
	e.Server.WriteTimeout = 60 * time.Second
	e.Server.IdleTimeout = 120 * time.Second

	go purgeSessionsLoop(ctx, logger, authSvc)

	errCh := make(chan error, 1)
	go func() {
		logger.Info("aether-web starting",
			slog.String("addr", cfg.Addr),
			slog.Duration("session_ttl", cfg.SessionTTL),
		)
		if err := e.Start(cfg.Addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		logger.Info("señal recibida, apagando ordenadamente")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := e.Shutdown(shutdownCtx); err != nil {
			return err
		}
		logger.Info("apagado completado")
		return nil
	}
}

// requestLogger emite una línea JSON por request a /api/* con el request ID,
// para correlar con los errores que loguea el HTTPErrorHandler.
func requestLogger(logger *slog.Logger) echo.MiddlewareFunc {
	return middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		Skipper: func(c echo.Context) bool {
			// Los assets de la SPA y el health-check de polling solo meten ruido.
			path := c.Request().URL.Path
			return !strings.HasPrefix(path, "/api/") || path == "/api/v1/health"
		},
		LogStatus:    true,
		LogMethod:    true,
		LogURI:       true,
		LogLatency:   true,
		LogRemoteIP:  true,
		LogRequestID: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			level := slog.LevelInfo
			switch {
			case v.Status >= 500:
				level = slog.LevelError
			case v.Status >= 400:
				level = slog.LevelWarn
			}
			attrs := []slog.Attr{
				slog.String("request_id", v.RequestID),
				slog.String("method", v.Method),
				slog.String("uri", v.URI),
				slog.Int("status", v.Status),
				slog.Duration("latency", v.Latency),
				slog.String("remote_ip", v.RemoteIP),
			}
			if u := auth.CurrentUser(c); u != nil {
				attrs = append(attrs, slog.String("user", u.Username))
			}
			logger.LogAttrs(c.Request().Context(), level, "http request", attrs...)
			return nil
		},
	})
}

// purgeSessionsLoop borra sesiones caducadas cada sessionPurgeInterval para
// que detall.session no crezca sin límite.
func purgeSessionsLoop(ctx context.Context, logger *slog.Logger, svc *auth.Service) {
	ticker := time.NewTicker(sessionPurgeInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := svc.PurgeExpired(ctx)
			if err != nil {
				logger.Error("purga de sesiones falló", slog.Any("err", err))
				continue
			}
			if n > 0 {
				logger.Info("sesiones caducadas purgadas", slog.Int64("count", n))
			}
		}
	}
}

func healthHandler(pool *pgxpool.Pool) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx, cancel := context.WithTimeout(c.Request().Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{"status": "db_down"})
		}
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	}
}

func spaHandler(distFS fs.FS) echo.HandlerFunc {
	fileServer := http.FileServer(http.FS(distFS))
	return func(c echo.Context) error {
		reqPath := c.Request().URL.Path
		if reqPath != "/" {
			if f, err := distFS.Open(reqPath[1:]); err == nil {
				_ = f.Close()
				fileServer.ServeHTTP(c.Response(), c.Request())
				return nil
			}
		}
		index, err := distFS.Open("index.html")
		if err != nil {
			return echo.NewHTTPError(http.StatusNotFound, "index.html not embedded")
		}
		defer index.Close()
		c.Response().Header().Set(echo.HeaderContentType, "text/html; charset=utf-8")
		_, err = io.Copy(c.Response().Writer, index)
		return err
	}
}
