// Botón de la topbar (solo Superusuario) que abre el panel god-mode:
// cambiar nivel de permiso y resetear contraseña de cualquier persona.

import { useState } from "react";
import { ShieldUser } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSuperuser } from "../hooks/useSuperuser";
import { ASSIGNABLE_LEVELS } from "../superuser";

export function SuperuserButton() {
    const [open, setOpen] = useState(false);
    const su = useSuperuser(open);

    return (
        <>
            <Button
                variant="outline"
                size="icon"
                title="Panel de Superusuario"
                onClick={() => setOpen(true)}
            >
                <ShieldUser className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Panel de Superusuario</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Panel de Superusuario</DialogTitle>
                        <DialogDescription>
                            Gestión de credenciales y permisos de tu escuadrilla.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-2">
                        {/* Selección de persona */}
                        <div className="space-y-2">
                            <Label>Persona</Label>
                            <Select
                                value={su.selectedId != null ? String(su.selectedId) : null}
                                onValueChange={(v) => su.setSelectedId(v != null ? Number(v) : null)}
                            >
                                <SelectTrigger className="w-full">
                                    {/* El value interno es el sk (para la consulta), pero en el
                                        trigger mostramos empleo + apellidos de la persona elegida. */}
                                    <SelectValue>
                                        {(value) => {
                                            if (value == null)
                                                return su.isLoading ? "Cargando…" : "Selecciona una persona";
                                            const p = su.persons.find((x) => String(x.id) === String(value));
                                            return p ? `${p.nombreCompleto} (${p.usuario})` : "Selecciona una persona";
                                        }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {su.persons.map((p) => (
                                        <SelectItem key={p.id} value={String(p.id)}>
                                            {p.nombreCompleto} ({p.usuario})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {su.selected && (
                                <p className="text-sm text-muted-foreground">
                                    Nivel actual: <span className="text-foreground">{su.selected.permissionLevel}</span>
                                    {" · "}
                                    {su.selected.tienePassword ? "Con contraseña" : "Sin contraseña"}
                                </p>
                            )}
                        </div>

                        {/* Nivel de permiso */}
                        <div className="space-y-2">
                            <Label>Nivel de permiso</Label>
                            <div className="flex gap-2">
                                <Select
                                    value={su.level || null}
                                    onValueChange={(v) => su.setLevel(v ?? "")}
                                    disabled={!su.selected}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecciona un nivel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ASSIGNABLE_LEVELS.map((lvl) => (
                                            <SelectItem key={lvl} value={lvl}>
                                                {lvl}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={su.submitLevel}
                                    disabled={!su.levelChanged || su.savingLevel}
                                >
                                    Guardar
                                </Button>
                            </div>
                        </div>

                        {/* Contraseña: reseteo al valor por defecto */}
                        <div className="space-y-2">
                            <Label>Contraseña</Label>
                            <AlertDialog>
                                <AlertDialogTrigger render={
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        disabled={!su.selected || su.savingPassword}
                                    >
                                        Resetear contraseña
                                    </Button>
                                } />
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Resetear la contraseña?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            La contraseña de{" "}
                                            <span className="text-foreground font-medium">
                                                {su.selected?.nombreCompleto}
                                            </span>{" "}
                                            quedará en{" "}
                                            <span className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-semibold">
                                                aether
                                            </span>{" "}
                                            y se le
                                            forzará el cambio en su próximo inicio de sesión.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={su.resetPassword}>
                                            Resetear
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
