// src/types/person.ts
export interface Person {
    person_sk: number;
    person_nk: string | null;
    person_user: string;
    person_rank: string;
    person_cuerpo: string;
    person_especialidad: string;
    person_name: string;
    person_last_name_1: string;
    person_last_name_2: string;
    person_phone: string;
    person_dni: string | null;
    person_division: string;
    person_rol: string;
    person_a_emp: string;
    person_f_emb: string;
    person_birthdate: string;
    person_num_escalafon: number;
    person_active: boolean;
}