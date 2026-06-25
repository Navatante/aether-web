// DTOs del dominio comisiones: contrato JSON con el frontend.
package comisiones

// ============================================================
// DTOs
// ============================================================

// ComisionFormData espeja el DTO Rust (camelCase). Para crear/actualizar.
type ComisionFormData struct {
	StartDate       string `json:"fechaInicio"` // YYYY-MM-DD
	EndDate         string `json:"fechaFin"`    // YYYY-MM-DD
	Tipo            string `json:"tipo"`        // nombre o id
	Lugar           string `json:"lugar"`       // nombre o id
	GeneratesEffort bool   `json:"generaEsfuerzo"`
	HoraSalida      string `json:"horaSalida"`  // HH:MM (1er día, informativa)
	HoraLlegada     string `json:"horaLlegada"` // HH:MM (último día, ajusta esfuerzo)
	Codigo          string `json:"codigo"`      // código/referencia libre, opcional
}

type InsertResult struct {
	ComisionID int32  `json:"comision_id"`
	Success    bool   `json:"success"`
	Message    string `json:"message"`
}

// ComisionListItem es el shape del SP sp_get_comisiones (camelCase mixto).
type ComisionListItem struct {
	ComisionSk    int32                  `json:"comision_sk"`
	FechaInicio   string                 `json:"fecha_inicio"`
	FechaFin      string                 `json:"fecha_fin"`
	Dias          int32                  `json:"dias"`
	Lugar         string                 `json:"lugar"`
	Tipo          string                 `json:"tipo"`
	Esfuerzo      bool                   `json:"esfuerzo"`
	HoraSalida    string                 `json:"hora_salida"`  // HH:MM
	HoraLlegada   string                 `json:"hora_llegada"` // HH:MM
	ComisionCode  string                 `json:"comision_code"`
	Participantes []ComisionParticipante `json:"personas_participantes"`
}

type ComisionParticipante struct {
	PersonComisionSk int32  `json:"person_comision_sk"`
	Nombre           string `json:"nombre"`
	Orden            int64  `json:"orden"`
}

type ComisionQueryResult struct {
	Items      []ComisionListItem `json:"items"`
	TotalCount int32              `json:"total_count"`
}

// ComisionWithPeopleItem es el shape de db_get_comisiones_with_people (snake_case con people).
type ComisionWithPeopleItem struct {
	ComisionSk              int32    `json:"comision_sk"`
	ComisionDateStart       string   `json:"comision_date_start"`
	ComisionDateEnd         string   `json:"comision_date_end"`
	ComisionType            string   `json:"comision_type"`
	ComisionLocation        string   `json:"comision_location"`
	ComisionGeneratesEffort bool     `json:"comision_generates_effort"`
	People                  []Person `json:"people"`
}

type Person struct {
	PersonSk        int32   `json:"person_sk"`
	PersonNk        *string `json:"person_nk"`
	PersonRank      string  `json:"person_rank"`
	PersonName      string  `json:"person_name"`
	PersonLastName1 string  `json:"person_last_name_1"`
	PersonLastName2 string  `json:"person_last_name_2"`
}

type ComisionWithPeopleResult struct {
	Items      []ComisionWithPeopleItem `json:"items"`
	TotalCount int32                    `json:"total_count"`
}

// QueryParams = filtros para los dos listados.
type QueryParams struct {
	Limit      int32
	Offset     int32
	ComisionSk int32
	DateFrom   string
	DateTo     string
}

// PersonToComisionFormData espeja PersonToComisionFormData del Rust.
type PersonToComisionFormData struct {
	Comision string   `json:"comision"`
	Personas []string `json:"personas"`
}

type PersonToComisionInsertResult struct {
	ComisionID         int32  `json:"comision_id"`
	Success            bool   `json:"success"`
	Message            string `json:"message"`
	PersonasInsertadas int32  `json:"personas_insertadas"`
}

// Lugar CRUD
type LugarCreateReq struct {
	ComisionName string `json:"comision_name"`
}
type LugarUpdateReq struct {
	Name string `json:"name"`
}
type LugarResult struct {
	ComisionLugarSk int32  `json:"comision_lugar_sk"`
	ComisionName    string `json:"comision_name"`
}

// DiasComisionItem espeja sp_get_dias_comision.
type DiasComisionItem struct {
	PersonRank            string `json:"person_rank"`
	FullName              string `json:"full_name"`
	PersonRol             string `json:"person_rol"`
	Escala                string `json:"escala"`
	B1                    bool   `json:"b1"`
	B2                    bool   `json:"b2"`
	LV                    bool   `json:"lv"`
	DiasBaseCortaDuracion int32  `json:"dias_base_corta_duracion"`
	DiasDespliegues       int32  `json:"dias_despliegues"`
	DiasVoluntarias       int32  `json:"dias_voluntarias"`
	DiasOMP               int32  `json:"dias_OMP"`
	DiasUNADEST           int32  `json:"dias_UNADEST"`
	DiasUNAEMB            int32  `json:"dias_UNAEMB"`
	DiasRancheria         int32  `json:"dias_rancheria"`
}
