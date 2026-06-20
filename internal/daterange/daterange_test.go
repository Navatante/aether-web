package daterange

import (
	"testing"
	"time"
)

// miércoles 2026-06-10, elegido para que semana/mes tengan bordes no triviales.
var today = time.Date(2026, 6, 10, 15, 30, 0, 0, time.UTC)

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func TestPredefined(t *testing.T) {
	cases := []struct {
		key  string
		from time.Time
		to   time.Time
	}{
		{"", date(2026, 6, 4), date(2026, 6, 10)}, // default = últimos 7 días
		{"ultimos-7-dias", date(2026, 6, 4), date(2026, 6, 10)},
		{"ultimos-30-dias", date(2026, 5, 12), date(2026, 6, 10)},
		{"ultimos-90-dias", date(2026, 3, 13), date(2026, 6, 10)},   // hoy - 89 días
		{"ultimos-182-dias", date(2025, 12, 11), date(2026, 6, 10)}, // hoy - 181 días
		{"ultimos-365-dias", date(2025, 6, 11), date(2026, 6, 10)},  // hoy - 364 días
		{"semana-actual", date(2026, 6, 8), date(2026, 6, 10)},      // lunes 8 → hoy
		{"ultima-semana", date(2026, 6, 1), date(2026, 6, 7)},       // lunes a domingo previos
		{"mes-actual", date(2026, 6, 1), date(2026, 6, 10)},
		{"ultimo-mes", date(2026, 5, 1), date(2026, 5, 31)},
		{"ultimos-3-meses", date(2026, 3, 1), date(2026, 5, 31)},
		{"anio-actual", date(2026, 1, 1), date(2026, 6, 10)},
		{"ultimo-anio", date(2025, 1, 1), date(2025, 12, 31)},
		{"ultimos-2-anios", date(2024, 1, 1), date(2025, 12, 31)},
		// historico ancla en el historicStart inyectado, no en una constante.
		{"historico", date(2019, 3, 15), date(2026, 6, 10)},
	}
	for _, tc := range cases {
		got, err := Predefined(tc.key, today, date(2019, 3, 15))
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

func TestPredefinedSundayWeek(t *testing.T) {
	// Domingo 2026-06-14: la semana actual empezó el lunes 8.
	sunday := time.Date(2026, 6, 14, 9, 0, 0, 0, time.UTC)
	got, err := Predefined("semana-actual", sunday, DefaultHistoricStart)
	if err != nil {
		t.Fatal(err)
	}
	if !got.From.Equal(date(2026, 6, 8)) {
		t.Errorf("semana-actual en domingo: from = %s, want 2026-06-08", got.From.Format("2006-01-02"))
	}
}

func TestPredefinedUnknown(t *testing.T) {
	if _, err := Predefined("trimestre-fiscal", today, DefaultHistoricStart); err == nil {
		t.Error("clave predefinida desconocida debería fallar")
	}
}

func TestPredefinedZeroTodayUsesNow(t *testing.T) {
	// today zero → se usa la fecha actual; el rango debe terminar hoy (UTC).
	got, err := Predefined("ultimos-7-dias", time.Time{}, DefaultHistoricStart)
	if err != nil {
		t.Fatal(err)
	}
	wantTo := time.Now().UTC()
	if got.To.Year() != wantTo.Year() || got.To.YearDay() != wantTo.YearDay() {
		t.Errorf("To = %s, want hoy %s", got.To.Format("2006-01-02"), wantTo.Format("2006-01-02"))
	}
}

func TestCustom(t *testing.T) {
	got, err := Custom("2026-01-15", "2026-02-20")
	if err != nil {
		t.Fatalf("Custom: %v", err)
	}
	if !got.From.Equal(date(2026, 1, 15)) || !got.To.Equal(date(2026, 2, 20)) {
		t.Errorf("got [%v, %v]", got.From, got.To)
	}
}

func TestCustomValidation(t *testing.T) {
	cases := [][2]string{
		{"2026-02-20", "2026-01-15"}, // invertidas
		{"15/01/2026", "2026-02-20"}, // formato inicio
		{"2026-01-15", "20/02/2026"}, // formato fin
	}
	for _, c := range cases {
		if _, err := Custom(c[0], c[1]); err == nil {
			t.Errorf("Custom(%q, %q) debería fallar", c[0], c[1])
		}
	}
}
