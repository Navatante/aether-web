// Lógica del panel de superusuario: lista global de personas + mutaciones
// para cambiar contraseña y nivel de permiso. (Componentes = solo render.)

import { useEffect, useState } from "react";
import { useApiQuery, useApiMutation } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useEscuadrilla } from "@/providers";
import type { SuperuserPerson } from "../superuser";

export function useSuperuser(enabled: boolean) {
    const { id: escId } = useEscuadrilla();
    const personsKey = queryKeys.superuser.persons(escId ?? 0);

    const personsQuery = useApiQuery<SuperuserPerson[]>(
        "GET",
        "/superuser/persons",
        { enabled },
        personsKey,
    );
    const persons = personsQuery.data ?? [];

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected = persons.find((p) => p.id === selectedId) ?? null;

    const [level, setLevel] = useState("");

    // Al cambiar de persona: reinicia el formulario al estado actual de esa persona.
    useEffect(() => {
        setLevel(selected?.permissionLevel ?? "");
    }, [selectedId, selected?.permissionLevel]);

    // Reseteo: el backend deja la contraseña en el valor por defecto ('aether')
    // y fuerza el cambio en el siguiente login. No se envía contraseña.
    const passwordMut = useApiMutation<void, { id: number }>(
        "PUT",
        (v) => `/superuser/persons/${v.id}/password`,
        {
            successMessage: "Contraseña reseteada a 'aether'",
            invalidateKeys: [personsKey],
            body: () => undefined,
        },
    );

    const levelMut = useApiMutation<void, { id: number; permissionLevel: string }>(
        "PATCH",
        (v) => `/superuser/persons/${v.id}/permission-level`,
        {
            successMessage: "Nivel de permiso actualizado",
            invalidateKeys: [personsKey],
        },
    );

    const resetPassword = () => {
        if (selected) passwordMut.mutate({ id: selected.id });
    };
    const submitLevel = () => {
        if (selected && level) levelMut.mutate({ id: selected.id, permissionLevel: level });
    };

    return {
        persons,
        isLoading: personsQuery.isLoading,
        selectedId,
        setSelectedId,
        selected,
        level,
        setLevel,
        resetPassword,
        submitLevel,
        savingPassword: passwordMut.isPending,
        savingLevel: levelMut.isPending,
        levelChanged: !!selected && level !== "" && level !== selected.permissionLevel,
    };
}
