// Modelo compartido de la feature Combustible: catálogo fijo de tipos de lugar
// de repostaje. Espejo del CHECK chk_fuel_place_type del schema (operations.
// fuel_place). El backend valida contra esta misma lista al dar de alta un
// lugar; aquí solo poblamos el selector del sub-formulario "nuevo lugar".

export const FUEL_PLACE_TYPES = [
    'Aeropuerto nacional',
    'Aeropuerto internacional',
    'Buque nacional',
    'Buque internacional',
    'Base Naval de Rota',
] as const;

export type FuelPlaceType = (typeof FUEL_PLACE_TYPES)[number];

// Nombres de mes en español para el selector mes/año y las etiquetas de período.
export const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;
