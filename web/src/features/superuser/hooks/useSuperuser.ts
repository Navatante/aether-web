// Lógica del panel de superusuario: lista global de personas + mutaciones
// para cambiar contraseña y nivel de permiso. (Componentes = solo render.)

import { useEffect, useMemo, useState } from "react";
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
    const persons = useMemo(() => personsQuery.data ?? [], [personsQuery.data]);

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected = persons.find((p) => p.id === selectedId) ?? null;

    const [password, setPassword] = useState("");
    const [level, setLevel] = useState("");

    // Al cambiar de persona: reinicia el formulario al estado actual de esa persona.
    useEffect(() => {
        setLevel(selected?.permissionLevel ?? "");
        setPassword("");
    }, [selectedId, selected?.permissionLevel]);

    const passwordMut = useApiMutation<void, { id: number; password: string }>(
        "PUT",
        (v) => `/superuser/persons/${v.id}/password`,
        {
            successMessage: "Contraseña actualizada",
            invalidateKeys: [personsKey],
            onSuccess: () => setPassword(""),
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

    const submitPassword = () => {
        if (selected && password) passwordMut.mutate({ id: selected.id, password });
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
        password,
        setPassword,
        level,
        setLevel,
        submitPassword,
        submitLevel,
        savingPassword: passwordMut.isPending,
        savingLevel: levelMut.isPending,
        levelChanged: !!selected && level !== "" && level !== selected.permissionLevel,
    };
}
