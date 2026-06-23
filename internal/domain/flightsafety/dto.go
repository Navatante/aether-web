package flightsafety

// DTOs del dominio Seguridad de vuelo (contrato JSON; lo lee tygo).
//
// Cada reconocimiento (médico, dunker, hiperbárica) tiene ciclo de vida:
// PROGRAMADO (solo scheduled_date) → REALIZADO (date + resultado + expiry). El
// estado (vigente/por caducar/caducado/programado) se DERIVA en el frontend a
// partir de estas fechas; el backend solo entrega los datos crudos.
//
// Las fechas viajan como string "YYYY-MM-DD" ("" = ausente). Los *_sk de
// done/scheduled valen 0 cuando no hay registro de esa fase.

// ===== DTOs de salida (resumen por persona, alimenta la página) =====

// MedicalSummaryItem es el estado actual del reconocimiento médico de una
// persona: último realizado + cita programada abierta + próximo CIMA.
type MedicalSummaryItem struct {
	PersonSk        int32  `json:"person_sk"`
	PersonNk        string `json:"person_nk"`
	PersonRank      string `json:"person_rank"`
	PersonName      string `json:"person_name"`
	PersonLastName1 string `json:"person_last_name_1"`
	PersonLastName2 string `json:"person_last_name_2"`
	// Último reconocimiento REALIZADO (0/"" si no hay).
	DoneSk     int32  `json:"done_sk"`
	DoneDate   string `json:"done_date"`
	ExpiryDate string `json:"expiry_date"`
	Result     string `json:"result"`
	Place      string `json:"place"`
	Remark     string `json:"remark"`
	// Cita PROGRAMADA abierta (0/"" si no hay).
	ScheduledSk      int32  `json:"scheduled_sk"`
	ScheduledDate    string `json:"scheduled_date"`
	ScheduledPlace   string `json:"scheduled_place"`
	ScheduledPlaceFk int32  `json:"scheduled_place_fk"`
	ScheduledRemark  string `json:"scheduled_remark"`
	// Próxima cita que debe hacerse en CIMA (= último examen en CIMA + 4 años).
	NextCimaDue string `json:"next_cima_due"`
}

// ExamSummaryItem es el estado actual de un reconocimiento con resultado
// booleano (dunker, hiperbárica).
type ExamSummaryItem struct {
	PersonSk        int32  `json:"person_sk"`
	PersonNk        string `json:"person_nk"`
	PersonRank      string `json:"person_rank"`
	PersonName      string `json:"person_name"`
	PersonLastName1 string `json:"person_last_name_1"`
	PersonLastName2 string `json:"person_last_name_2"`
	DoneSk          int32  `json:"done_sk"`
	DoneDate        string `json:"done_date"`
	ExpiryDate      string `json:"expiry_date"`
	Result          *bool  `json:"result"`
	ScheduledSk     int32  `json:"scheduled_sk"`
	ScheduledDate   string `json:"scheduled_date"`
}

// ===== DTOs de salida (historial por persona) =====

type MedicalHistoryItem struct {
	ID            int32  `json:"id"`
	Date          string `json:"date"`
	ScheduledDate string `json:"scheduled_date"`
	ExpiryDate    string `json:"expiry_date"`
	Result        string `json:"result"`
	Place         string `json:"place"`
	Remark        string `json:"remark"`
}

type ExamHistoryItem struct {
	ID            int32  `json:"id"`
	Date          string `json:"date"`
	ScheduledDate string `json:"scheduled_date"`
	ExpiryDate    string `json:"expiry_date"`
	Result        *bool  `json:"result"`
}

// MeResponse son los datos propios del tripulante (Panel del tripulante).
// Cualquiera de los tres puede ser null si la persona no es personal vigente.
type MeResponse struct {
	Medical    *MedicalSummaryItem `json:"medical"`
	Dunker     *ExamSummaryItem    `json:"dunker"`
	Hyperbaric *ExamSummaryItem    `json:"hyperbaric"`
}

// ===== DTOs de entrada (altas / completar) =====

// MedicalPayload sirve para programar (solo scheduled_date) o registrar un
// reconocimiento médico realizado (date + expiry + result_fk + place_fk).
type MedicalPayload struct {
	PersonSk      int32  `json:"person_sk"`
	Date          string `json:"date"`
	ScheduledDate string `json:"scheduled_date"`
	ExpiryDate    string `json:"expiry_date"`
	PlaceFk       *int32 `json:"place_fk"`
	ResultFk      *int32 `json:"result_fk"`
	Remark        string `json:"remark"`
}

// ExamPayload sirve para programar o registrar un dunker/hiperbárica.
type ExamPayload struct {
	PersonSk      int32  `json:"person_sk"`
	Date          string `json:"date"`
	ScheduledDate string `json:"scheduled_date"`
	ExpiryDate    string `json:"expiry_date"`
	Result        *bool  `json:"result"`
}

// InsertResult es el envoltorio estándar de las altas.
type InsertResult struct {
	ID      int32  `json:"id"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}
