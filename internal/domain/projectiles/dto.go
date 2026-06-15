package projectiles

// Contrato JSON de proyectiles disparados por dotación (ProjectilesByCrew).
// Fuente de verdad para web/src/types/generated/projectiles.ts (tygo). NO duplicar a mano.

// CrewProjectiles agrega, por tripulante de dotación, los proyectiles disparados
// por tipo de arma (M3M = 7.62, MAG58 = 12.7) en un rango de fechas.
type CrewProjectiles struct {
	PersonNk string `json:"person_nk"`
	M3mQty   int    `json:"m3m_qty"`
	Mag58Qty int    `json:"mag58_qty"`
}

type Result struct {
	StartDate string            `json:"startDate"`
	EndDate   string            `json:"endDate"`
	Dotacion  []CrewProjectiles `json:"dotacion"`
}
