package dashboard

import (
	"testing"
	"time"
)

// miércoles 2026-06-10, elegido para que semana/mes tengan bordes no triviales.
var today = time.Date(2026, 6, 10, 15, 30, 0, 0, time.UTC)

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func TestResolveRangeCustom(t *testing.T) {
	got, err := ResolveRange(Request{
		RangeType: "custom",
		DateFrom:  "2026-01-15",
		DateTo:    "2026-02-20",
	}, today)
	if err != nil {
		t.Fatalf("ResolveRange: %v", err)
	}
	if !got.From.Equal(date(2026, 1, 15)) || !got.To.Equal(date(2026, 2, 20)) {
		t.Errorf("got [%v, %v]", got.From, got.To)
	}
}

func TestResolveRangeCustomValidation(t *testing.T) {
	cases := []Request{
		{RangeType: "custom"}, // faltan fechas
		{RangeType: "custom", DateFrom: "2026-02-20", DateTo: "2026-01-15"},     // invertidas
		{RangeType: "custom", DateFrom: "15/01/2026", DateTo: "2026-02-20"},     // formato
		{RangeType: "lo-que-sea", DateFrom: "2026-01-15", DateTo: "2026-02-20"}, // tipo desconocido
	}
	for _, req := range cases {
		if _, err := ResolveRange(req, today); err == nil {
			t.Errorf("ResolveRange(%+v) debería fallar", req)
		}
	}
}

func TestResolveRangePredefined(t *testing.T) {
	cases := []struct {
		key  string
		from time.Time
		to   time.Time
	}{
		{"", date(2026, 6, 4), date(2026, 6, 10)}, // default = últimos 7 días
		{"ultimos-7-dias", date(2026, 6, 4), date(2026, 6, 10)},
		{"ultimos-30-dias", date(2026, 5, 12), date(2026, 6, 10)},
		{"semana-actual", date(2026, 6, 8), date(2026, 6, 10)}, // lunes 8 → hoy
		{"ultima-semana", date(2026, 6, 1), date(2026, 6, 7)},  // lunes a domingo previos
		{"mes-actual", date(2026, 6, 1), date(2026, 6, 10)},
		{"ultimo-mes", date(2026, 5, 1), date(2026, 5, 31)},
		{"ultimos-3-meses", date(2026, 3, 1), date(2026, 5, 31)},
		{"anio-actual", date(2026, 1, 1), date(2026, 6, 10)},
		{"ultimo-anio", date(2025, 1, 1), date(2025, 12, 31)},
		{"ultimos-2-anios", date(2024, 1, 1), date(2025, 12, 31)},
		{"historico", date(2020, 1, 1), date(2026, 6, 10)},
	}
	for _, tc := range cases {
		got, err := ResolveRange(Request{RangeType: "predefined", PredefinedRange: tc.key}, today)
		if err != nil {
			t.Errorf("%q: %v", tc.key, err)
			continue
		}
		if !got.From.Equal(tc.from) || !got.To.Equal(tc.to) {
			t.Errorf("%q: got [%s, %s], want [%s, %s]", tc.key,
				got.From.Format("2006-01-02"), got.To.Format("2006-01-02"),
				tc.from.Format("2006-01-02"), tc.to.Format("2006-01-02"))
		}
	}
}

func TestResolveRangeSundayWeek(t *testing.T) {
	// Domingo 2026-06-14: la semana actual empezó el lunes 8.
	sunday := time.Date(2026, 6, 14, 9, 0, 0, 0, time.UTC)
	got, err := ResolveRange(Request{PredefinedRange: "semana-actual"}, sunday)
	if err != nil {
		t.Fatal(err)
	}
	if !got.From.Equal(date(2026, 6, 8)) {
		t.Errorf("semana-actual en domingo: from = %s, want 2026-06-08", got.From.Format("2006-01-02"))
	}
}

func TestResolveRangeUnknownPredefined(t *testing.T) {
	if _, err := ResolveRange(Request{PredefinedRange: "trimestre-fiscal"}, today); err == nil {
		t.Error("predefined desconocido debería fallar")
	}
}
