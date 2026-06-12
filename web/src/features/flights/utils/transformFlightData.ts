import { FormData } from "../components/forms/schema";

export function transformFormDataForSubmit(data: FormData) {
    return {
        general: {
            date: data.general.date,
            departurePlace: data.general.departurePlace,
            departureTime: data.general.departureTime,
            arrivalPlace: data.general.arrivalPlace,
            arrivalTime: data.general.arrivalTime,
            aircraft: data.general.aircraft,
            event: data.general.event,
            totalHours: data.general.totalHours,
        },
        pilots: data.pilots.map(pilot => ({
            name: pilot.name,
            person_hour: {
                hDay: pilot.person_hour.hDay || "",
                hNight: pilot.person_hour.hNight || "",
                hGvn: pilot.person_hour.hGvn || ""
            },
            ift_hour: pilot.ift_hour || "",
            gvnType_hour: {
                hIit: pilot.gvnType_hour?.hIit || "",
                hAnvis: pilot.gvnType_hour?.hAnvis || ""
            },
            instructor_hour: pilot.instructor_hour || "",
            formation_hour: {
                hfDay: pilot.formation_hour?.hfDay || "",
                hfGvn: pilot.formation_hour?.hfGvn || ""
            },
            app: {
                precision: pilot.app?.precision || "",
                noPrecision: pilot.app?.noPrecision || "",
                td: pilot.app?.td || "",
                sp: pilot.app?.sp || ""
            },
            landing: {
                tierra: {
                    lDay: pilot.landing?.tierra?.lDay || "",
                    lNight: pilot.landing?.tierra?.lNight || "",
                    lGvn: pilot.landing?.tierra?.lGvn || ""
                },
                mono: {
                    lDay: pilot.landing?.mono?.lDay || "",
                    lNight: pilot.landing?.mono?.lNight || "",
                    lGvn: pilot.landing?.mono?.lGvn || ""
                },
                multi: {
                    lDay: pilot.landing?.multi?.lDay || "",
                    lNight: pilot.landing?.multi?.lNight || "",
                    lGvn: pilot.landing?.multi?.lGvn || ""
                },
                carrier: {
                    lDay: pilot.landing?.carrier?.lDay || "",
                    lNight: pilot.landing?.carrier?.lNight || "",
                    lGvn: pilot.landing?.carrier?.lGvn || ""
                }
            }
        })),
        dvs: data.dvs.map(dv => ({
            name: dv.name,
            person_hour: {
                hDay: dv.person_hour.hDay || "",
                hNight: dv.person_hour.hNight || "",
                hGvn: dv.person_hour.hGvn || ""
            },
            wt_hour: dv.wt_hour || "",
            projectile: {
                m3m: dv.projectile?.m3m || "",
                mag58: dv.projectile?.mag58 || ""
            }
        })),
        papeletas: data.papeletas.map(papeleta => ({
            crew: papeleta.crew || [],
            papeleta: papeleta.papeleta.map(item => ({
                sk: item.sk,
                period: item.period === 'gvn' ? 3 : 1,
            })),
        })),
        cupos: data.cupos.map(cupo => ({
            autoridad: cupo.autoridad,
            horas: cupo.horas || ""
        })),
        pasajeros: data.pasajeros.map(pasajero => ({
            tipo: pasajero.tipo,
            cantidad: pasajero.cantidad || "",
            ruta: pasajero.ruta || ""
        }))
    };
}
