// Modo edición de una ausencia existente.

import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
    type AbsenceReason,
    type Person,
    EMOJI_MOON,
    EMOJI_SUN,
    getReasonColor,
} from '../../../absences';
import { DatePicker } from "./DatePicker";
import { ReasonButton } from "./ReasonButton";

interface EditAbsenceModeProps {
    selectedPerson: Person;
    filteredReasons: [string, AbsenceReason][];
    editStartDate: Date | undefined;
    setEditStartDate: (date: Date | undefined) => void;
    editEndDate: Date | undefined;
    setEditEndDate: (date: Date | undefined) => void;
    editReason: string;
    setEditReason: (reason: string) => void;
    editRemark: string;
    setEditRemark: (remark: string) => void;
    isSubmitting: boolean;
    onCancel: () => void;
    onUpdate: () => void;
}

export function EditAbsenceMode({
    selectedPerson,
    filteredReasons,
    editStartDate,
    setEditStartDate,
    editEndDate,
    setEditEndDate,
    editReason,
    setEditReason,
    editRemark,
    setEditRemark,
    isSubmitting,
    onCancel,
    onUpdate,
}: EditAbsenceModeProps) {
    const reasonData = getReasonColor(editReason);
    const isVueloDia = editReason === 'Vuelo día';
    const isVueloNoche = editReason === 'Vuelo noche';

    return (
        <>
            <DialogHeader>
                <div className="flex items-center gap-3">
                    {isVueloDia ? (
                        <span className="text-base">{EMOJI_SUN}</span>
                    ) : isVueloNoche ? (
                        <span className="text-base">{EMOJI_MOON}</span>
                    ) : (
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: reasonData.color }}
                        />
                    )}
                    <div>
                        <DialogTitle>{selectedPerson.full_name}</DialogTitle>
                        <DialogDescription>Editando ausencia</DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="grid gap-4 py-4">
                {/* Fechas */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Fecha inicio</Label>
                        <DatePicker
                            date={editStartDate}
                            onSelect={setEditStartDate}
                            placeholder="Inicio"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Fecha fin</Label>
                        <DatePicker
                            date={editEndDate}
                            onSelect={setEditEndDate}
                            placeholder="Fin"
                        />
                    </div>
                </div>

                {/* Motivo */}
                <div className="grid gap-2">
                    <Label>Motivo</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {filteredReasons.map(([key, value]) => (
                            <ReasonButton
                                key={key}
                                reasonKey={key}
                                value={value}
                                isSelected={editReason === key}
                                onClick={() => setEditReason(key)}
                            />
                        ))}
                    </div>
                </div>

                {/* Observaciones */}
                <div className="grid gap-2">
                    <Label htmlFor="editRemark">Observaciones (opcional)</Label>
                    <Input
                        id="editRemark"
                        value={editRemark}
                        onChange={(e) => setEditRemark(e.target.value)}
                    />
                </div>
            </div>

            <DialogFooter>
                <Button
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    Cancelar
                </Button>
                <Button onClick={onUpdate} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar cambios
                </Button>
            </DialogFooter>
        </>
    );
}
