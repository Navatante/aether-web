// Modo alta de ausencia.

import {
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import Select from "react-select";
import { getSelectClassNames, menuPortalStyles } from "@/lib/reactSelectClassNames";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { type AbsenceReason, type NewAbsenceData, type Person } from '../../../absences';
import { DatePicker } from "./DatePicker";
import { ReasonButton } from "./ReasonButton";

interface CreateAbsenceModeProps {
    persons: Person[];
    personsLoading: boolean;
    filteredReasons: [string, AbsenceReason][];
    formData: NewAbsenceData;
    setFormData: (data: NewAbsenceData) => void;
    isSubmitting: boolean;
    onClose: () => void;
    onCreate: () => void;
}

export function CreateAbsenceMode({
    persons,
    personsLoading,
    filteredReasons,
    formData,
    setFormData,
    isSubmitting,
    onClose,
    onCreate,
}: CreateAbsenceModeProps) {
    const selectedPerson = persons.find(p => p.person_sk === formData.personId);

    return (
        <>
            <DialogHeader>
                <DialogTitle>Registrar Ausencia</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
                {/* Persona */}
                <div className="grid gap-2">
                    <Label htmlFor="person">Persona</Label>
                    <Select
                        inputId="person"
                        value={selectedPerson
                            ? { value: formData.personId as number, label: selectedPerson.full_name }
                            : null}
                        onChange={(opt) => setFormData({ ...formData, personId: opt?.value ?? '' })}
                        options={persons.map(p => ({ value: p.person_sk, label: p.full_name }))}
                        placeholder={personsLoading ? "Cargando personas..." : "Seleccionar persona..."}
                        isLoading={personsLoading}
                        isDisabled={personsLoading}
                        isSearchable={true}
                        classNames={getSelectClassNames(false, !!formData.personId)}
                        classNamePrefix="react-select"
                        menuPortalTarget={document.body}
                        styles={menuPortalStyles}
                    />
                </div>

                {/* Fechas */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="absence-start">Fecha inicio</Label>
                        <DatePicker
                            id="absence-start"
                            date={formData.startDate}
                            onSelect={(date) => setFormData({ ...formData, startDate: date })}
                            placeholder="Inicio"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="absence-end">Fecha fin</Label>
                        <DatePicker
                            id="absence-end"
                            date={formData.endDate}
                            onSelect={(date) => setFormData({ ...formData, endDate: date })}
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
                                isSelected={formData.reason === key}
                                onClick={() => setFormData({ ...formData, reason: key })}
                            />
                        ))}
                    </div>
                </div>

                {/* Observaciones */}
                <div className="grid gap-2">
                    <Label htmlFor="remark">Observaciones (opcional)</Label>
                    <Input
                        id="remark"
                        placeholder="Añadir observaciones..."
                        value={formData.remark || ''}
                        onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                    />
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                    Cancelar
                </Button>
                <Button
                    onClick={onCreate}
                    disabled={isSubmitting || !formData.personId || !formData.startDate || !formData.endDate}
                >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar ausencia
                </Button>
            </DialogFooter>
        </>
    );
}
