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

// FormationTripulante son las horas de vuelo en formación (operations.formation_hour)
// por persona, desglosadas en los dos periodos relevantes: Día y GVN.
type FormationTripulante struct {
	PersonNk   string  `json:"person_nk"`
	DayHourQty float64 `json:"day_hour_qty"`
	GvnHourQty float64 `json:"gvn_hour_qty"`
}

type FormationResult struct {
	StartDate   string                `json:"startDate"`
	EndDate     string                `json:"endDate"`
	Tripulantes []FormationTripulante `json:"tripulantes"`
}

// GvntypeTripulante son las horas por tipo de gafas de visión nocturna
// (operations.gvntype_hour) por persona: IIT y ANVIS.
type GvntypeTripulante struct {
	PersonNk     string  `json:"person_nk"`
	IitHourQty   float64 `json:"iit_hour_qty"`
	AnvisHourQty float64 `json:"anvis_hour_qty"`
}

type GvntypeResult struct {
	StartDate   string              `json:"startDate"`
	EndDate     string              `json:"endDate"`
	Tripulantes []GvntypeTripulante `json:"tripulantes"`
}

// IftTripulante son las horas de vuelo por instrumentos (operations.ift_hour)
// por persona.
type IftTripulante struct {
	PersonNk   string  `json:"person_nk"`
	IftHourQty float64 `json:"ift_hour_qty"`
}

type IftResult struct {
	StartDate   string          `json:"startDate"`
	EndDate     string          `json:"endDate"`
	Tripulantes []IftTripulante `json:"tripulantes"`
}

// InstructorTripulante son las horas de vuelo como instructor
// (operations.instructor_hour) por persona.
type InstructorTripulante struct {
	PersonNk          string  `json:"person_nk"`
	InstructorHourQty float64 `json:"instructor_hour_qty"`
}

type InstructorResult struct {
	StartDate   string                 `json:"startDate"`
	EndDate     string                 `json:"endDate"`
	Tripulantes []InstructorTripulante `json:"tripulantes"`
}

// CtaTripulante son las horas como Comandante de Aeronave (CTA) por persona. El
// sumatorio combina los vuelos en Aether donde la persona es CTA con las horas
// CTA de los modelos anteriores (real + sim); ver el detalle en la query
// CtaHours de queries/hours.sql.
type CtaTripulante struct {
	PersonNk   string  `json:"person_nk"`
	CtaHourQty float64 `json:"cta_hour_qty"`
}

type CtaResult struct {
	StartDate   string          `json:"startDate"`
	EndDate     string          `json:"endDate"`
	Tripulantes []CtaTripulante `json:"tripulantes"`
}

// WtTripulante son las horas de vuelo en Winch Trim (operations.wt_hour) por
// persona. Usado en la página de horas de Dotaciones.
type WtTripulante struct {
	PersonNk  string  `json:"person_nk"`
	WtHourQty float64 `json:"wt_hour_qty"`
}

type WtResult struct {
	StartDate   string         `json:"startDate"`
	EndDate     string         `json:"endDate"`
	Tripulantes []WtTripulante `json:"tripulantes"`
}
