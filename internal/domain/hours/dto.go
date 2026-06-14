package hours

// Contrato JSON de las horas de vuelo por periodo (sp_get_personNH90PeriodHours).
// Fuente de verdad para web/src/types/generated/hours.ts (tygo). NO duplicar a mano.

// Tripulante espeja el shape del SP (snake_case con sufijos _qty).
type Tripulante struct {
	PersonNk          string  `json:"person_nk"`
	RealDayHourQty    float64 `json:"real_day_hour_qty"`
	SimDayHourQty     float64 `json:"sim_day_hour_qty"`
	TotalDayHourQty   float64 `json:"total_day_hour_qty"`
	RealNightHourQty  float64 `json:"real_night_hour_qty"`
	SimNightHourQty   float64 `json:"sim_night_hour_qty"`
	TotalNightHourQty float64 `json:"total_night_hour_qty"`
	RealGvnHourQty    float64 `json:"real_gvn_hour_qty"`
	SimGvnHourQty     float64 `json:"sim_gvn_hour_qty"`
	TotalGvnHourQty   float64 `json:"total_gvn_hour_qty"`
}

type Result struct {
	StartDate   string       `json:"startDate"`
	EndDate     string       `json:"endDate"`
	Tripulantes []Tripulante `json:"tripulantes"`
}
