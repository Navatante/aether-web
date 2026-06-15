import { useForm } from 'react-hook-form';
import { useLogger } from '@/lib/logger';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRecentComisiones, usePersonsForComision, type PersonForComisionLookup } from "@/shared/hooks";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
    PersonToComisionFormValues,
    personToComisionFormSchema,
} from "./PersonToComisionSchema"
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatearFecha } from "@/lib/utils"
import { useApiMutation } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useEscuadrilla } from "@/providers";

interface RegisterPersonToComisionFormProps {
    onClose: () => void;
}

export default function RegisterPersonToComisionForm({ onClose }: RegisterPersonToComisionFormProps) {
    const log = useLogger('RegisterPersonToComisionForm');
    const navigate = useNavigate();
    const { id: escId } = useEscuadrilla();

    const {
        data: comisionesArray,
        loading: comisionesLoading,
        error: comisionesError
    } = useRecentComisiones();

    const {
        data: personArray,
        loading: personLoading,
        error: personQueryError,
    } = usePersonsForComision();

    const {
        handleSubmit,
        setValue,
        watch,
        formState: { errors, isSubmitting }
    } = useForm<PersonToComisionFormValues>({
        resolver: zodResolver(personToComisionFormSchema),
        defaultValues: {
            comision: '',
            personas: [],
        }
    });

    const selectedPersonas = watch('personas') ?? [];
    const selectedComision = watch('comision');

    const getPersonFullName = (person: PersonForComisionLookup): string => {
        return [
            person.person_rank,
            person.person_name,
            person.person_last_name_1,
            person.person_last_name_2
        ]
            .map(part => part?.trim())
            .filter(Boolean)
            .join(' ');
    };

    const handleAddPerson = (personSk: string) => {
        if (!selectedPersonas.includes(personSk)) {
            setValue('personas', [...selectedPersonas, personSk], { shouldValidate: true });
        }
    };

    const handleRemovePerson = (personSk: string) => {
        setValue(
            'personas',
            selectedPersonas.filter(p => p !== personSk),
            { shouldValidate: true }
        );
    };

    const availablePersons = personArray?.filter(
        person => !selectedPersonas.includes(person.person_sk.toString())
    ) ?? [];

    const getPersonBySk = (personSk: string): PersonForComisionLookup | undefined => {
        return personArray?.find(person => person.person_sk.toString() === personSk);
    };

    // POST /comisiones/:id/people. Devuelve { success, message } en el body, así
    // que el toast de éxito se decide según result.success. El toast de error de
    // useApiMutation cubre los fallos HTTP; la lista se refresca al navegar.
    const registerPeople = useApiMutation<
        { comision_id: number; success: boolean; message: string; personas_insertadas: number },
        { comision: string; personas: string[] }
    >('POST', (v) => `/comisiones/${v.comision}/people`, {
        invalidateKeys: [queryKeys.comisiones.all(escId ?? 0)],
        body: ({ comision, ...rest }) => rest,
    });

    const onSubmit = async (data: PersonToComisionFormValues) => {
        try {
            const result = await registerPeople.mutateAsync({ comision: data.comision, personas: data.personas });

            if (result.success) {
                toast.success(result.message);
                onClose();
                navigate('/comisiones');
            } else {
                toast.error('Error al guardar las personas en la comisión');
            }
        } catch (error) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error al guardar al personal en la comisión: ${error}`);
        }
    };

    return (
        <div className="space-y-6 p-6 bg-background">
            {/* Select Comision */}
            <div className="space-y-2">
                <Label htmlFor="comision" className="text-foreground">Comisión</Label>
                <Select
                    value={selectedComision}
                    onValueChange={(value) => { if (value) setValue('comision', value, { shouldValidate: true }) }}
                >
                    <SelectTrigger
                        id="comision"
                        className={errors.comision ? 'border-danger' : ''}
                    >
                        <SelectValue placeholder={comisionesLoading ? "Cargando..." : "Seleccione una comisión"} />
                    </SelectTrigger>
                    <SelectContent>
                        {comisionesError ? (
                            <SelectItem value="error" disabled>Error al cargar comisiones</SelectItem>
                        ) : comisionesArray && comisionesArray.length > 0 ? (
                            comisionesArray.map((comision) => (
                                <SelectItem
                                    key={comision.comision_sk}
                                    value={comision.comision_sk.toString()}
                                >
                                    {`${comision.lugar} - ${comision.tipo} - ${formatearFecha(comision.fechaInicio)} al ${formatearFecha(comision.fechaFin)} - ${comision.esfuerzo ? '(Con esfuerzo)' : '(Sin esfuerzo)'}`}
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="empty" disabled>No hay comisiones disponibles</SelectItem>
                        )}
                    </SelectContent>
                </Select>
                {errors.comision && (
                    <p className="text-sm text-danger">{errors.comision.message}</p>
                )}
            </div>

            {/* Multi-Select Personas */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-foreground">Personas</Label>
                    <span className="text-xs text-muted-foreground">
                        {selectedPersonas.length} seleccionada(s)
                    </span>
                </div>

                {selectedPersonas.length > 0 && (
                    <div
                        className={`flex flex-col gap-2 p-3 border rounded-md bg-muted/50 max-h-48 overflow-y-auto ${
                            errors.personas ? 'border-danger' : 'border-border'
                        }`}
                    >
                        {selectedPersonas.map((personSk) => {
                            const person = getPersonBySk(personSk);
                            if (!person) return null;

                            return (
                                <Badge
                                    key={personSk}
                                    variant="secondary"
                                    className="flex items-center justify-between px-2 py-1 w-full"
                                >
                                    <span className="text-xs truncate">{getPersonFullName(person)}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePerson(personSk)}
                                        className="ml-2 hover:bg-destructive/20 rounded-full p-0.5 flex-shrink-0"
                                        aria-label={`Remover ${getPersonFullName(person)}`}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            );
                        })}
                    </div>
                )}

                <Select
                    value=""
                    onValueChange={(value) => {
                        if (value && value !== "empty" && value !== "error") {
                            handleAddPerson(value);
                        }
                    }}
                    disabled={personLoading || availablePersons.length === 0}
                >
                    <SelectTrigger className={errors.personas ? 'border-danger' : ''}>
                        <SelectValue placeholder={
                            personLoading
                                ? "Cargando personas..."
                                : availablePersons.length === 0
                                    ? "Todas las personas están seleccionadas"
                                    : "Agregar persona..."
                        } />
                    </SelectTrigger>
                    <SelectContent>
                        {personQueryError ? (
                            <SelectItem value="error" disabled>Error al cargar personas</SelectItem>
                        ) : availablePersons.length > 0 ? (
                            availablePersons.map((person) => (
                                <SelectItem
                                    key={person.person_sk}
                                    value={person.person_sk.toString()}
                                >
                                    {getPersonFullName(person)}
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="empty" disabled>
                                No hay personas disponibles
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>

                {errors.personas && (
                    <p className="text-sm text-danger">{errors.personas.message}</p>
                )}
            </div>

            {/* Botón Guardar */}
            <div className="pt-4">
                <Button
                    onClick={handleSubmit(onSubmit)}
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting || selectedPersonas.length === 0}
                >
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                </Button>
            </div>
        </div>
    );
}