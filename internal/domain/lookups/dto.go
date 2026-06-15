package lookups

// DTOs espejo de src-tauri/src/database/models/lookups.rs. Los tags JSON
// reproducen el comportamiento de serde para no romper el frontend.

type Aircraft struct {
	AircraftSk     int32  `json:"aircraft_sk"`
	AircraftNumber string `json:"aircraft_number"`
}

type AircraftManage struct {
	AircraftSk             int32  `json:"aircraft_sk"`
	AircraftRegistration   string `json:"aircraft_registration"`
	AircraftNumber         string `json:"aircraft_number"`
	AircraftCurrentFlag    bool   `json:"aircraft_current_flag"`
	AircraftType           string `json:"aircraft_type"`
	AircraftMake           string `json:"aircraft_make"`
	AircraftModel          string `json:"aircraft_model"`
	AircraftVariant        string `json:"aircraft_variant"`
	AircraftIsMultiEngine  bool   `json:"aircraft_is_multi_engine"`
	AircraftIsMultiPilot   bool   `json:"aircraft_is_multi_pilot"`
}

type DepartureArrivalPlace struct {
	DepartureArrivalPlaceSk   int32  `json:"departure_arrival_place_sk"`
	DepartureArrivalPlaceCode string `json:"departure_arrival_place_code"`
	DepartureArrivalPlaceName string `json:"departure_arrival_place_name"`
}

type EventManage struct {
	EventSk    int32  `json:"event_sk"`
	EventName  string `json:"event_name"`
	EventPlace string `json:"event_place"`
}

type Event struct {
	EventSk int32  `json:"event_sk"`
	Event   string `json:"event"`
}

type Authority struct {
	AuthoritySk   int32  `json:"authority_sk"`
	AuthorityName string `json:"authority_name"`
}

type Crew struct {
	PersonSk int32  `json:"person_sk"`
	PersonNk string `json:"person_nk"`
}

type Papeleta struct {
	PapeletaSk   int32  `json:"papeleta_sk"`
	PapeletaName string `json:"papeleta_name"`
}

type PassengerType struct {
	PassengerTypeSk   int32  `json:"passenger_type_sk"`
	PassengerTypeName string `json:"passenger_type_name"`
}

type ComisionType struct {
	ComisionTypeSk int32  `json:"comision_type_sk"`
	Name           string `json:"name"`
	Origin         string `json:"origin"`
}

type ComisionLugar struct {
	ComisionLugarSk int32  `json:"comision_lugar_sk"`
	ComisionName    string `json:"comision_name"`
}

// RecentComision es el contrato esperado por src/shared/hooks/useLookups.ts:
//   { comision_sk, lugar|null, tipo|null, fechaInicio|null, fechaFin|null, esfuerzo|null }
// `esfuerzo` se devuelve como *bool. La interfaz TS dice `string|null` pero
// el código Rust nunca lo leía bien (BIT → &str fallaba), así que enviábamos
// siempre null. Aquí enviamos el bool real; el frontend hace truthiness
// check sobre el valor y maneja ambos casos correctamente.
type RecentComision struct {
	ComisionSk  int32   `json:"comision_sk"`
	Lugar       *string `json:"lugar"`
	Tipo        *string `json:"tipo"`
	FechaInicio *string `json:"fechaInicio"`
	FechaFin    *string `json:"fechaFin"`
	Esfuerzo    *bool   `json:"esfuerzo"`
}

type PersonForComision struct {
	PersonSk        int32   `json:"person_sk"`
	PersonRank      *string `json:"person_rank"`
	PersonName      string  `json:"person_name"`
	PersonLastName1 string  `json:"person_last_name_1"`
	PersonLastName2 *string `json:"person_last_name_2"`
}

type Person struct {
	PersonSk int32  `json:"person_sk"`
	FullName string `json:"full_name"`
}

// ===== Request DTOs (mutaciones) =====

type AddDepartureArrivalPlaceReq struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type AddAircraftReq struct {
	Registration  string `json:"registration"`
	Number        string `json:"number"`
	AircraftType  string `json:"aircraft_type"`
	Make          string `json:"make"`
	Model         string `json:"model"`
	Variant       string `json:"variant"`
	IsMultiEngine bool   `json:"is_multi_engine"`
	IsMultiPilot  bool   `json:"is_multi_pilot"`
}

type UpdateAircraftCurrentFlagReq struct {
	CurrentFlag bool `json:"current_flag"`
}
