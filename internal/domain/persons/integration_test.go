package persons_test

import (
	"context"
	"errors"
	"strconv"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/domain/persons"
	"github.com/14esc/aether-web/internal/testdb"
)

func writeReq(user string) persons.WriteReq {
	return persons.WriteReq{
		PersonUser:         user,
		PersonRank:         "TN",
		PersonCuerpo:       "CGA",
		PersonEspecialidad: "Test",
		PersonName:         "Nombre",
		PersonLastName1:    "Apellido1",
		PersonLastName2:    "Apellido2",
		PersonPhone:        "600000000",
		PersonLocalidad:    "Test",
		PersonDivision:     "Test",
		PersonRol:          "Piloto",
		PersonAEmp:         "2020-01-01",
		PersonFEmb:         "2020-01-01",
		PersonBirthdate:    "1990-01-01",
		PersonNumEscalafon: 7,
	}
}

// auditRow es la última fila de detall.audit_log para una persona y operación.
type auditRow struct {
	UserID     string
	IP         string
	HasHashKey bool // new_data contiene la clave person_password_hash (NUNCA debe)
	HashFlag   bool // new_data->person_password_hash_present
}

func lastAudit(t *testing.T, ctx context.Context, pool *pgxpool.Pool, personSk int32, op string) auditRow {
	t.Helper()
	const q = `
		SELECT COALESCE(user_id, ''), COALESCE(ip_address, ''),
		       new_data ? 'person_password_hash',
		       COALESCE((new_data->>'person_password_hash_present')::bool, false)
		FROM detall.audit_log
		WHERE table_name = 'person' AND operation = $1 AND record_id = $2
		ORDER BY audit_id DESC LIMIT 1`
	var r auditRow
	if err := pool.QueryRow(ctx, q, op, strconv.Itoa(int(personSk))).Scan(&r.UserID, &r.IP, &r.HasHashKey, &r.HashFlag); err != nil {
		t.Fatalf("audit_log (%s): %v", op, err)
	}
	return r
}

func TestPersonsAuditIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	svc := persons.NewService(pool)
	esc := testdb.EscuadrillaID

	// Alta: transacción con GUCs → el trigger registra quién y desde dónde.
	id, err := svc.Create(ctx, esc, "admin1", "10.0.0.9", writeReq("nuevo1"))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	ins := lastAudit(t, ctx, pool, id, "INSERT")
	if ins.UserID != "admin1" || ins.IP != "10.0.0.9" {
		t.Errorf("audit INSERT user/ip: %+v, want admin1/10.0.0.9", ins)
	}
	// El hash de la contraseña por defecto NUNCA aparece en el log, solo el flag.
	if ins.HasHashKey {
		t.Error("audit INSERT: new_data contiene person_password_hash (debe estar enmascarado)")
	}
	if !ins.HashFlag {
		t.Error("audit INSERT: person_password_hash_present debería ser true (alta con password por defecto)")
	}

	// Duplicado (person_user UNIQUE).
	if _, err := svc.Create(ctx, esc, "admin1", "10.0.0.9", writeReq("nuevo1")); !errors.Is(err, persons.ErrDuplicate) {
		t.Errorf("create duplicado: got %v, want ErrDuplicate", err)
	}

	// Edición auditada.
	upd := writeReq("nuevo1")
	upd.PersonPhone = "611111111"
	if err := svc.Update(ctx, esc, id, "admin2", "10.0.0.10", upd); err != nil {
		t.Fatalf("update: %v", err)
	}
	u := lastAudit(t, ctx, pool, id, "UPDATE")
	if u.UserID != "admin2" || u.IP != "10.0.0.10" || u.HasHashKey {
		t.Errorf("audit UPDATE: %+v", u)
	}

	// Update desde otra escuadrilla: RLS, no existe para esa sesión.
	if err := svc.Update(ctx, esc+1, id, "x", "127.0.0.1", upd); !errors.Is(err, persons.ErrNotFound) {
		t.Errorf("update cross-escuadrilla: got %v, want ErrNotFound", err)
	}

	// Reset de contraseña: también pasa por withAudit y enmascara el hash.
	if err := svc.ResetPasswordToDefault(ctx, esc, id, "admin1", "10.0.0.9"); err != nil {
		t.Fatalf("reset password: %v", err)
	}
	r := lastAudit(t, ctx, pool, id, "UPDATE")
	if r.HasHashKey || !r.HashFlag {
		t.Errorf("audit reset password: hash filtrado o flag incorrecto: %+v", r)
	}
}

func TestLastSuperuserSafeguardIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	svc := persons.NewService(pool)
	esc := testdb.EscuadrillaID

	su := testdb.CreatePerson(t, ctx, pool, "super1", auth.PermSuperusuario)
	comun := testdb.CreatePerson(t, ctx, pool, "comun1", auth.PermComun)

	// Nivel inválido.
	if err := svc.SetPermissionLevel(ctx, esc, comun, "su", "::1", "Dios"); !errors.Is(err, persons.ErrInvalidLevel) {
		t.Errorf("nivel inválido: got %v, want ErrInvalidLevel", err)
	}

	// Degradar al único Superusuario: bloqueado (anti-lockout).
	if err := svc.SetPermissionLevel(ctx, esc, su, "su", "::1", auth.PermComun); !errors.Is(err, persons.ErrLastSuperuser) {
		t.Errorf("degradar último superusuario: got %v, want ErrLastSuperuser", err)
	}

	// Con un segundo Superusuario ya se puede degradar al primero…
	if err := svc.SetPermissionLevel(ctx, esc, comun, "su", "::1", auth.PermSuperusuario); err != nil {
		t.Fatalf("promocionar segundo superusuario: %v", err)
	}
	if err := svc.SetPermissionLevel(ctx, esc, su, "su", "::1", auth.PermOperacional); err != nil {
		t.Fatalf("degradar con relevo: %v", err)
	}
	// …pero el relevo vuelve a ser el último: bloqueado otra vez.
	if err := svc.SetPermissionLevel(ctx, esc, comun, "su", "::1", auth.PermComun); !errors.Is(err, persons.ErrLastSuperuser) {
		t.Errorf("degradar al nuevo último superusuario: got %v, want ErrLastSuperuser", err)
	}

	// El Superusuario de OTRA escuadrilla no cuenta como relevo (RLS del conteo).
	esc2 := testdb.CreateEscuadrilla(t, ctx, pool, "OTRA")
	testdb.CreatePersonInEscuadrilla(t, ctx, pool, "super2", auth.PermSuperusuario, esc2)
	if err := svc.SetPermissionLevel(ctx, esc, comun, "su", "::1", auth.PermComun); !errors.Is(err, persons.ErrLastSuperuser) {
		t.Errorf("superusuario de otra escuadrilla no debe contar: got %v, want ErrLastSuperuser", err)
	}
}
