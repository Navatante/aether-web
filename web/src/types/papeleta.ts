// src/types/papeleta.ts
export interface Papeleta {
    papeleta_sk: number;
    papeleta_name: string;
    papeleta_description: string;
    papeleta_block: string;
    papeleta_plan: string | null;
    papeleta_tv: number | null;
    papeleta_pilot_crp_value: number | null;
    papeleta_dv_crp_value: number | null;
    papeleta_expiration: number | null;
}
