package landings

// Contrato JSON de tomas y aproximaciones por piloto (LandingsApproachesByPilot).
// Fuente de verdad para web/src/types/generated/landings.ts (tygo). NO duplicar a mano.

// PilotLandingsApproaches agrega, por piloto, las tomas (operations.landing) por
// lugar × periodo y las aproximaciones (operations.approach) por tipo, en un rango.
type PilotLandingsApproaches struct {
	PersonNk string `json:"person_nk"`

	// Tomas en Tierra (Día / Noche convencional / GVN)
	TierraDayQty   int `json:"tierra_day_qty"`
	TierraNightQty int `json:"tierra_night_qty"`
	TierraGvnQty   int `json:"tierra_gvn_qty"`

	// Tomas en Monospot
	MonoDayQty   int `json:"mono_day_qty"`
	MonoNightQty int `json:"mono_night_qty"`
	MonoGvnQty   int `json:"mono_gvn_qty"`

	// Tomas en Multispot
	MultiDayQty   int `json:"multi_day_qty"`
	MultiNightQty int `json:"multi_night_qty"`
	MultiGvnQty   int `json:"multi_gvn_qty"`

	// Tomas en Carrier
	CarrierDayQty   int `json:"carrier_day_qty"`
	CarrierNightQty int `json:"carrier_night_qty"`
	CarrierGvnQty   int `json:"carrier_gvn_qty"`

	// Aproximaciones Instrumentales (Precisión / No precisión)
	AppPrecisionQty   int `json:"app_precision_qty"`
	AppNoPrecisionQty int `json:"app_no_precision_qty"`

	// Aproximaciones SAR (Transition Down / Search Pattern)
	AppTransitionDownQty int `json:"app_transition_down_qty"`
	AppSearchPatternQty  int `json:"app_search_pattern_qty"`
}

type Result struct {
	StartDate string                    `json:"startDate"`
	EndDate   string                    `json:"endDate"`
	Pilotos   []PilotLandingsApproaches `json:"pilotos"`
}
