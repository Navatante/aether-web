import { Person } from "@/types/person";

const safeString = (val: any, def = "") => (typeof val === "string" ? val : def);
const safeNumber = (val: any, def = 0) => (typeof val === "number" ? val : def);

const safeBitToBoolean = (val: any, def = false): boolean => {
    if (val === null || val === undefined) return def;
    return val === 1 || val === true;
};

export const transformPersonnelFromDB = (raw: any[]): Person[] => {
    return raw.map((p) => ({
        person_sk: safeNumber(p.id),
        person_nk: safeString(p.nk) || null,
        person_user: safeString(p.usuario),
        person_rank: safeString(p.empleo),
        person_cuerpo: safeString(p.cuerpo),
        person_especialidad: safeString(p.especialidad),
        person_name: safeString(p.nombre),
        person_last_name_1: safeString(p.apellido1),
        person_last_name_2: safeString(p.apellido2),
        person_phone: safeString(p.telefono),
        person_dni: safeString(p.dni) || null,
        person_localidad: safeString(p.localidad),
        person_division: safeString(p.division),
        person_rol: safeString(p.rol),
        person_a_emp: safeString(p.antiguedadEmpleo),
        person_f_emb: safeString(p.fechaEmbarco),
        person_birthdate: safeString(p.fechaNacimiento),
        person_num_escalafon: safeNumber(p.numeroEscalafon),
        person_active: safeBitToBoolean(p.activo, false),
    }));
};
