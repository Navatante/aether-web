// src/shared/hooks/useConfirmationDialog.ts
import * as React from "react";

export type ConfirmationTarget = {
    id: number;
    name: string;
    isActive: boolean;
};

type DialogState = {
    isOpen: boolean;
    target: ConfirmationTarget | null;
    confirmation: string;
};

type UseConfirmationDialogReturn = {
    /** Abre el diálogo */
    open: (target: ConfirmationTarget) => void;
    /** Cierra el diálogo (útil para cancelar) */
    close: () => void;
    /** Actualiza el texto de confirmación */
    setConfirmation: (text: string) => void;
    /** Estado completo (para pasar al AlertDialog) */
    dialog: DialogState;
    /** Texto requerido para confirmar (dardebajapersona123) */
    requiredText: string;
};

export function useConfirmationDialog(): UseConfirmationDialogReturn {
    const [dialog, setDialog] = React.useState<DialogState>({
        isOpen: false,
        target: null,
        confirmation: "",
    });

    const open = (target: ConfirmationTarget) => {
        setDialog({
            isOpen: true,
            target,
            confirmation: "",
        });
    };

    const close = () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
        // Limpiamos después de la animación (300 ms)
        setTimeout(() => setDialog({ isOpen: false, target: null, confirmation: "" }), 300);
    };

    const setConfirmation = (text: string) => {
        setDialog((prev) => ({ ...prev, confirmation: text }));
    };

    // Texto que el usuario debe escribir
    const requiredText = (() => {
        if (!dialog.target) return "";
        const prefix = dialog.target.isActive ? "dardebajapersona" : "dardealtapersona";
        return `${prefix}${dialog.target.id}`;
    })();

    return {
        open,
        close,
        setConfirmation,
        dialog,
        requiredText,
    };
}
