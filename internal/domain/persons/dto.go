// DTOs del dominio persons: contrato JSON con el frontend.
// Separados en su propio archivo para que tygo los exporte a TypeScript
// (make types → web/src/types/generated/persons.ts).
package persons

// PersonItem espeja el shape de sp_get_persons (Spanish aliases camelCase).
// El frontend ya lo consume así desde transformPersonnelFromDB.ts.
type PersonItem struct {
	ID               int32   `json:"id"`
	Nk               *string `json:"nk"`
	Usuario          string  `json:"usuario"`
	Empleo           string  `json:"empleo"`
	Cuerpo           string  `json:"cuerpo"`
	Especialidad     string  `json:"especialidad"`
	Nombre           string  `json:"nombre"`
	Apellido1        string  `json:"apellido1"`
	Apellido2        string  `json:"apellido2"`
	NombreCompleto   string  `json:"nombreCompleto"`
	Telefono         string  `json:"telefono"`
	Dni              *string `json:"dni"`
	Localidad        string  `json:"localidad"`
	Division         string  `json:"division"`
	Rol              string  `json:"rol"`
	AntiguedadEmpleo string  `json:"antiguedadEmpleo"` // YYYY-MM-DD
	FechaEmbarco     string  `json:"fechaEmbarco"`
	FechaNacimiento  string  `json:"fechaNacimiento"`
	NumeroEscalafon  int32   `json:"numeroEscalafon"`
	Activo           bool    `json:"activo"`
	OrdenPosicion    int64   `json:"ordenPosicion"`
}

type ListResult struct {
	Items      []PersonItem `json:"items"`
	TotalCount int32        `json:"total_count"`
}

// WriteReq espeja CreatePersonDto del Rust original.
// Bug fix vs Rust: añadimos person_localidad (NOT NULL en BD; el DTO Rust
// la omitía, lo que hacía que cualquier add_person fallara contra el esquema).
type WriteReq struct {
	PersonNk           *string `json:"person_nk"`
	PersonUser         string  `json:"person_user"`
	PersonRank         string  `json:"person_rank"`
	PersonCuerpo       string  `json:"person_cuerpo"`
	PersonEspecialidad string  `json:"person_especialidad"`
	PersonName         string  `json:"person_name"`
	PersonLastName1    string  `json:"person_last_name_1"`
	PersonLastName2    string  `json:"person_last_name_2"`
	PersonPhone        string  `json:"person_phone"`
	PersonDni          *string `json:"person_dni"`
	PersonLocalidad    string  `json:"person_localidad"`
	PersonDivision     string  `json:"person_division"`
	PersonRol          string  `json:"person_rol"`
	PersonAEmp         string  `json:"person_a_emp"`     // YYYY-MM-DD
	PersonFEmb         string  `json:"person_f_emb"`     // YYYY-MM-DD
	PersonBirthdate    string  `json:"person_birthdate"` // YYYY-MM-DD
	PersonNumEscalafon int32   `json:"person_num_escalafon"`
}

type PersonSkNk struct {
	PersonSk int32  `json:"person_sk"`
	PersonNk string `json:"person_nk"`
}

// ===== Superusuario (god-mode) DTOs =====

// SuperuserPersonItem es una persona de la escuadrilla del superusuario, para
// su panel (gestión de credenciales y permisos, acotada a la escuadrilla).
type SuperuserPersonItem struct {
	ID              int32  `json:"id"`
	NombreCompleto  string `json:"nombreCompleto"`
	Usuario         string `json:"usuario"`
	PermissionLevel string `json:"permissionLevel"`
	TienePassword   bool   `json:"tienePassword"`
}

type SetPermissionLevelReq struct {
	PermissionLevel string `json:"permissionLevel"`
}
