import { Papeleta } from "@/types/papeleta";

const safeString = (val: any, def = "") => (typeof val === "string" ? val : def);
const safeNumber = (val: any, def = 0) => (typeof val === "number" ? val : def);

export const transformPapeletasFromDB = (raw: any[]): Papeleta[] => {
    return raw.map((p) => ({
        papeleta_sk: safeNumber(p.papeleta_sk),
        papeleta_name: safeString(p.papeleta_name),
        papeleta_description: safeString(p.papeleta_description),
        papeleta_block: safeString(p.papeleta_block),
        papeleta_plan: safeString(p.papeleta_plan),
        papeleta_tv: safeNumber(p.papeleta_tv),
        papeleta_pilot_crp_value: safeNumber(p.papeleta_pilot_crp_value),
        papeleta_dv_crp_value: safeNumber(p.papeleta_dv_crp_value),
        papeleta_expiration: safeNumber(p.papeleta_expiration),
        papeleta_order: typeof p.papeleta_order === "number" ? p.papeleta_order : null,
    }));
};
