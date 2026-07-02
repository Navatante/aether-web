package comisiones_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/domain/comisiones"
	"github.com/14esc/aether-web/internal/testdb"
)

// comisionTypeName es una categoría "no caduca" real (nonWindowedComisionTypes)
// para poder probar también DiasComisionBreakdown con datos de esta comisión.
const comisionTypeName = "Despliegues ordenados por COMFLOAN"

// seedComisionCatalog crea el tipo y el lugar que exigen las FKs de comision.
func seedComisionCatalog(t *testing.T, ctx context.Context, pool *pgxpool.Pool) (lugar string) {
	t.Helper()
	if _, err := pool.Exec(ctx,
		`INSERT INTO detall.comision_type (name, origin) VALUES ($1, 'Externa')`,
		comisionTypeName); err != nil {
		t.Fatalf("seed comision_type: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO detall.comision_lugar (comision_name) VALUES ('Rota')`); err != nil {
		t.Fatalf("seed comision_lugar: %v", err)
	}
	return "Rota"
}

func formData(start, end string) comisiones.ComisionFormData {
	return comisiones.ComisionFormData{
		StartDate:       start,
		EndDate:         end,
		Tipo:            comisionTypeName,
		Lugar:           "Rota",
		GeneratesEffort: true,
		HoraSalida:      "08:00",
		HoraLlegada:     "15:00",
	}
}

func TestComisionesCRUDIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	svc := comisiones.NewService(pool)
	esc := testdb.EscuadrillaID
	seedComisionCatalog(t, ctx, pool)

	// Tipo desconocido.
	bad := formData("2026-03-01", "2026-03-05")
	bad.Tipo = "No existe"
	if _, err := svc.Create(ctx, esc, bad); !errors.Is(err, comisiones.ErrUnknownType) {
		t.Errorf("create con tipo desconocido: got %v, want ErrUnknownType", err)
	}

	// Rango invertido.
	if _, err := svc.Create(ctx, esc, formData("2026-03-05", "2026-03-01")); !errors.Is(err, comisiones.ErrInvalidInput) {
		t.Errorf("create con rango invertido: got %v, want ErrInvalidInput", err)
	}

	// Alta.
	res, err := svc.Create(ctx, esc, formData("2026-03-01", "2026-03-05"))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// Update de la propia escuadrilla.
	if err := svc.Update(ctx, esc, res.ComisionID, formData("2026-03-01", "2026-03-06")); err != nil {
		t.Fatalf("update: %v", err)
	}
	// Update desde otra escuadrilla no la ve (RLS).
	if err := svc.Update(ctx, esc+1, res.ComisionID, formData("2026-03-01", "2026-03-06")); !errors.Is(err, comisiones.ErrNotFound) {
		t.Errorf("update cross-escuadrilla: got %v, want ErrNotFound", err)
	}

	// Delete cross-escuadrilla tampoco (RLS); el propio sí.
	if err := svc.Delete(ctx, esc+1, res.ComisionID); !errors.Is(err, comisiones.ErrNotFound) {
		t.Errorf("delete cross-escuadrilla: got %v, want ErrNotFound", err)
	}
	if err := svc.Delete(ctx, esc, res.ComisionID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if err := svc.Delete(ctx, esc, res.ComisionID); !errors.Is(err, comisiones.ErrNotFound) {
		t.Errorf("delete repetido: got %v, want ErrNotFound", err)
	}
}

func TestComisionesListBulkParticipantsIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	svc := comisiones.NewService(pool)
	esc := testdb.EscuadrillaID
	seedComisionCatalog(t, ctx, pool)

	pA := testdb.CreatePerson(t, ctx, pool, "personaA", auth.PermComun)
	pB := testdb.CreatePerson(t, ctx, pool, "personaB", auth.PermComun)

	c1, err := svc.Create(ctx, esc, formData("2026-03-01", "2026-03-05"))
	if err != nil {
		t.Fatal(err)
	}
	c2, err := svc.Create(ctx, esc, formData("2026-04-01", "2026-04-03"))
	if err != nil {
		t.Fatal(err)
	}

	// c1 con dos participantes, A con 2 días de ranchería; c2 sin nadie.
	if _, err := svc.AssignPeopleToComision(ctx, esc, c1.ComisionID, []int32{pA, pB}, map[int32]int32{pA: 2}); err != nil {
		t.Fatalf("assign: %v", err)
	}

	got, err := svc.List(ctx, esc, comisiones.QueryParams{})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if got.TotalCount != 2 || len(got.Items) != 2 {
		t.Fatalf("list: total=%d items=%d, want 2/2", got.TotalCount, len(got.Items))
	}
	byID := map[int32]int{}
	for i, it := range got.Items {
		byID[it.ComisionSk] = i
	}
	i1 := got.Items[byID[c1.ComisionID]]
	if len(i1.Participantes) != 2 {
		t.Fatalf("c1: %d participantes, want 2", len(i1.Participantes))
	}
	rancheria := map[int32]bool{}
	for _, p := range i1.Participantes {
		rancheria[p.RancheriaDias] = true
	}
	if !rancheria[2] || !rancheria[0] {
		t.Errorf("c1 rancheria_dias: %+v, want {2 y 0}", i1.Participantes)
	}
	i2 := got.Items[byID[c2.ComisionID]]
	if i2.Participantes == nil || len(i2.Participantes) != 0 {
		t.Errorf("c2 sin gente debe ser slice vacío no-nil (JSON []), got %#v", i2.Participantes)
	}

	// Misma agrupación en la variante with-people.
	wp, err := svc.ListWithPeople(ctx, esc, comisiones.QueryParams{})
	if err != nil {
		t.Fatalf("listWithPeople: %v", err)
	}
	for _, it := range wp.Items {
		switch it.ComisionSk {
		case c1.ComisionID:
			if len(it.People) != 2 {
				t.Errorf("with-people c1: %d, want 2", len(it.People))
			}
		case c2.ComisionID:
			if it.People == nil || len(it.People) != 0 {
				t.Errorf("with-people c2 debe ser [] no-nil, got %#v", it.People)
			}
		}
	}

	// Otra escuadrilla no ve nada.
	otras, err := svc.List(ctx, esc+1, comisiones.QueryParams{})
	if err != nil {
		t.Fatal(err)
	}
	if otras.TotalCount != 0 {
		t.Errorf("list cross-escuadrilla: total=%d, want 0", otras.TotalCount)
	}
}

func TestAssignPeopleValidationsIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	svc := comisiones.NewService(pool)
	esc := testdb.EscuadrillaID
	seedComisionCatalog(t, ctx, pool)

	pA := testdb.CreatePerson(t, ctx, pool, "personaA", auth.PermComun)
	esc2 := testdb.CreateEscuadrilla(t, ctx, pool, "OTRA")
	pOtra := testdb.CreatePersonInEscuadrilla(t, ctx, pool, "intruso", auth.PermComun, esc2)

	c1, err := svc.Create(ctx, esc, formData("2026-03-01", "2026-03-05"))
	if err != nil {
		t.Fatal(err)
	}

	// Persona de otra escuadrilla: rechazo del lote entero, sin detalle.
	if _, err := svc.AssignPeopleToComision(ctx, esc, c1.ComisionID, []int32{pA, pOtra}, nil); !errors.Is(err, comisiones.ErrInvalidInput) {
		t.Errorf("assign con persona de otra escuadrilla: got %v, want ErrInvalidInput", err)
	}

	// Ranchería fuera de rango (comisión de 5 días).
	var verr *comisiones.ValidationError
	if _, err := svc.AssignPeopleToComision(ctx, esc, c1.ComisionID, []int32{pA}, map[int32]int32{pA: 9}); !errors.As(err, &verr) {
		t.Errorf("rancheria fuera de rango: got %v, want ValidationError", err)
	}

	// Alta correcta y duplicado.
	if _, err := svc.AssignPeopleToComision(ctx, esc, c1.ComisionID, []int32{pA}, nil); err != nil {
		t.Fatalf("assign: %v", err)
	}
	if _, err := svc.AssignPeopleToComision(ctx, esc, c1.ComisionID, []int32{pA}, nil); !errors.As(err, &verr) {
		t.Errorf("assign duplicado: got %v, want ValidationError", err)
	}

	// Solape con otra comisión.
	c2, err := svc.Create(ctx, esc, formData("2026-03-04", "2026-03-08"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AssignPeopleToComision(ctx, esc, c2.ComisionID, []int32{pA}, nil); !errors.As(err, &verr) {
		t.Errorf("assign con solape: got %v, want ValidationError", err)
	}

	// La comisión debe ser de la escuadrilla de la sesión.
	if _, err := svc.AssignPeopleToComision(ctx, esc2, c1.ComisionID, []int32{pOtra}, nil); !errors.Is(err, comisiones.ErrNotFound) {
		t.Errorf("assign a comisión de otra escuadrilla: got %v, want ErrNotFound", err)
	}
}

func TestDiasComisionBreakdownRLSIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	svc := comisiones.NewService(pool)
	esc := testdb.EscuadrillaID
	seedComisionCatalog(t, ctx, pool)

	pA := testdb.CreatePerson(t, ctx, pool, "personaA", auth.PermComun)
	esc2 := testdb.CreateEscuadrilla(t, ctx, pool, "OTRA")

	c1, err := svc.Create(ctx, esc, formData("2026-03-01", "2026-03-05"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AssignPeopleToComision(ctx, esc, c1.ComisionID, []int32{pA}, map[int32]int32{pA: 2}); err != nil {
		t.Fatal(err)
	}

	// La propia escuadrilla ve el desglose (categoría "no caduca" y Ranchería).
	items, err := svc.DiasComisionBreakdown(ctx, esc, pA, comisionTypeName, "")
	if err != nil {
		t.Fatalf("breakdown: %v", err)
	}
	if len(items) != 1 || items[0].Dias != 5 {
		t.Fatalf("breakdown propio: %+v, want 1 item de 5 días", items)
	}
	ranch, err := svc.DiasComisionBreakdown(ctx, esc, pA, "Ranchería", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(ranch) != 1 || ranch[0].Dias != 2 {
		t.Fatalf("breakdown ranchería: %+v, want 1 item de 2 días", ranch)
	}

	// Una sesión de otra escuadrilla NO ve el desglose de pA (fuga RLS cerrada).
	leaked, err := svc.DiasComisionBreakdown(ctx, esc2, pA, comisionTypeName, "")
	if err != nil {
		t.Fatalf("breakdown cross-escuadrilla: %v", err)
	}
	if len(leaked) != 0 {
		t.Errorf("RLS: una sesión de otra escuadrilla ve %d comisiones de pA, want 0", len(leaked))
	}
	leakedRanch, err := svc.DiasComisionBreakdown(ctx, esc2, pA, "Ranchería", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(leakedRanch) != 0 {
		t.Errorf("RLS ranchería: got %d items, want 0", len(leakedRanch))
	}

	// Categoría desconocida.
	if _, err := svc.DiasComisionBreakdown(ctx, esc, pA, "Categoría inventada", ""); !errors.Is(err, comisiones.ErrInvalidInput) {
		t.Errorf("categoría desconocida: got %v, want ErrInvalidInput", err)
	}
}
