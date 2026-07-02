// DTOs del dominio papeletas: contrato JSON con el frontend.
// Separados en su propio archivo para que tygo los exporte a TypeScript
// (make types → web/src/types/generated/papeletas.ts).
package papeletas

// Papeleta es el contrato JSON. Los Option<T> originales del Rust se
// representan como *T (omitidos cuando null no es relevante).
type Papeleta struct {
	PapeletaSk            int32    `json:"papeleta_sk"`
	PapeletaName          string   `json:"papeleta_name"`
	PapeletaDescription   string   `json:"papeleta_description"`
	PapeletaBlock         string   `json:"papeleta_block"`
	PapeletaPlan          *string  `json:"papeleta_plan"`
	PapeletaTv            *float64 `json:"papeleta_tv"`
	PapeletaPilotCrpValue *int32   `json:"papeleta_pilot_crp_value"`
	PapeletaDvCrpValue    *int32   `json:"papeleta_dv_crp_value"`
	PapeletaExpiration    *int32   `json:"papeleta_expiration"`
	PapeletaOrder         *int32   `json:"papeleta_order"`
}

type ListResult struct {
	Items      []Papeleta `json:"items"`
	TotalCount int32      `json:"total_count"`
}

// WriteReq espeja CreatePapeletaDto del Rust.
type WriteReq struct {
	PapeletaName          string   `json:"papeleta_name"`
	PapeletaDescription   string   `json:"papeleta_description"`
	PapeletaBlock         string   `json:"papeleta_block"`
	PapeletaPlan          *string  `json:"papeleta_plan"`
	PapeletaTv            *float64 `json:"papeleta_tv"`
	PapeletaPilotCrpValue *int32   `json:"papeleta_pilot_crp_value"`
	PapeletaDvCrpValue    *int32   `json:"papeleta_dv_crp_value"`
	PapeletaExpiration    *int32   `json:"papeleta_expiration"`
	PapeletaOrder         *int32   `json:"papeleta_order"`
}
