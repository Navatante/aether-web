// DTOs del dominio fuel (combustible): el contrato JSON con el frontend.
// Una fila de operations.fuel = un repostaje: fecha, aeronave (helo), lugar,
// pagador, evento, fase y tipo de combustible + cantidad (litros). El listado
// se pagina y se acota por mes/año (o por ID buscado); FuelSummary agrega los
// litros del mes por dimensión para la tabla-resumen.
package fuel

// ============================================================
// DTOs entrada
// ============================================================

// FuelPayload es el cuerpo de alta/edición de un repostaje (POST/PUT).
type FuelPayload struct {
	FuelDate    string  `json:"fuel_date"` // YYYY-MM-DD
	FuelHeloFk  int32   `json:"fuel_helo_fk"`
	FuelPlaceFk int32   `json:"fuel_place_fk"`
	FuelPayerFk int32   `json:"fuel_payer_fk"`
	FuelEventFk int32   `json:"fuel_event_fk"`
	FuelPhaseFk int32   `json:"fuel_phase_fk"`
	FuelTypeFk  int32   `json:"fuel_type_fk"`
	FuelQty     float64 `json:"fuel_qty"`
}

// ListQueryParams: mes/año a mostrar + búsqueda opcional por ID + paginación.
// Si FuelSk != 0 se busca ese registro concreto (ignorando el mes).
type ListQueryParams struct {
	Month  int // 1-12
	Year   int
	FuelSk int32
	Limit  int32
	Offset int32
}

// ============================================================
// DTOs salida
// ============================================================

type InsertResult struct {
	ID      int32  `json:"id"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// FuelListResponse es la respuesta paginada de ListFuel.
type FuelListResponse struct {
	Items      []FuelItem `json:"items"`
	TotalCount int32      `json:"total_count"`
}

// FuelItem es un repostaje con las etiquetas resueltas + los *_fk (para
// precargar el formulario de edición).
type FuelItem struct {
	ID              int32   `json:"id"`
	FuelDate        string  `json:"fuel_date"` // YYYY-MM-DD
	FuelHeloFk      int32   `json:"fuel_helo_fk"`
	AircraftNumber  string  `json:"aircraft_number"`
	FuelPlaceFk     int32   `json:"fuel_place_fk"`
	FuelPlaceName   string  `json:"fuel_place_name"`
	FuelPlaceType   string  `json:"fuel_place_type"`
	FuelPayerFk     int32   `json:"fuel_payer_fk"`
	FuelPayerAbbrev string  `json:"fuel_payer_abbrev"`
	FuelPayerName   string  `json:"fuel_payer_name"`
	FuelEventFk     int32   `json:"fuel_event_fk"`
	EventName       string  `json:"event_name"`
	EventPlace      string  `json:"event_place"`
	FuelPhaseFk     int32   `json:"fuel_phase_fk"`
	FuelPhase       string  `json:"fuel_phase"`
	FuelTypeFk      int32   `json:"fuel_type_fk"`
	FuelType        string  `json:"fuel_type"`
	FuelQty         float64 `json:"fuel_qty"`
}

// FuelDetailRow es una fila de detalle del informe: combinación evento + fase +
// lugar (nombre y tipo) con sus litros, dentro de un grupo de pagador.
type FuelDetailRow struct {
	Event     string  `json:"event"`
	Phase     string  `json:"phase"`
	PlaceName string  `json:"place_name"`
	PlaceType string  `json:"place_type"`
	Qty       float64 `json:"qty"`
}

// FuelPayerGroup agrupa las filas de detalle de un pagador con su subtotal.
type FuelPayerGroup struct {
	Payer    string          `json:"payer"`
	Rows     []FuelDetailRow `json:"rows"`
	Subtotal float64         `json:"subtotal"`
}

// FuelSummary alimenta el informe seccionado del mes: grupos por pagador (con
// subtotal) y un único total general.
type FuelSummary struct {
	Payers     []FuelPayerGroup `json:"payers"`
	GrandTotal float64          `json:"grand_total"`
}
