package dashboard

import (
	"errors"
	"fmt"
	"time"
)

// historicStart es la fecha mínima del sistema (igual que en SQL Server:
// "Standardized system inception date").
var historicStart = time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)

// DateRange resuelve un rango cerrado [From, To] (ambos inclusive) a partir
// de los parámetros de entrada. To se usa como < (To + 1 día) en las queries.
type DateRange struct {
	From time.Time
	To   time.Time
}

// ResolveRange traduce un Request a fechas concretas. today permite inyectar
// la fecha actual en tests; si es zero, se usa time.Now().UTC().
func ResolveRange(req Request, today time.Time) (DateRange, error) {
	if today.IsZero() {
		today = time.Now().UTC()
	}
	today = startOfDay(today)

	switch req.RangeType {
	case "custom":
		if req.DateFrom == "" || req.DateTo == "" {
			return DateRange{}, errors.New("date_from y date_to son obligatorios en range_type=custom")
		}
		from, err := time.Parse("2006-01-02", req.DateFrom)
		if err != nil {
			return DateRange{}, fmt.Errorf("date_from inválido: %w", err)
		}
		to, err := time.Parse("2006-01-02", req.DateTo)
		if err != nil {
			return DateRange{}, fmt.Errorf("date_to inválido: %w", err)
		}
		if from.After(to) {
			return DateRange{}, errors.New("date_from no puede ser posterior a date_to")
		}
		return DateRange{From: from, To: to}, nil

	case "", "predefined":
		return resolvePredefined(req.PredefinedRange, today)
	}
	return DateRange{}, fmt.Errorf("range_type desconocido: %q", req.RangeType)
}

func resolvePredefined(key string, today time.Time) (DateRange, error) {
	switch key {
	case "", "ultimos-7-dias":
		return DateRange{From: today.AddDate(0, 0, -6), To: today}, nil
	case "ultimos-30-dias":
		return DateRange{From: today.AddDate(0, 0, -29), To: today}, nil
	case "ultimos-90-dias":
		return DateRange{From: today.AddDate(0, 0, -89), To: today}, nil
	case "ultimos-182-dias":
		return DateRange{From: today.AddDate(0, 0, -181), To: today}, nil
	case "ultimos-365-dias":
		return DateRange{From: today.AddDate(0, 0, -364), To: today}, nil
	case "semana-actual":
		// Lunes (Weekday=1) → hoy. Si hoy es domingo (0), lunes fue hace 6 días.
		return DateRange{From: mondayOf(today), To: today}, nil
	case "ultima-semana":
		mon := mondayOf(today).AddDate(0, 0, -7)
		return DateRange{From: mon, To: mon.AddDate(0, 0, 6)}, nil
	case "mes-actual":
		return DateRange{From: firstOfMonth(today), To: today}, nil
	case "ultimo-mes":
		first := firstOfMonth(today).AddDate(0, -1, 0)
		last := firstOfMonth(today).AddDate(0, 0, -1)
		return DateRange{From: first, To: last}, nil
	case "ultimos-3-meses":
		first := firstOfMonth(today).AddDate(0, -3, 0)
		last := firstOfMonth(today).AddDate(0, 0, -1)
		return DateRange{From: first, To: last}, nil
	case "anio-actual":
		return DateRange{From: time.Date(today.Year(), 1, 1, 0, 0, 0, 0, today.Location()), To: today}, nil
	case "ultimo-anio":
		y := today.Year() - 1
		return DateRange{
			From: time.Date(y, 1, 1, 0, 0, 0, 0, today.Location()),
			To:   time.Date(y, 12, 31, 0, 0, 0, 0, today.Location()),
		}, nil
	case "ultimos-2-anios":
		from := time.Date(today.Year()-2, 1, 1, 0, 0, 0, 0, today.Location())
		to := time.Date(today.Year()-1, 12, 31, 0, 0, 0, 0, today.Location())
		return DateRange{From: from, To: to}, nil
	case "historico":
		return DateRange{From: historicStart, To: today}, nil
	}
	return DateRange{}, fmt.Errorf("predefined_range desconocido: %q", key)
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
