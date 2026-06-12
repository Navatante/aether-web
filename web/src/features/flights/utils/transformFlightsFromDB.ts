import { FlightData, CrewMember } from "@/types/flights";

const safeNumber = (val: any, def = 0) => (typeof val === "number" ? val : def);

const transformCrewMember = (m: any): CrewMember => ({
    nombre: m.nombre || "",
    nk: m.nk || "",
    orden: safeNumber(m.orden),
    horaVueloPiloto: m.horaVueloPiloto
        ? {
            dia: safeNumber(m.horaVueloPiloto.dia),
            noche: safeNumber(m.horaVueloPiloto.noche),
            gvn: {
                total: safeNumber(m.horaVueloPiloto.gvn?.total),
                iit: safeNumber(m.horaVueloPiloto.gvn?.iit),
                anvis: safeNumber(m.horaVueloPiloto.gvn?.anvis),
            },
            instrumentos: safeNumber(m.horaVueloPiloto.instrumentos),
            instructor: safeNumber(m.horaVueloPiloto.instructor),
            formacionDia: safeNumber(m.horaVueloPiloto.formacionDia),
            formacionGvn: safeNumber(m.horaVueloPiloto.formacionGvn),
        }
        : undefined,
    horaVueloDotacion: m.horaVueloDotacion
        ? {
            dia: safeNumber(m.horaVueloDotacion.dia),
            noche: safeNumber(m.horaVueloDotacion.noche),
            gvn: safeNumber(m.horaVueloDotacion.gvn),
            winchTrim: safeNumber(m.horaVueloDotacion.winchTrim),
        }
        : undefined,
    tomas: m.tomas,
    aproximacionesInstr: m.aproximacionesInstr,
    aproximacionesSar: m.aproximacionesSar,
    proyectiles: m.proyectiles,
    papeletas: m.papeletas || [],
});

export const transformFlightsFromDB = (raw: any[]): FlightData[] => {
    return raw.map((f) => ({
        id: f.id,
        fecha: f.fecha,
        hora: f.hora,
        helicoptero: f.helicoptero,
        evento: f.evento,
        cteAeronave: f.cteAeronave,
        horas: safeNumber(f.horas),
        detalles: {
            tripulacion: {
                pilotos: (f.detalles?.tripulacion?.pilotos || []).map(transformCrewMember),
                dotaciones: (f.detalles?.tripulacion?.dotaciones || []).map(transformCrewMember),
            },
            cuposAutoridad: f.detalles?.cuposAutoridad || [],
            pasajeros: f.detalles?.pasajeros || [],
        },
    }));
};
