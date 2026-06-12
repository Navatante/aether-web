// Package testdb levanta una base de datos PostgreSQL efímera para tests de
// integración. Necesita AETHER_TEST_DATABASE_URL apuntando a un servidor
// PostgreSQL con permisos de CREATE DATABASE (en local, el contenedor
// aether-pg; en CI, el service container del workflow). Si la variable no
// está definida, los tests se saltan.
//
// Por cada llamada a New se crea una BD aether_test_<aleatorio>, se aplican
// las migraciones públicas (se omiten las privadas 0002/0005 de datos), se
// siembra un catálogo mínimo y se borra todo al terminar el test.
package testdb

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EscuadrillaID es el SK de la escuadrilla de pruebas que siembra New.
const EscuadrillaID int32 = 1

// New crea una BD efímera con esquema y catálogo mínimo y devuelve un pool.
// Registra el cleanup (cerrar pool + DROP DATABASE) en t.
func New(t *testing.T) *pgxpool.Pool {
	t.Helper()

	adminDSN := os.Getenv("AETHER_TEST_DATABASE_URL")
	if adminDSN == "" {
		t.Skip("AETHER_TEST_DATABASE_URL no definida; test de integración omitido")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		t.Fatalf("testdb: rand: %v", err)
	}
	dbName := "aether_test_" + hex.EncodeToString(buf)

	admin, err := pgx.Connect(ctx, adminDSN)
	if err != nil {
		t.Fatalf("testdb: conectar al servidor: %v", err)
	}
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+dbName); err != nil {
		_ = admin.Close(ctx)
		t.Fatalf("testdb: CREATE DATABASE: %v", err)
	}
	_ = admin.Close(ctx)

	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		admin, err := pgx.Connect(ctx, adminDSN)
		if err != nil {
			t.Logf("testdb: cleanup connect: %v", err)
			return
		}
		defer admin.Close(ctx)
		if _, err := admin.Exec(ctx, fmt.Sprintf("DROP DATABASE %s WITH (FORCE)", dbName)); err != nil {
			t.Logf("testdb: DROP DATABASE: %v", err)
		}
	})

	dsn, err := replaceDatabase(adminDSN, dbName)
	if err != nil {
		t.Fatalf("testdb: %v", err)
	}

	applyMigrations(t, ctx, dsn)
	seedBase(t, ctx, dsn)

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("testdb: abrir pool: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// replaceDatabase cambia el nombre de BD de un DSN en formato URL.
func replaceDatabase(dsn, dbName string) (string, error) {
	u, err := url.Parse(dsn)
	if err != nil || u.Scheme == "" {
		return "", fmt.Errorf("AETHER_TEST_DATABASE_URL debe ser una URL postgres:// (%v)", err)
	}
	u.Path = "/" + dbName
	return u.String(), nil
}

// applyMigrations ejecuta migrations/*.up.sql en orden, saltando las
// privadas (symlinks a aether-data, contienen "seed" en el nombre).
func applyMigrations(t *testing.T, ctx context.Context, dsn string) {
	t.Helper()

	// Protocolo simple: permite ejecutar archivos con múltiples sentencias
	// (incluidos cuerpos $$...$$ de triggers) en un solo Exec.
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	conn, err := pgx.Connect(ctx, dsn+sep+"default_query_exec_mode=simple_protocol")
	if err != nil {
		t.Fatalf("testdb: conectar a BD de test: %v", err)
	}
	defer conn.Close(ctx)

	dir := migrationsDir(t)
	files, err := filepath.Glob(filepath.Join(dir, "*.up.sql"))
	if err != nil {
		t.Fatalf("testdb: glob migraciones: %v", err)
	}
	sort.Strings(files)

	for _, f := range files {
		if strings.Contains(filepath.Base(f), "seed") {
			continue // datos privados (0002, 0005): no necesarios para el esquema
		}
		sql, err := os.ReadFile(f)
		if err != nil {
			t.Fatalf("testdb: leer %s: %v", f, err)
		}
		if _, err := conn.Exec(ctx, string(sql)); err != nil {
			t.Fatalf("testdb: aplicar %s: %v", filepath.Base(f), err)
		}
	}
}

// seedBase siembra el catálogo mínimo que exigen las FKs de detall.person
// y la escuadrilla de pruebas (EscuadrillaID).
func seedBase(t *testing.T, ctx context.Context, dsn string) {
	t.Helper()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("testdb: conectar para seed: %v", err)
	}
	defer conn.Close(ctx)

	const seed = `
		INSERT INTO detall.escuadrilla (escuadrilla_code, escuadrilla_name, escuadrilla_creation_date)
		VALUES ('TEST', 'Escuadrilla de pruebas', '2020-01-01');
		INSERT INTO detall.rank (rank_name, rank_order, rank_category) VALUES ('TN', 1, 'Oficiales');
		INSERT INTO detall.localidad (localidad_name) VALUES ('Test');
		INSERT INTO detall.especialidad (especialidad_name) VALUES ('Test');
		INSERT INTO detall.division (division_name) VALUES ('Test');
		INSERT INTO detall.person_rol (person_rol_name) VALUES ('Piloto');`
	for _, stmt := range strings.Split(seed, ";") {
		if strings.TrimSpace(stmt) == "" {
			continue
		}
		if _, err := conn.Exec(ctx, stmt); err != nil {
			t.Fatalf("testdb: seed: %v", err)
		}
	}
}

// CreatePerson inserta una persona de pruebas y devuelve su person_sk.
func CreatePerson(t *testing.T, ctx context.Context, pool *pgxpool.Pool, user, permissionLevel string) int32 {
	t.Helper()
	const q = `
		INSERT INTO detall.person (
			person_user, person_rank, person_cuerpo, person_especialidad,
			person_name, person_last_name_1, person_last_name_2, person_phone,
			person_localidad, person_division, person_rol,
			person_a_emp, person_f_emb, person_birthdate, person_num_escalafon,
			person_permission_level, person_escuadrilla_fk
		) VALUES (
			$1, 'TN', 'CGA', 'Test',
			'Nombre', 'Apellido1', 'Apellido2', '600000000',
			'Test', 'Test', 'Piloto',
			'2020-01-01', '2020-01-01', '1990-01-01', 1,
			$2, $3
		) RETURNING person_sk`
	var sk int32
	if err := pool.QueryRow(ctx, q, user, permissionLevel, EscuadrillaID).Scan(&sk); err != nil {
		t.Fatalf("testdb: crear persona: %v", err)
	}
	return sk
}

// migrationsDir localiza el directorio migrations/ desde la posición de este
// archivo (internal/testdb → raíz del repo).
func migrationsDir(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("testdb: runtime.Caller falló")
	}
	return filepath.Join(filepath.Dir(thisFile), "..", "..", "migrations")
}
