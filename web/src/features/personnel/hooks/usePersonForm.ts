// Lógica del formulario de alta/edición de persona: lookups de catálogos,
// esquema dinámico, react-hook-form y reset al abrir. AddEditPersonForm queda
// solo-render sobre los campos compartidos de FormFields.

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createPersonSchema, type PersonFormValues } from "../components/forms/schema";
import {
    usePersonEspecialidadesLookup,
    usePersonEmpleosLookup,
    usePersonDivisionesLookup,
    usePersonRolesLookup,
    usePersonLocalidadesLookup
} from "@/shared/hooks";

const EMPTY_VALUES = {
    person_nk: "",
    person_user: "",
    person_rank: "",
    person_cuerpo: undefined,
    person_especialidad: "",
    person_name: "",
    person_last_name_1: "",
    person_last_name_2: "",
    person_phone: "",
    person_dni: "",
    person_localidad: "",
    person_division: "",
    person_rol: "",
    person_num_escalafon: 0,
    person_a_emp: undefined,
    person_f_emb: undefined,
    person_birthdate: undefined,
} as const;

export function usePersonForm(open: boolean, defaultValues?: Partial<PersonFormValues>) {
    // Catálogos para los selects (y para el esquema dinámico de validación).
    const { data: especialidades, loading: especialidadesLoading } = usePersonEspecialidadesLookup();
    const { data: empleos, loading: empleosLoading } = usePersonEmpleosLookup();
    const { data: divisiones, loading: divisionesLoading } = usePersonDivisionesLookup();
    const { data: roles, loading: rolesLoading } = usePersonRolesLookup();
    const { data: localidades, loading: localidadesLoading } = usePersonLocalidadesLookup();

    const isLoadingData = especialidadesLoading || empleosLoading || divisionesLoading || rolesLoading || localidadesLoading;

    // Esquema dinámico con los catálogos cargados.
    const personSchema = (() => {
        if (isLoadingData || roles.length === 0) return null;
        return createPersonSchema(roles, empleos, especialidades, divisiones, localidades);
    })();

    const {
        register,
        handleSubmit,
        control,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<PersonFormValues>({
        resolver: personSchema ? zodResolver(personSchema) : undefined,
        defaultValues: {
            ...EMPTY_VALUES,
            ...defaultValues,
        },
    });

    // Resetear cuando se abre el dialog.
    useEffect(() => {
        if (!open || isLoadingData) return;
        reset(defaultValues ?? EMPTY_VALUES);
    }, [open, isLoadingData, defaultValues, reset]);

    // Watch para fechas (los DateField no van por register).
    const aEmp = watch("person_a_emp");
    const fEmb = watch("person_f_emb");
    const birthdate = watch("person_birthdate");

    return {
        register,
        handleSubmit,
        control,
        setValue,
        reset,
        errors,
        isSubmitting,
        isLoadingData,
        catalogs: { especialidades, empleos, divisiones, roles, localidades },
        dates: { aEmp, fEmb, birthdate },
    };
}
