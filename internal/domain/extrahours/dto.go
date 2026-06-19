// DTOs del dominio extrahours: el contrato JSON con el frontend.
// Una fila de operations.extra_hour = horas extra de UNA persona (CTA, día,
// noche convencional, GVN, instrumentos) + observaciones, con fecha, tipo
// real/simulador y modelo de aeronave. Una persona puede tener varias filas
// (se suman en la vista agrupada y en los cálculos de horas).
package extrahours

// ============================================================
// DTOs entrada
// ============================================================

type ExtraHourFormData struct {
	Person    int32   `json:"person"` // person_sk
	Date      string  `json:"date"`   // YYYY-MM-DD
	Model     int32   `json:"model"`  // aircraft_model_sk
	IsReal    bool    `json:"isReal"` // true = real, false = simulador
	Cta       float64 `json:"cta"`
	Day       float64 `json:"day"`
	ConvNight float64 `json:"convNight"`
	Gvn       float64 `json:"gvn"`
	Inst      float64 `json:"inst"`
	Remarks   string  `json:"remarks"`
}

// ============================================================
// DTOs salida
// ============================================================

type InsertResult struct {
	ID      int32  `json:"id"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type ListQueryParams struct {
	Limit  int32
	Offset int32
	Search string
}

// PersonTotalsResult es la vista agrupada: una fila por persona con sus totales
// (todos los modelos y tipos combinados).
type PersonTotalsResult struct {
	Items      []PersonTotalsItem `json:"items"`
	TotalCount int32              `json:"total_count"`
}

type PersonTotalsItem struct {
	PersonSk    int32   `json:"personSk"`
	Persona     string  `json:"persona"`
	PersonaNk   string  `json:"personaNk"`
	RecordCount int32   `json:"recordCount"`
	Cta         float64 `json:"cta"`
	Day         float64 `json:"day"`
	ConvNight   float64 `json:"convNight"`
	Gvn         float64 `json:"gvn"`
	Inst        float64 `json:"inst"`
}

// ExtraHourItem es un registro individual (detalle de una persona). Incluye el
// modelo (sk + nombre legible) para que el frontend agrupe por aircraft_model.
type ExtraHourItem struct {
	ID        int32   `json:"id"`
	Persona   string  `json:"persona"`
	PersonaNk string  `json:"personaNk"`
	PersonSk  int32   `json:"personSk"`
	Date      string  `json:"date"` // YYYY-MM-DD
	IsReal    bool    `json:"isReal"`
	ModelSk   int32   `json:"modelSk"`
	ModelName string  `json:"modelName"`
	Cta       float64 `json:"cta"`
	Day       float64 `json:"day"`
	ConvNight float64 `json:"convNight"`
	Gvn       float64 `json:"gvn"`
	Inst      float64 `json:"inst"`
	Remarks   string  `json:"remarks"`
}
