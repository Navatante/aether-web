// DTOs del dominio flights: el contrato JSON con el frontend.
// Entrada: espejo del FlightFormData heredado (camelCase mixto).
// Salida: espejo del SP sp_get_flights_with_flexible_crew.
package flights

// ============================================================
// DTOs entrada — espejo del FlightFormData Rust (camelCase mixto).
// ============================================================

type FlightFormData struct {
	General   GeneralData    `json:"general"`
	Pilots    []PilotData    `json:"pilots"`
	Dvs       []DvData       `json:"dvs"`
	Papeletas []PapeletaData `json:"papeletas"`
	Cupos     []CupoData     `json:"cupos"`
	Pasajeros []PasajeroData `json:"pasajeros"`
}

type GeneralData struct {
	Date           string `json:"date"` // YYYY-MM-DD
	DeparturePlace int32  `json:"departurePlace"`
	DepartureTime  string `json:"departureTime"` // HH:MM
	ArrivalPlace   int32  `json:"arrivalPlace"`
	ArrivalTime    string `json:"arrivalTime"`
	Aircraft       int32  `json:"aircraft"`
	Event          int32  `json:"event"`
	TotalHours     string `json:"totalHours"` // float as string
}

type PilotData struct {
	Name           int32          `json:"name"` // person_sk
	PersonHour     PersonHours    `json:"person_hour"`
	IftHour        string         `json:"ift_hour"`
	GvnTypeHour    GvnTypeHours   `json:"gvnType_hour"`
	InstructorHour string         `json:"instructor_hour"`
	FormationHour  FormationHours `json:"formation_hour"`
	App            Approaches     `json:"app"`
	Landing        LandingData    `json:"landing"`
}

type DvData struct {
	Name       int32          `json:"name"`
	PersonHour PersonHours    `json:"person_hour"`
	WtHour     string         `json:"wt_hour"`
	Projectile ProjectileData `json:"projectile"`
}

type PersonHours struct {
	HDay   string `json:"hDay"`
	HNight string `json:"hNight"`
	HGvn   string `json:"hGvn"`
}

type GvnTypeHours struct {
	HIit   string `json:"hIit"`
	HAnvis string `json:"hAnvis"`
}

type FormationHours struct {
	HfDay string `json:"hfDay"`
	HfGvn string `json:"hfGvn"`
}

type Approaches struct {
	Precision   string `json:"precision"`
	NoPrecision string `json:"noPrecision"`
	Td          string `json:"td"`
	Sp          string `json:"sp"`
}

type LandingData struct {
	Tierra  LandingTypeData `json:"tierra"`
	Mono    LandingTypeData `json:"mono"`
	Multi   LandingTypeData `json:"multi"`
	Carrier LandingTypeData `json:"carrier"`
}

type LandingTypeData struct {
	LDay   string `json:"lDay"`
	LNight string `json:"lNight"`
	LGvn   string `json:"lGvn"`
}

type ProjectileData struct {
	M3M   string `json:"m3m"`
	Mag58 string `json:"mag58"`
}

type PapeletaData struct {
	Crew     []int32        `json:"crew"`
	Papeleta []PapeletaItem `json:"papeleta"`
}

type PapeletaItem struct {
	Sk     int32 `json:"sk"`
	Period int32 `json:"period"`
}

type CupoData struct {
	Autoridad int32  `json:"autoridad"`
	Horas     string `json:"horas"`
}

type PasajeroData struct {
	Tipo     int32  `json:"tipo"`
	Cantidad string `json:"cantidad"`
	Ruta     string `json:"ruta"`
}

// ============================================================
// DTOs salida — listing en formato del SP.
// ============================================================

type InsertResult struct {
	FlightID int32  `json:"flight_id"`
	Success  bool   `json:"success"`
	Message  string `json:"message"`
}

type ListQueryParams struct {
	Limit    int32
	Offset   int32
	FlightSk int32
	DateFrom string
	DateTo   string
}

type ListResult struct {
	Items      []FlightItem `json:"items"`
	TotalCount int32        `json:"total_count"`
}

type FlightItem struct {
	ID          int32         `json:"id"`
	Fecha       string        `json:"fecha"` // YYYY-MM-DD
	Hora        string        `json:"hora"`  // HH:MM
	Helicoptero string        `json:"helicoptero"`
	Evento      string        `json:"evento"`
	CteAeronave string        `json:"cteAeronave"`
	Horas       float64       `json:"horas"`
	Detalles    FlightDetails `json:"detalles"`
}

type FlightDetails struct {
	Tripulacion    Tripulacion    `json:"tripulacion"`
	CuposAutoridad []CupoJSON     `json:"cuposAutoridad"`
	Pasajeros      []PasajeroJSON `json:"pasajeros"`
}

type Tripulacion struct {
	Pilotos    []PilotoJSON   `json:"pilotos"`
	Dotaciones []DotacionJSON `json:"dotaciones"`
}

type PilotoJSON struct {
	Nombre              string         `json:"nombre"`
	Nk                  string         `json:"nk"`
	Orden               int64          `json:"orden"`
	HoraVueloPiloto     HVPilotoJSON   `json:"horaVueloPiloto"`
	Tomas               TomasJSON      `json:"tomas"`
	AproximacionesInstr ApsInstrJSON   `json:"aproximacionesInstr"`
	AproximacionesSar   ApsSarJSON     `json:"aproximacionesSar"`
	Papeletas           []PapeletaJSON `json:"papeletas"`
}

type HVPilotoJSON struct {
	Dia          float64    `json:"dia"`
	Noche        float64    `json:"noche"`
	Gvn          GvnSubJSON `json:"gvn"`
	Instrumentos float64    `json:"instrumentos"`
	Instructor   float64    `json:"instructor"`
	FormacionDia float64    `json:"formacionDia"`
	FormacionGvn float64    `json:"formacionGvn"`
}

type GvnSubJSON struct {
	Total float64 `json:"total"`
	Iit   float64 `json:"iit"`
	Anvis float64 `json:"anvis"`
}

type TomasJSON struct {
	Dia       LandingPlacesJSON `json:"dia"`
	NocheConv LandingPlacesJSON `json:"nocheConv"`
	Gvn       LandingPlacesJSON `json:"gvn"`
}

type LandingPlacesJSON struct {
	Tierra    int32 `json:"tierra"`
	Monospot  int32 `json:"monospot"`
	Multispot int32 `json:"multispot"`
	Carrier   int32 `json:"carrier"`
}

type ApsInstrJSON struct {
	Precision   int32 `json:"precision"`
	NoPrecision int32 `json:"noPrecision"`
}

type ApsSarJSON struct {
	Td int32 `json:"td"`
	Sp int32 `json:"sp"`
}

type PapeletaJSON struct {
	Nombre      string `json:"nombre"`
	Descripcion string `json:"descripcion"`
	Periodo     int32  `json:"periodo"`
}

type DotacionJSON struct {
	Nombre            string          `json:"nombre"`
	Nk                string          `json:"nk"`
	Orden             int64           `json:"orden"`
	HoraVueloDotacion HVDotacionJSON  `json:"horaVueloDotacion"`
	Proyectiles       ProyectilesJSON `json:"proyectiles"`
	Papeletas         []PapeletaJSON  `json:"papeletas"`
}

type HVDotacionJSON struct {
	Dia       float64 `json:"dia"`
	Noche     float64 `json:"noche"`
	Gvn       float64 `json:"gvn"`
	WinchTrim float64 `json:"winchTrim"`
}

type ProyectilesJSON struct {
	M3M   int32 `json:"m3m"`
	Mag58 int32 `json:"mag58"`
}

type CupoJSON struct {
	Autoridad string  `json:"autoridad"`
	Horas     float64 `json:"horas"`
}

type PasajeroJSON struct {
	Tipo     string `json:"tipo"`
	Cantidad int32  `json:"cantidad"`
	Ruta     string `json:"ruta"`
}
