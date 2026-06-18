// DTOs del dominio extrahours: el contrato JSON con el frontend.
// Una fila de operations.extra_hour = horas de arrastre de UNA persona (CTA,
// día, noche convencional, GVN, instrumentos) + observaciones. Una persona
// puede tener varias filas (se suman en los cálculos de horas).
package extrahours

// ============================================================
// DTOs entrada
// ============================================================

type ExtraHourFormData struct {
	Person    int32   `json:"person"` // person_sk
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

// PersonTotalsResult es la vista agrupada: una fila por persona con sus totales.
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

// ExtraHourItem es un registro individual (detalle de una persona).
type ExtraHourItem struct {
	ID        int32   `json:"id"`
	Persona   string  `json:"persona"`
	PersonaNk string  `json:"personaNk"`
	PersonSk  int32   `json:"personSk"`
	Cta       float64 `json:"cta"`
	Day       float64 `json:"day"`
	ConvNight float64 `json:"convNight"`
	Gvn       float64 `json:"gvn"`
	Inst      float64 `json:"inst"`
	Remarks   string  `json:"remarks"`
}
