// Formulario de cambio de contraseña (solo render). Recibe el estado del hook
// useChangePassword por props y se reutiliza en el diálogo de autoservicio y en
// la pantalla de cambio forzado.

import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import type { useChangePassword } from "../hooks/useChangePassword";

interface Props {
    form: ReturnType<typeof useChangePassword>;
    /** Modo forzado: sin botón de cancelar (no hay escapatoria). */
    forced?: boolean;
    onCancel?: () => void;
}

export function ChangePasswordForm({ form, forced = false, onCancel }: Props) {
    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        form.submit();
    };

    return (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
                <Label htmlFor="cp-current">Contraseña actual</Label>
                <Input
                    id="cp-current"
                    type="password"
                    autoComplete="current-password"
                    value={form.currentPassword}
                    onChange={(e) => form.setCurrentPassword(e.target.value)}
                    disabled={form.submitting}
                    autoFocus
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="cp-new">Nueva contraseña</Label>
                <Input
                    id="cp-new"
                    type="password"
                    autoComplete="new-password"
                    value={form.newPassword}
                    onChange={(e) => form.setNewPassword(e.target.value)}
                    disabled={form.submitting}
                />
                <p className="text-xs text-muted-foreground">
                    Mínimo 8 caracteres y distinta de la contraseña por defecto.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="cp-confirm">Repite la nueva contraseña</Label>
                <Input
                    id="cp-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => form.setConfirmPassword(e.target.value)}
                    disabled={form.submitting}
                />
            </div>

            {form.errorMsg && (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-muted px-3 py-2.5 text-sm text-danger-muted-foreground"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{form.errorMsg}</span>
                </div>
            )}

            <div className="flex gap-2">
                {!forced && (
                    <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={form.submitting}>
                        Cancelar
                    </Button>
                )}
                <Button type="submit" className="flex-1" disabled={form.submitting}>
                    {form.submitting && <Loader2 className="size-4 animate-spin" />}
                    {form.submitting ? "Guardando…" : "Cambiar contraseña"}
                </Button>
            </div>
        </form>
    );
}
