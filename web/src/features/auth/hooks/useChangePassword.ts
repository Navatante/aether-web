// Lógica del cambio de contraseña del propio usuario de sesión.
// (Componentes = solo render: el formulario consume este hook.)
//
// La política se espeja del backend (auth.ValidatePassword): mínimo 8
// caracteres y distinta de la contraseña por defecto. El backend es la
// garantía real; esta validación es solo UX. Tras un cambio con éxito se
// refresca la sesión (refreshUser) para limpiar el flag mustChangePassword.

import { useState } from "react";
import { useApiMutation } from "@/lib/apiQuery";
import { useUser } from "@/providers";

const MIN_LENGTH = 8;
const DEFAULT_PASSWORD = "aether";

export function useChangePassword(onDone?: () => void) {
    const { refreshUser } = useUser();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const mutation = useApiMutation<void, { currentPassword: string; newPassword: string }>(
        "POST",
        "/auth/change-password",
        {
            successMessage: "Contraseña actualizada",
            onSuccess: async () => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setLocalError(null);
                await refreshUser();
                onDone?.();
            },
        },
    );

    const validate = (): string | null => {
        if (!currentPassword) return "Introduce tu contraseña actual";
        if (newPassword.length < MIN_LENGTH)
            return `La nueva contraseña debe tener al menos ${MIN_LENGTH} caracteres`;
        if (newPassword === DEFAULT_PASSWORD)
            return "La nueva contraseña no puede ser la contraseña por defecto";
        if (newPassword !== confirmPassword) return "Las contraseñas no coinciden";
        return null;
    };

    const submit = () => {
        const err = validate();
        if (err) {
            setLocalError(err);
            return;
        }
        setLocalError(null);
        mutation.mutate({ currentPassword, newPassword });
    };

    return {
        currentPassword,
        setCurrentPassword,
        newPassword,
        setNewPassword,
        confirmPassword,
        setConfirmPassword,
        submit,
        submitting: mutation.isPending,
        errorMsg: localError,
    };
}
