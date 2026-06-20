package dashboard

import (
	"errors"
	"fmt"
	"time"

	"github.com/14esc/aether-web/internal/daterange"
)

// defaultHistoricStart es el ancla de respaldo para el rango "histórico".
// Fuente única: daterange.DefaultHistoricStart.
var defaultHistoricStart = daterange.DefaultHistoricStart

// DateRange resuelve un rango cerrado [From, To] (ambos inclusive). To se usa
// como < (To + 1 día) en las queries.
type DateRange struct {
	From time.Time
	To   time.Time
}

// ResolveRange traduce un Request del dashboard a fechas concretas, delegando
// la aritmética de rangos en internal/daterange. today permite inyectar la
// fecha actual en tests; si es zero se usa la actual. historicStart ancla el
// rango "histórico" (fecha de creación de la escuadrilla de la sesión).
func ResolveRange(req Request, today, historicStart time.Time) (DateRange, error) {
	switch req.RangeType {
	case "custom":
		if req.DateFrom == "" || req.DateTo == "" {
			return DateRange{}, errors.New("date_from y date_to son obligatorios en range_type=custom")
		}
		r, err := daterange.Custom(req.DateFrom, req.DateTo)
		if err != nil {
			return DateRange{}, err
		}
		return DateRange(r), nil
	case "", "predefined":
		r, err := daterange.Predefined(req.PredefinedRange, today, historicStart)
		if err != nil {
			return DateRange{}, err
		}
		return DateRange(r), nil
	}
	return DateRange{}, fmt.Errorf("range_type desconocido: %q", req.RangeType)
}
