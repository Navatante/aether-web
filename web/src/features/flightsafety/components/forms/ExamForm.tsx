// Formulario de alta/programación/registro de un reconocimiento (solo render).
// La lógica vive en hooks/useRegisterExam.

import Select from 'react-select';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select as TypeSelect,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DatePicker, formatDateDisplay } from '@/shared/components/common';
import { getSelectClassNames, menuPortalStyles } from '@/lib/reactSelectClassNames';
import { useRegisterExam, type ExamDialogInitial, type ExamPhase, type BoolResult, type ExamMode } from '../../hooks/useRegisterExam';
import type { ExamType } from '../../flightsafety';

interface ExamFormProps {
    type: ExamType;
    mode: ExamMode;
    initial?: ExamDialogInitial;
    initialPersonSk?: number;
    onClose: () => void;
    onSuccess?: () => void;
}

interface Option {
    value: number;
    label: string;
}

export default function ExamForm(props: ExamFormProps) {
    const {
        cfg, isMedical, mode, isComplete,
        personSk, setPersonSk, phase, setPhase,
        scheduledDate, setScheduledDate, date, setDate, expiry, setExpiry,
        placeFk, setPlaceFk, resultFk, setResultFk, boolResult, setBoolResult,
        remark, setRemark, error, isSubmitting, canSubmit,
        persons, personsLoading, places, placesLoading, results, resultsLoading,
        addingPlace, setAddingPlace, newPlaceName, setNewPlaceName,
        creatingPlace, handleCreatePlace,
        handleSubmit,
    } = useRegisterExam(props);

    const personOptions: Option[] = persons.map((p) => ({ value: p.person_sk, label: p.full_name }));
    const placeOptions: Option[] = places.map((p) => ({ value: p.medical_exam_place_sk, label: p.medical_exam_place }));
    const resultOptions: Option[] = results.map((r) => ({ value: r.medical_exam_result_sk, label: r.medical_exam_result }));
    const find = (opts: Option[], v: number | null) => opts.find((o) => o.value === v) ?? null;

    return (
        <div className="space-y-6">
            {/* Contexto de la cita al registrar el resultado */}
            {isComplete && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    Registrando el resultado de la cita{props.initial?.date ? ` del ${formatDateDisplay(props.initial.date)}` : ''}.
                    La fecha, la caducidad{isMedical ? ' y el lugar' : ''} se toman de la cita.
                </div>
            )}

            {/* Persona (solo al crear) */}
            {mode === 'create' && (
                <div className="grid gap-2">
                    <Label className="text-foreground">Persona</Label>
                    <Select
                        value={find(personOptions, personSk)}
                        onChange={(opt) => setPersonSk(opt ? opt.value : null)}
                        options={personOptions}
                        placeholder={personsLoading ? 'Cargando...' : 'Seleccionar persona'}
                        isLoading={personsLoading}
                        isDisabled={personsLoading}
                        isSearchable
                        classNames={getSelectClassNames(false, personSk != null)}
                        classNamePrefix="react-select"
                        menuPortalTarget={document.body}
                        styles={menuPortalStyles}
                        noOptionsMessage={() => 'Sin personas'}
                    />
                </div>
            )}

            {/* Fase del ciclo de vida (no en 'complete': la cita ya está programada) */}
            {!isComplete && (
                <div className="grid gap-2">
                    <Label className="text-foreground">Estado</Label>
                    <TypeSelect value={phase} onValueChange={(v) => v && setPhase(v as ExamPhase)}>
                        <SelectTrigger className="w-full bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="programado">Programar cita (renovación futura)</SelectItem>
                            <SelectItem value="realizado">Registrar realizado (con resultado)</SelectItem>
                        </SelectContent>
                    </TypeSelect>
                </div>
            )}

            {phase === 'programado' ? (
                <div className="grid gap-2">
                    <Label className="text-foreground">Día asignado para la cita</Label>
                    <DatePicker value={scheduledDate} onChange={setScheduledDate} placeholder="Seleccionar" />
                </div>
            ) : (
                <>
                    {/* Fecha + caducidad: ocultas en 'complete' (se toman de la cita) */}
                    {!isComplete && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-foreground">Fecha de realización</Label>
                                <DatePicker value={date} onChange={setDate} placeholder="Seleccionar" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-foreground">Caducidad (auto, editable)</Label>
                                <DatePicker value={expiry} onChange={setExpiry} placeholder="Seleccionar" />
                            </div>
                        </div>
                    )}

                    {/* Resultado */}
                    {isMedical ? (
                        <div className="grid gap-2">
                            <Label className="text-foreground">Resultado</Label>
                            <Select
                                value={find(resultOptions, resultFk)}
                                onChange={(opt) => setResultFk(opt ? opt.value : null)}
                                options={resultOptions}
                                placeholder={resultsLoading ? 'Cargando...' : 'Seleccionar resultado'}
                                isLoading={resultsLoading}
                                isDisabled={resultsLoading}
                                classNames={getSelectClassNames(false, resultFk != null)}
                                classNamePrefix="react-select"
                                menuPortalTarget={document.body}
                                styles={menuPortalStyles}
                                noOptionsMessage={() => 'Sin resultados'}
                            />
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            <Label className="text-foreground">Resultado</Label>
                            <TypeSelect value={boolResult} onValueChange={(v) => v && setBoolResult(v as BoolResult)}>
                                <SelectTrigger className="w-full bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="apto">Apto</SelectItem>
                                    <SelectItem value="no_apto">No apto</SelectItem>
                                    <SelectItem value="na">No presentado / N/A</SelectItem>
                                </SelectContent>
                            </TypeSelect>
                        </div>
                    )}
                </>
            )}

            {/* Lugar (solo médico). En 'complete' se hereda de la cita; solo se
                pide si la cita no tenía lugar. */}
            {isMedical && (!isComplete || placeFk == null) && (
                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-foreground">Lugar {phase === 'programado' && <span className="text-muted-foreground">(opcional)</span>}</Label>
                        {!addingPlace && (
                            <Button type="button" variant="ghost" size="sm"
                                className="h-7 px-2 text-xs text-primary hover:text-primary"
                                onClick={() => setAddingPlace(true)}>
                                <Plus className="w-3.5 h-3.5 mr-1" />Nuevo lugar
                            </Button>
                        )}
                    </div>
                    {addingPlace ? (
                        <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                            <div className="grid gap-1.5">
                                <Label htmlFor="place_name">Nombre del lugar</Label>
                                <Input id="place_name" placeholder="CIMA"
                                    value={newPlaceName} onChange={(e) => setNewPlaceName(e.target.value)}
                                    maxLength={20} className="bg-background" />
                            </div>
                            <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                                <Button type="button" variant="outline" size="sm"
                                    onClick={() => { setAddingPlace(false); setNewPlaceName(''); }} disabled={creatingPlace}>Cancelar</Button>
                                <Button type="button" size="sm" onClick={handleCreatePlace} disabled={creatingPlace}>
                                    {creatingPlace && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar lugar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Select
                            value={find(placeOptions, placeFk)}
                            onChange={(opt) => setPlaceFk(opt ? opt.value : null)}
                            options={placeOptions}
                            placeholder={placesLoading ? 'Cargando...' : 'Seleccionar lugar'}
                            isLoading={placesLoading}
                            isDisabled={placesLoading}
                            isClearable
                            classNames={getSelectClassNames(false, placeFk != null)}
                            classNamePrefix="react-select"
                            menuPortalTarget={document.body}
                            styles={menuPortalStyles}
                            noOptionsMessage={() => 'Sin lugares'}
                        />
                    )}
                </div>
            )}

            {/* Observaciones (solo médico) */}
            {isMedical && (
                <div className="grid gap-2">
                    <Label className="text-foreground">Observaciones</Label>
                    <Input value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={200} placeholder="Opcional" />
                </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={props.onClose} disabled={isSubmitting}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={!canSubmit || addingPlace}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isComplete ? 'Registrar resultado' : `Guardar ${cfg.short.toLowerCase()}`}
                </Button>
            </div>
        </div>
    );
}
