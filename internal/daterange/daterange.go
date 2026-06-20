// Package daterange centraliza la resolución de rangos de fechas (claves
// predefinidas como "ultimos-7-dias", "semana-actual", "historico"… y rangos
// custom from/to) que comparten los dominios dashboard, hours, landings y
// projectiles. Antes cada uno tenía su propia copia byte-a-byte del mismo
// switch; un cambio en una definición de rango obligaba a tocar cuatro sitios.
// Aquí vive la única fuente de verdad; cada dominio adapta su Request a estas
// funciones y mapea Range a su tipo de salida.
package daterange

import (
	"errors"
	"fmt"
	"time"
)

// DefaultHistoricStart es el ancla de respaldo para el rango "histórico" cuando
// no se puede leer escuadrilla_creation_date (no debería ocurrir).
var DefaultHistoricStart = time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)

// Range es un rango cerrado [From, To] (ambos inclusive). Las queries lo usan
// como < (To + 1 día).
type Range struct {
	From time.Time
	To   time.Time
}

// Predefined resuelve una clave de rango predefinida. today permite inyectar la
// fecha actual en tests; si es zero se usa time.Now().UTC() y se normaliza al
// inicio del día. Una clave vacía equivale a "ultimos-7-dias". historicStart
// ancla el rango "histórico".
func Predefined(key string, today, historicStart time.Time) (Range, error) {
	if today.IsZero() {
		today = time.Now().UTC()
	}
	today = startOfDay(today)

	switch key {
	case "", "ultimos-7-dias":
		return Range{From: today.AddDate(0, 0, -6), To: today}, nil
	case "ultimos-30-dias":
		return Range{From: today.AddDate(0, 0, -29), To: today}, nil
	case "ultimos-90-dias":
		return Range{From: today.AddDate(0, 0, -89), To: today}, nil
	case "ultimos-182-dias":
		return Range{From: today.AddDate(0, 0, -181), To: today}, nil
	case "ultimos-365-dias":
		return Range{From: today.AddDate(0, 0, -364), To: today}, nil
	case "semana-actual":
		// Lunes (Weekday=1) → hoy. Si hoy es domingo (0), lunes fue hace 6 días.
		return Range{From: mondayOf(today), To: today}, nil
	case "ultima-semana":
		mon := mondayOf(today).AddDate(0, 0, -7)
		return Range{From: mon, To: mon.AddDate(0, 0, 6)}, nil
	case "mes-actual":
		return Range{From: firstOfMonth(today), To: today}, nil
	case "ultimo-mes":
		first := firstOfMonth(today).AddDate(0, -1, 0)
		last := firstOfMonth(today).AddDate(0, 0, -1)
		return Range{From: first, To: last}, nil
	case "ultimos-3-meses":
		first := firstOfMonth(today).AddDate(0, -3, 0)
		last := firstOfMonth(today).AddDate(0, 0, -1)
		return Range{From: first, To: last}, nil
	case "anio-actual":
		return Range{From: time.Date(today.Year(), 1, 1, 0, 0, 0, 0, today.Location()), To: today}, nil
	case "ultimo-anio":
		y := today.Year() - 1
		return Range{
			From: time.Date(y, 1, 1, 0, 0, 0, 0, today.Location()),
			To:   time.Date(y, 12, 31, 0, 0, 0, 0, today.Location()),
		}, nil
	case "ultimos-2-anios":
		from := time.Date(today.Year()-2, 1, 1, 0, 0, 0, 0, today.Location())
		to := time.Date(today.Year()-1, 12, 31, 0, 0, 0, 0, today.Location())
		return Range{From: from, To: to}, nil
	case "historico":
		return Range{From: historicStart, To: today}, nil
	}
	return Range{}, fmt.Errorf("rango predefinido desconocido: %q", key)
}

// Custom parsea y valida un rango from/to en formato YYYY-MM-DD (ambos
// obligatorios, from <= to). El llamante decide cuándo está en modo custom y
// qué hacer si falta uno de los dos; aquí solo se parsea y valida el par.
func Custom(from, to string) (Range, error) {
	f, err := time.Parse("2006-01-02", from)
	if err != nil {
		return Range{}, fmt.Errorf("fecha de inicio inválida: %w", err)
	}
	t, err := time.Parse("2006-01-02", to)
	if err != nil {
		return Range{}, fmt.Errorf("fecha de fin inválida: %w", err)
	}
	if f.After(t) {
		return Range{}, errors.New("la fecha de inicio no puede ser posterior a la de fin")
	}
	return Range{From: f, To: t}, nil
}

func startOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func firstOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
}

// mondayOf devuelve el lunes de la semana que contiene t.
// En Go, time.Sunday=0, Monday=1, ..., Saturday=6.
func mondayOf(t time.Time) time.Time {
	wd := int(t.Weekday()) // 0=Domingo, 1=Lunes, …
	if wd == 0 {
		wd = 7 // tratamos el domingo como día 7 de la semana
	}
	return t.AddDate(0, 0, -(wd - 1))
}
