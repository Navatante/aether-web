// DTOs del dominio ratings: contrato JSON con el frontend.
package ratings

// ============================================================
// DTOs
// ============================================================

// --- Calificaciones de catálogo ---

type RatingDef struct {
	CrewRatingSk int32  `json:"crew_rating_sk"`
	Name         string `json:"name"`
	Abbreviation string `json:"abbreviation"`
}

type NotCrewRatingDef struct {
	NotCrewRatingSk   int32  `json:"notCrew_rating_sk"`
	NotCrewRatingName string `json:"notCrew_rating_name"`
	NotCrewRatingAbrv string `json:"notCrew_rating_abrv"`
}

// --- Persona base + calificaciones simples (Model/Leadership/Maintenance) ---

type PersonWithQualifications struct {
	PersonSk       int32                 `json:"person_sk"`
	PersonNk       *string               `json:"person_nk"`
	FullName       string                `json:"full_name"`
	PersonRol      string                `json:"person_rol"`
	Calificaciones []SimpleQualification `json:"calificaciones"`
}

type SimpleQualification struct {
	CrewRatingSk  int32  `json:"crew_rating_sk"`
	CrewRatingsFk int32  `json:"crew_ratings_fk"`
	DateQualified string `json:"date_qualified"`
}

type NotCrewPersonWithQualifications struct {
	PersonSk       int32                        `json:"person_sk"`
	FullName       string                       `json:"full_name"`
	PersonRol      string                       `json:"person_rol"`
	Calificaciones []SimpleNotCrewQualification `json:"calificaciones"`
}

type SimpleNotCrewQualification struct {
	NotCrewRatingsSk int32  `json:"notCrew_ratings_sk"`
	NotCrewRatingFk  int32  `json:"notCrew_rating_fk"`
	DateQualified    string `json:"date_qualified"`
}

// --- ModelRatings ---

type ModelRatingsResult struct {
	CalificacionesModeloPilotos    []RatingDef                `json:"calificaciones_modelo_pilotos"`
	CalificacionesModeloDotaciones []RatingDef                `json:"calificaciones_modelo_dotaciones"`
	TodosPilotos                   []PersonWithQualifications `json:"todos_pilotos"`
	TodasDotaciones                []PersonWithQualifications `json:"todas_dotaciones"`
}

// --- LeadershipRatings ---

type LeadershipRatingsResult struct {
	CalificacionesMandoYLiderazgoPilotos []RatingDef                `json:"calificaciones_mandoYliderazgo_pilotos"`
	TodosPilotos                         []PersonWithQualifications `json:"todos_pilotos"`
}

// --- MaintenanceRatings ---

type MaintenanceRatingsResult struct {
	CalificacionesMantenimiento []NotCrewRatingDef                `json:"calificaciones_mantenimiento"`
	TodosMantenedores           []NotCrewPersonWithQualifications `json:"todos_mantenedores"`
}

// --- OperationalRatings ---

type OperationalPerson struct {
	PersonSk              int32                    `json:"person_sk"`
	PersonNk              *string                  `json:"person_nk"`
	FullName              string                   `json:"full_name"`
	PersonRol             string                   `json:"person_rol"`
	CalificacionOperativa OperationalQualification `json:"calificacion_operativa"`
}

type OperationalQualification struct {
	Abrv               string `json:"abrv"`
	Name               string `json:"name"`
	MessageInstruction string `json:"message_instruction"`
	MessageHours       string `json:"message_hours"`
	MessageCrp         string `json:"message_crp"`
}

type OperationalRatingsResult struct {
	TodosPilotos    []OperationalPerson `json:"todos_pilotos"`
	TodasDotaciones []OperationalPerson `json:"todas_dotaciones"`
}

// --- GeneralTacticalRatings ---

type TacticalQualification struct {
	CrewRatingSk                  int32    `json:"crew_rating_sk"`
	CrewRatingsFk                 int32    `json:"crew_ratings_fk"`
	DateQualified                 string   `json:"date_qualified"`
	State                         string   `json:"state"`
	TotalHorasVfrDiurno365        *float64 `json:"total_horas_VFR_diurno_365,omitempty"`
	TotalHorasVfrNocturno365      *float64 `json:"total_horas_VFR_nocturno_365,omitempty"`
	TotalHorasGvn90               *float64 `json:"total_horas_GVN_90,omitempty"`
	TotalHorasGvn365              *float64 `json:"total_horas_GVN_365,omitempty"`
	TotalHorasIfr365              *float64 `json:"total_horas_IFR_365,omitempty"`
	TotalAppPrecision365          *int32   `json:"total_app_precision_365,omitempty"`
	TotalAppNoPrecision365        *int32   `json:"total_app_no_precision_365,omitempty"`
	TotalTomasDiaBuque182         *int32   `json:"total_tomas_dia_buque_182,omitempty"`
	TotalTomasDiaMono182          *int32   `json:"total_tomas_dia_mono_182,omitempty"`
	TotalTomasDiaMulti182         *int32   `json:"total_tomas_dia_multi_182,omitempty"`
	TotalTomasDiaCarrier182       *int32   `json:"total_tomas_dia_carrier_182,omitempty"`
	TotalTomasNocheConvBuque182   *int32   `json:"total_tomas_nocheConv_buque_182,omitempty"`
	TotalTomasNocheConvMono182    *int32   `json:"total_tomas_nocheConv_mono_182,omitempty"`
	TotalTomasNocheConvMulti182   *int32   `json:"total_tomas_nocheConv_multi_182,omitempty"`
	TotalTomasNocheConvCarrier182 *int32   `json:"total_tomas_nocheConv_carrier_182,omitempty"`
	TotalTomasGvnBuque182         *int32   `json:"total_tomas_GVN_buque_182,omitempty"`
	TotalTomasGvnMono182          *int32   `json:"total_tomas_GVN_mono_182,omitempty"`
	TotalTomasGvnMulti182         *int32   `json:"total_tomas_GVN_multi_182,omitempty"`
	TotalTomasGvnCarrier182       *int32   `json:"total_tomas_GVN_carrier_182,omitempty"`
}

type TacticalPerson struct {
	PersonSk       int32                   `json:"person_sk"`
	PersonNk       *string                 `json:"person_nk"`
	FullName       string                  `json:"full_name"`
	PersonRol      string                  `json:"person_rol"`
	Calificaciones []TacticalQualification `json:"calificaciones"`
}

type GeneralTacticalRatingsResult struct {
	CalificacionesGeneralTacticaSoloPilotos []RatingDef      `json:"calificaciones_generalTactica_soloPilotos"`
	CalificacionesGeneralTacticaCompartida  []RatingDef      `json:"calificaciones_generalTactica_compartida"`
	TodosPilotos                            []TacticalPerson `json:"todos_pilotos"`
	TodasDotaciones                         []TacticalPerson `json:"todas_dotaciones"`
}

// --- CRUD ---

type AddCrewRatingReq struct {
	PersonFk      int32  `json:"person_fk"`
	CrewRatingsFk int32  `json:"crew_ratings_fk"`
	DateQualified string `json:"date_qualified"`
}

type AddNotCrewRatingReq struct {
	PersonFk      int32  `json:"person_fk"`
	CrewRatingsFk int32  `json:"crew_ratings_fk"`
	DateQualified string `json:"date_qualified"`
}
