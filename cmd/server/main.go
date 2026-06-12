package main

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/db"
	"github.com/14esc/aether-web/internal/domain/availability"
	"github.com/14esc/aether-web/internal/domain/comisiones"
	"github.com/14esc/aether-web/internal/domain/dashboard"
	"github.com/14esc/aether-web/internal/domain/esfuerzo"
	"github.com/14esc/aether-web/internal/domain/events"
	"github.com/14esc/aether-web/internal/domain/festivos"
	"github.com/14esc/aether-web/internal/domain/flights"
	"github.com/14esc/aether-web/internal/domain/hours"
	"github.com/14esc/aether-web/internal/domain/lookups"
	"github.com/14esc/aether-web/internal/domain/papeletas"
	"github.com/14esc/aether-web/internal/domain/persons"
	"github.com/14esc/aether-web/internal/domain/ratings"
	"github.com/14esc/aether-web/internal/domain/training"
	"github.com/14esc/aether-web/web"
)

const defaultSessionTTL = 8 * time.Hour

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := db.New(ctx, db.ConfigFromEnv())
	if err != nil {
		logger.Error("failed to connect to database", slog.Any("err", err))
		os.Exit(1)
	}
	defer pool.Close()

	sessionTTL := readSessionTTL(logger)
	authSvc := auth.NewService(pool, sessionTTL)
	authHandlers := auth.NewHandlers(authSvc, sessionTTL)

	distFS, err := web.DistFS()
	if err != nil {
		logger.Error("failed to load embedded web/dist", slog.Any("err", err))
		os.Exit(1)
	}

	e := echo.New()
	e.HideBanner = true
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())

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
	esfuerzoHandlers := esfuerzo.NewHandlers(esfuerzo.NewService(pool))
	flightsHandlers := flights.NewHandlers(flights.NewService(pool))

	api := e.Group("/api/v1")
	api.GET("/health", healthHandler(pool))
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
	esfuerzoHandlers.Register(api, authSvc)
	flightsHandlers.Register(api, authSvc)

	e.GET("/*", spaHandler(distFS))

	addr := os.Getenv("AETHER_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	logger.Info("aether-web starting", slog.String("addr", addr), slog.Duration("session_ttl", sessionTTL))
	if err := e.Start(addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("server stopped", slog.Any("err", err))
		os.Exit(1)
	}
}

func readSessionTTL(logger *slog.Logger) time.Duration {
	raw := os.Getenv("AETHER_SESSION_TTL")
	if raw == "" {
		return defaultSessionTTL
	}
	if d, err := time.ParseDuration(raw); err == nil {
		return d
	}
	if secs, err := strconv.Atoi(raw); err == nil {
		return time.Duration(secs) * time.Second
	}
	logger.Warn("AETHER_SESSION_TTL no parseable, usando valor por defecto", slog.String("raw", raw))
	return defaultSessionTTL
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
