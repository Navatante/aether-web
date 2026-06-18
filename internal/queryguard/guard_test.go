// Package queryguard contiene un test de guardia (sin BD) que vigila el
// aislamiento por escuadrilla a nivel de queries.
//
// El aislamiento entre escuadrillas vive hoy en el WHERE *_escuadrilla_fk = $N
// de cada query (no usamos RLS de Postgres). El riesgo de ese enfoque es que un
// día se escriba una query nueva sobre datos de escuadrilla y se olvide el
// filtro: la fuga sería silenciosa. Este test convierte ese "filtro olvidado"
// en un fallo de CI.
//
// Regla: toda sentencia sqlc de queries/*.sql que toque datos por escuadrilla
// DEBE mencionar `escuadrilla_fk` en su cuerpo (el filtro), salvo que esté
// listada explícitamente en exemptBaseline con su categoría. Una query nueva
// que no filtre y no esté exenta hace fallar el test, obligando a una decisión
// consciente: añadir el filtro, o exentarla con justificación.
package queryguard

import (
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"testing"
)

// exemptBaseline son las queries que legítimamente NO filtran por
// *_escuadrilla_fk. Es la foto de las queries existentes al crear el test; NO
// se auditó una por una que cada acceso sea seguro, solo que su falta de filtro
// es estructuralmente razonable según su categoría. El valor es la categoría,
// para poder revisar por bloques en el futuro:
//
//   - auth         → sesiones/credenciales: no son datos por escuadrilla (no se
//     conoce la escuadrilla hasta tras el login).
//   - catalog      → catálogos/lookups de referencia compartidos (roles,
//     empleos, tipos…); no llevan columna de escuadrilla.
//   - festivos     → tabla global (festivos nacionales), sin escuadrilla_fk.
//   - events       → tabla de eventos global, sin escuadrilla_fk.
//   - placecatalog → lugares/aeródromos y tipos de comisión: catálogos
//     compartidos, sin escuadrilla_fk.
//   - flightchild  → filas hijas de un vuelo, cableadas por flight_sk que la
//     query padre (p. ej. GetFlightByID) ya filtró por escuadrilla.
//   - comisionchild→ filas hijas de una comisión, cableadas por comision_sk ya
//     acotado por la query padre.
//   - personkeyed  → operan sobre un person_sk concreto. CATEGORÍA A VIGILAR:
//     si el person_sk pudiera venir de otra escuadrilla habría que añadir un
//     chequeo de escuadrilla. Hoy se acepta como baseline.
//   - escuadrillaself → leen la propia fila de detall.escuadrilla por su PK
//     (escuadrilla_sk = la escuadrilla de la sesión); el acceso ya está acotado
//     a la escuadrilla activa, solo que por PK y no por una columna *_escuadrilla_fk.
//
// Para exentar una query nueva: añádela aquí con su categoría y, si no encaja
// en ninguna, documenta el motivo. Para dejar de exentarla: añade el filtro
// escuadrilla_fk a la query y bórrala de este mapa.
var exemptBaseline = map[string]string{
	"AddDepartureArrivalPlace":       "placecatalog",
	"ChangeOwnPasswordBySk":          "auth",
	"CountEvents":                    "events",
	"CreateSession":                  "auth",
	"DeleteComisionLugar":            "placecatalog",
	"DeleteDepartureArrivalPlace":    "placecatalog",
	"DeleteEvent":                    "events",
	"DeleteFestivo":                  "festivos",
	"DeletePersonFromComision":       "comisionchild",
	"DeleteSessionByTokenHash":       "auth",
	"EscuadrillaCreationDate":        "escuadrillaself",
	"FestivoExistsOnDate":            "festivos",
	"FestivoExistsOnDateOtherSk":     "festivos",
	"FlightApproaches":               "flightchild",
	"FlightCapbas":                   "flightchild",
	"FlightCrew":                     "flightchild",
	"FlightCupos":                    "flightchild",
	"FlightFormationHours":           "flightchild",
	"FlightGvntypeHours":             "flightchild",
	"FlightIftHours":                 "flightchild",
	"FlightInstructorHours":          "flightchild",
	"FlightLandings":                 "flightchild",
	"FlightPapeletas":                "flightchild",
	"FlightPassengers":               "flightchild",
	"FlightPersonHours":              "flightchild",
	"FlightProjectiles":              "flightchild",
	"FlightWtHours":                  "flightchild",
	"GetEventsAll":                   "events",
	"GetPersonPasswordHashBySk":      "auth",
	"InsertApproach":                 "flightchild",
	"InsertCapbaHour":                "flightchild",
	"InsertComisionLugar":            "placecatalog",
	"InsertCupoHour":                 "flightchild",
	"InsertEvent":                    "events",
	"InsertFestivo":                  "festivos",
	"InsertFormationHour":            "flightchild",
	"InsertGvntypeHour":              "flightchild",
	"InsertIftHour":                  "flightchild",
	"InsertInstructorHour":           "flightchild",
	"InsertLanding":                  "flightchild",
	"InsertPapeletaCrewCount":        "flightchild",
	"InsertPassenger":                "flightchild",
	"InsertPersonHour":               "flightchild",
	"InsertPersonToComision":         "comisionchild",
	"InsertProjectile":               "flightchild",
	"InsertWtHour":                   "flightchild",
	"ListComisionPeople":             "comisionchild",
	"ListComisionPeopleExpanded":     "comisionchild",
	"ListFestivos":                   "festivos",
	"LookupAuthorities":              "catalog",
	"LookupCapbaCatalog":             "catalog",
	"LookupComisionLugares":          "catalog",
	"LookupComisionTypes":            "catalog",
	"LookupDepartureArrivalPlaces":   "catalog",
	"LookupEventNames":               "catalog",
	"LookupEvents":                   "catalog",
	"LookupEventsManage":             "catalog",
	"LookupPapeletaBloques":          "catalog",
	"LookupPapeletaPlanes":           "catalog",
	"LookupPassengerTypes":           "catalog",
	"LookupPersonDivisiones":         "catalog",
	"LookupPersonEmpleos":            "catalog",
	"LookupPersonEspecialidades":     "catalog",
	"LookupPersonRoles":              "catalog",
	"LugarExistsByName":              "placecatalog",
	"LugarExistsByNameOther":         "placecatalog",
	"LugarUsageCount":                "placecatalog",
	"NotCrewRatingsCatalog":          "catalog",
	"PersonAlreadyInComision":        "comisionchild",
	"PersonFullName":                 "personkeyed",
	"PersonHasOverlapAbsence":        "personkeyed",
	"PersonHasOverlapComision":       "personkeyed",
	"PurgeExpiredSessions":           "auth",
	"RatingsCatalog":                 "catalog",
	"ResolveAbsenceReason":           "personkeyed",
	"ResolveComisionLugar":           "placecatalog",
	"ResolveComisionType":            "placecatalog",
	"SetPersonPassword":              "auth",
	"SetPersonPermissionLevelByUser": "auth",
	"UpdateComisionLugar":            "placecatalog",
	"UpdateEvent":                    "events",
	"UpdateFestivo":                  "festivos",
	"UpsertEventName":                "events",
}

type sqlStatement struct {
	name   string
	file   string
	scoped bool // el cuerpo (sin comentarios) menciona escuadrilla_fk
}

var nameHeaderRe = regexp.MustCompile(`^--\s*name:\s*(\S+)`)

// queriesDir localiza queries/ relativo a este fichero de test.
func queriesDir(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("no se pudo resolver la ruta del test")
	}
	return filepath.Join(filepath.Dir(thisFile), "..", "..", "queries")
}

// stripLineComment quita el comentario `-- ...` del final de una línea para que
// un escuadrilla_fk que aparezca solo en un comentario no cuente como filtro.
func stripLineComment(line string) string {
	if i := strings.Index(line, "--"); i >= 0 {
		return line[:i]
	}
	return line
}

// parseStatements parsea todas las sentencias sqlc de queries/*.sql.
func parseStatements(t *testing.T) []sqlStatement {
	t.Helper()
	files, err := filepath.Glob(filepath.Join(queriesDir(t), "*.sql"))
	if err != nil {
		t.Fatalf("glob queries: %v", err)
	}
	if len(files) == 0 {
		t.Fatal("no se encontraron ficheros queries/*.sql")
	}

	var stmts []sqlStatement
	for _, f := range files {
		raw, err := os.ReadFile(f)
		if err != nil {
			t.Fatalf("leer %s: %v", f, err)
		}
		base := filepath.Base(f)

		var cur *sqlStatement
		flush := func() {
			if cur != nil {
				stmts = append(stmts, *cur)
			}
		}
		for _, line := range strings.Split(string(raw), "\n") {
			if m := nameHeaderRe.FindStringSubmatch(line); m != nil {
				flush()
				cur = &sqlStatement{name: m[1], file: base}
				continue
			}
			if cur == nil {
				continue
			}
			if strings.Contains(stripLineComment(line), "escuadrilla_fk") {
				cur.scoped = true
			}
		}
		flush()
	}
	return stmts
}

func TestQueriesScopedByEscuadrilla(t *testing.T) {
	stmts := parseStatements(t)

	seenUnscoped := map[string]bool{}
	var offenders []string

	for _, s := range stmts {
		if s.scoped {
			continue
		}
		seenUnscoped[s.name] = true
		if _, exempt := exemptBaseline[s.name]; !exempt {
			offenders = append(offenders, s.name+" ("+s.file+")")
		}
	}

	if len(offenders) > 0 {
		sort.Strings(offenders)
		t.Errorf("queries sin filtro escuadrilla_fk y sin exención:\n  %s\n\n"+
			"Cada una accede a datos sin acotar por escuadrilla. Para cada query:\n"+
			"  1) si maneja datos por escuadrilla → añade  AND <tabla>_escuadrilla_fk = $N  al WHERE; o\n"+
			"  2) si es global/lookup/hija ya acotada → añádela a exemptBaseline en %s con su categoría.",
			strings.Join(offenders, "\n  "), "internal/queryguard/guard_test.go")
	}

	// Mantén el baseline limpio: una exención que ya no corresponde a una query
	// sin filtrar (renombrada, borrada, o que ahora SÍ filtra) debe quitarse.
	var stale []string
	for name := range exemptBaseline {
		if !seenUnscoped[name] {
			stale = append(stale, name)
		}
	}
	if len(stale) > 0 {
		sort.Strings(stale)
		t.Errorf("exenciones obsoletas en exemptBaseline (ya no son queries sin filtrar; bórralas):\n  %s",
			strings.Join(stale, "\n  "))
	}
}
