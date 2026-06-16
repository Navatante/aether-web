package dashboard

// Contrato JSON espejo de src/types/dashboard.ts en el proyecto Tauri.
// Los nombres de campos deben coincidir EXACTAMENTE; el frontend ya tiene
// estos tipos y se reutilizarán sin tocar nada.

type Request struct {
	RangeType       string `json:"range_type"`
	PredefinedRange string `json:"predefined_range,omitempty"`
	DateFrom        string `json:"date_from,omitempty"`
	DateTo          string `json:"date_to,omitempty"`
}

// ===== Static =====

type StaticStats struct {
	Pilotos           PilotStats           `json:"pilotos"`
	TripulacionCabina TripulacionStats     `json:"tripulacion_cabina"`
	Mantenedores      MantenedoresStats    `json:"mantenedores"`
	Administrativos   AdministrativosStats `json:"administrativos"`
	PersonalTotal     PersonalTotalStats   `json:"personal_total"`
	CRP               int                  `json:"crp"`
	Airflow           int                  `json:"airflow"`
}

type PilotStats struct {
	Total int `json:"total"`
	PQM   int `json:"pqm"`
	H2P   int `json:"h2p"`
	HAC   int `json:"hac"`
	IP    int `json:"ip"`
	FCP   int `json:"fcp"`
	IPFCP int `json:"ip_fcp"`
}

type TripulacionStats struct {
	Total                  int `json:"total"`
	Alumnos                int `json:"alumnos"`
	Dotaciones             int `json:"dotaciones"`
	Cabezas                int `json:"cabezas"`
	DVInstructores         int `json:"dv_instructores"`
	DVPruebas              int `json:"dv_pruebas"`
	DVInstructoresYPruebas int `json:"dv_instructores_y_pruebas"`
	Nadadores              int `json:"nadadores"`
}

type MantenedoresStats struct {
	Total int `json:"total"`
	B1    int `json:"b1"`
	B2    int `json:"b2"`
	LV    int `json:"lv"`
}

type AdministrativosStats struct {
	Total         int `json:"total"`
	Detall        int `json:"detall"`
	Operaciones   int `json:"operaciones"`
	Mantenimiento int `json:"mantenimiento"`
}

type PersonalTotalStats struct {
	Total          int `json:"total"`
	Oficiales      int `json:"oficiales"`
	Suboficiales   int `json:"suboficiales"`
	TropaMarineria int `json:"tropa_marineria"`
}

// ===== Dynamic =====

type DynamicStats struct {
	FechaInicio         string             `json:"fechaInicio"` // YYYY-MM-DD
	FechaFin            string             `json:"fechaFin"`    // YYYY-MM-DD
	ResumenGeneral      ResumenGeneral     `json:"resumenGeneral"`
	HorasDeVuelo        []HorasDeVuelo     `json:"horasDeVuelo"`
	HorasPorHelicoptero []HorasHelicoptero `json:"horasPorHelicoptero"`
	HorasPorAutoridad   []HorasAutoridad   `json:"horasPorAutoridad"`
	HorasPorEventoLugar []HorasEventoLugar `json:"horasPorEventoLugar"`
	HorasPorPeriodo     HorasPeriodo       `json:"horasPorPeriodo"`
}

type ResumenGeneral struct {
	TotalHoras      float64 `json:"totalHoras"`
	TotalVuelos     int     `json:"totalVuelos"`
	HorasSimulador  float64 `json:"horasSimulador"`
	VuelosSimulador int     `json:"vuelosSimulador"`
}

type HorasDeVuelo struct {
	Date      string  `json:"date"`
	Real      float64 `json:"real"`
	Simulador float64 `json:"simulador"`
}

type HorasHelicoptero struct {
	Helo  string  `json:"helo"`
	Horas float64 `json:"horas"`
}

type HorasAutoridad struct {
	Autoridad   string  `json:"autoridad"`
	Abreviatura string  `json:"abreviatura"`
	Horas       float64 `json:"horas"`
}

type HorasEventoLugar struct {
	Evento  string             `json:"evento"`
	Lugares map[string]float64 `json:"lugares"`
}

type HorasPeriodo struct {
	DiaReal               float64 `json:"dia_real"`
	DiaSimulado           float64 `json:"dia_simulado"`
	NocheSinGafasReal     float64 `json:"noche_sin_gafas_real"`
	NocheSinGafasSimulado float64 `json:"noche_sin_gafas_simulado"`
	GVNReal               float64 `json:"gvn_real"`
	AnvisReal             float64 `json:"anvis_real"`
	IITReal               float64 `json:"iit_real"`
	GVNSimulado           float64 `json:"gvn_simulado"`
	AnvisSimulado         float64 `json:"anvis_simulado"`
	IITSimulado           float64 `json:"iit_simulado"`
}
