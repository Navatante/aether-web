package httpx

// maxPageLimit acota el tamaño de página de cualquier listado: sin techo, un
// limit=999999 del cliente arrastraría la tabla entera en una sola request.
const maxPageLimit = 100

// ClampLimit normaliza el tamaño de página pedido por el cliente: aplica def
// cuando no viene (<= 0) y maxPageLimit como techo.
func ClampLimit(limit, def int32) int32 {
	if limit <= 0 {
		return def
	}
	if limit > maxPageLimit {
		return maxPageLimit
	}
	return limit
}
