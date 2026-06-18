// Diálogo de autoservicio para cambiar la propia contraseña. Se abre desde el
// "Panel de Tripulante" de la Topbar.

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useChangePassword } from "../hooks/useChangePassword";
import { ChangePasswordForm } from "./ChangePasswordForm";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
    const form = useChangePassword(() => onOpenChange(false));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Cambiar contraseña</DialogTitle>
                    <DialogDescription>
                        Introduce tu contraseña actual y elige una nueva.
                    </DialogDescription>
                </DialogHeader>
                <ChangePasswordForm form={form} onCancel={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}
