// Pantalla a página completa que fuerza el cambio de contraseña en el primer
// login (cuenta con la contraseña por defecto). No tiene navegación ni escape:
// se renderiza en lugar del contenido de la app mientras mustChangePassword sea
// true. Al cambiarla con éxito, refreshUser limpia el flag y la app vuelve.

import { ShieldAlert } from "lucide-react";
import { useChangePassword } from "./hooks/useChangePassword";
import { ChangePasswordForm } from "./components/ChangePasswordForm";

export function ForcedPasswordChange() {
    const form = useChangePassword();

    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
            <div className="w-full max-w-sm space-y-8 duration-500 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-warning-muted text-warning">
                        <ShieldAlert className="size-6" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">Cambia tu contraseña</h1>
                        <p className="text-sm text-muted-foreground">
                            Por seguridad debes establecer una contraseña propia antes de continuar.
                        </p>
                    </div>
                </div>
                <ChangePasswordForm form={form} forced />
            </div>
        </main>
    );
}
