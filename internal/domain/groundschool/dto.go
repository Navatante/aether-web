// DTOs del dominio groundschool: el contrato JSON con el frontend.
// Una sesión de ground school = una papeleta impartida en una fecha/hora a
// N personas. El alta inserta una fila por persona.
package groundschool

// ============================================================
// DTOs entrada
// ============================================================

type GroundSchoolFormData struct {
	Date     string  `json:"date"`     // YYYY-MM-DD
	Papeleta int32   `json:"papeleta"` // papeleta_sk
	Persons  []int32 `json:"persons"`  // person_sk
}

// ============================================================
// DTOs salida
// ============================================================

type InsertResult struct {
	Inserted int32  `json:"inserted"`
	Success  bool   `json:"success"`
	Message  string `json:"message"`
}

type ListQueryParams struct {
	Limit          int32
	Offset         int32
	GroundSchoolSk int32
}

type ListResult struct {
	Items      []GroundSchoolItem `json:"items"`
	TotalCount int32              `json:"total_count"`
}

type GroundSchoolItem struct {
	ID          int32  `json:"id"`
	Fecha       string `json:"fecha"` // YYYY-MM-DD
	Persona     string `json:"persona"`
	PersonaNk   string `json:"personaNk"`
	Papeleta    string `json:"papeleta"`
	Bloque      string `json:"bloque"`
	Descripcion string `json:"descripcion"`
}
