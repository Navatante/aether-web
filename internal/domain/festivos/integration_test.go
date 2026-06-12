package festivos_test

import (
	"context"
	"errors"
	"testing"

	"github.com/14esc/aether-web/internal/domain/festivos"
	"github.com/14esc/aether-web/internal/testdb"
)

func TestFestivosCRUDIntegration(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	svc := festivos.NewService(pool)

	// Lista vacía al empezar.
	items, err := svc.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("list inicial: %d items, want 0", len(items))
	}

	// Validación: motivo vacío.
	if _, err := svc.Create(ctx, festivos.WriteReq{FestivoDia: "2026-12-25", FestivoMotivo: "  "}); !errors.Is(err, festivos.ErrInvalidInput) {
		t.Errorf("create con motivo vacío: got %v, want ErrInvalidInput", err)
	}

	// Alta.
	id, err := svc.Create(ctx, festivos.WriteReq{FestivoDia: "2026-12-25", FestivoMotivo: "Navidad"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// Duplicado (uq_festivo: dia+motivo).
	if _, err := svc.Create(ctx, festivos.WriteReq{FestivoDia: "2026-12-25", FestivoMotivo: "Navidad"}); !errors.Is(err, festivos.ErrDateInUse) {
		t.Errorf("create duplicado: got %v, want ErrDateInUse", err)
	}

	// Update.
	if err := svc.Update(ctx, id, festivos.WriteReq{FestivoDia: "2026-12-24", FestivoMotivo: "Nochebuena"}); err != nil {
		t.Fatalf("update: %v", err)
	}
	items, err = svc.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].FestivoDia != "2026-12-24" || items[0].FestivoMotivo != "Nochebuena" {
		t.Errorf("list tras update: %+v", items)
	}

	// Update de un ID inexistente.
	if err := svc.Update(ctx, 9999, festivos.WriteReq{FestivoDia: "2026-01-01", FestivoMotivo: "X"}); !errors.Is(err, festivos.ErrNotFound) {
		t.Errorf("update inexistente: got %v, want ErrNotFound", err)
	}

	// Delete.
	if err := svc.Delete(ctx, id); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if err := svc.Delete(ctx, id); !errors.Is(err, festivos.ErrNotFound) {
		t.Errorf("delete repetido: got %v, want ErrNotFound", err)
	}
}
