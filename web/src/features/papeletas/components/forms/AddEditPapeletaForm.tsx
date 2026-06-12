"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import Select from "react-select";
import { getSelectClassNames, menuPortalStyles } from "@/lib/reactSelectClassNames";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Esquema y tipos
import {
    createPapeletaSchema,
    type PapeletaFormValues
} from "./schema";
import { usePapeletaBloquesLookup, usePapeletaPlanesLookup } from "@/shared/hooks";

interface AddEditPapeletaFormProps {
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultValues?: Partial<PapeletaFormValues>;
    onSubmit: (data: PapeletaFormValues) => void;
    title?: string;
    description?: string;
}

export function AddEditPapeletaForm({
                                        trigger,
                                        open: controlledOpen,
                                        onOpenChange,
                                        defaultValues,
                                        onSubmit,
                                        title = "Añadir Papeleta",
                                        description = "Complete todos los campos para añadir una nueva papeleta.",
                                    }: AddEditPapeletaFormProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    const open = controlledOpen ?? isOpen;
    const setOpen = onOpenChange ?? setIsOpen;

    // Usar hooks de lookup para obtener datos
    const { data: bloques, loading: bloquesLoading } = usePapeletaBloquesLookup();
    const { data: planes, loading: planesLoading } = usePapeletaPlanesLookup();

    const isLoadingData = bloquesLoading || planesLoading;

    // Estados separados para los campos numéricos para controlar su visualización
    const [tvValue, setTvValue] = React.useState<string>("");
    const [pilotCrpValue, setPilotCrpValue] = React.useState<string>("");
    const [dvCrpValue, setDvCrpValue] = React.useState<string>("");
    const [expirationValue, setExpirationValue] = React.useState<string>("");

    // Crear esquema dinámico con los datos cargados
    const papeletaSchema = (() => {
        if (isLoadingData || bloques.length === 0) return null;
        return createPapeletaSchema(bloques, planes);
    })();

    // Procesar defaultValues para manejar correctamente los valores numéricos
    const processedDefaultValues = (() => {
        if (!defaultValues) {
            return {
                papeleta_name: "",
                papeleta_description: "",
                papeleta_block: "",
                papeleta_plan: null,
                papeleta_tv: null,
                papeleta_pilot_crp_value: null,
                papeleta_dv_crp_value: null,
                papeleta_expiration: null,
            };
        }

        return {
            papeleta_name: defaultValues.papeleta_name || "",
            papeleta_description: defaultValues.papeleta_description || "",
            papeleta_block: defaultValues.papeleta_block || "",
            papeleta_plan: defaultValues.papeleta_plan || null,
            // Convertir 0 a null para los campos numéricos
            papeleta_tv: (defaultValues.papeleta_tv === 0 || defaultValues.papeleta_tv === undefined) ? null : defaultValues.papeleta_tv,
            papeleta_pilot_crp_value: (defaultValues.papeleta_pilot_crp_value === 0 || defaultValues.papeleta_pilot_crp_value === undefined) ? null : defaultValues.papeleta_pilot_crp_value,
            papeleta_dv_crp_value: (defaultValues.papeleta_dv_crp_value === 0 || defaultValues.papeleta_dv_crp_value === undefined) ? null : defaultValues.papeleta_dv_crp_value,
            papeleta_expiration: (defaultValues.papeleta_expiration === 0 || defaultValues.papeleta_expiration === undefined) ? null : defaultValues.papeleta_expiration,
        };
    })();

    const {
        register,
        handleSubmit,
        control,
        setValue,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<PapeletaFormValues>({
        // Use type assertion to handle the dynamic schema
        resolver: papeletaSchema ? (zodResolver(papeletaSchema) as any) : undefined,
        defaultValues: processedDefaultValues,
    });

    // Resetear cuando se abre el dialog y sincronizar los valores de los campos numéricos
    React.useEffect(() => {
        if (!open || isLoadingData) return;

        reset(processedDefaultValues);

        // Sincronizar los valores de los campos numéricos
        // Solo mostrar el valor si no es null y no es 0
        const tv = processedDefaultValues.papeleta_tv;
        const pilot_crp = processedDefaultValues.papeleta_pilot_crp_value;
        const dv_crp = processedDefaultValues.papeleta_dv_crp_value;
        const exp = processedDefaultValues.papeleta_expiration;

        setTvValue(tv != null && tv !== 0 ? String(tv) : "");
        setPilotCrpValue(pilot_crp != null && pilot_crp !== 0 ? String(pilot_crp) : "");
        setDvCrpValue(dv_crp != null && dv_crp !== 0 ? String(dv_crp) : "");
        setExpirationValue(exp != null && exp !== 0 ? String(exp) : "");
    }, [open, isLoadingData, processedDefaultValues, reset]);

    const handleFormSubmit = (data: PapeletaFormValues) => {
        onSubmit(data);
        setOpen(false);
        // Limpiar los valores de los campos numéricos
        setTvValue("");
        setPilotCrpValue("");
        setDvCrpValue("");
        setExpirationValue("");
    };

    return (
        <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
            {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="sm:max-w-3xl max-h-[90vh] w-full flex flex-col p-0 overflow-hidden"
                showCloseButton={false}
            >
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
                    <DialogTitle>{title || "Cargando formulario"}</DialogTitle>
                    <DialogDescription>
                        {isLoadingData ? "Por favor espere..." : description}
                    </DialogDescription>
                </DialogHeader>

                {isLoadingData ? (
                    <div className="flex items-center justify-center h-64 flex-1">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(handleFormSubmit)}
                          className="flex-1 overflow-y-auto flex flex-col min-h-0">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-4">
                            {/* Nombre */}
                            <div className="space-y-1">
                                <Label htmlFor="nombre">Nombre</Label>
                                <Input
                                    id="nombre"
                                    {...register("papeleta_name")}
                                    className={cn(errors.papeleta_name && "border-destructive")}
                                />
                                {errors.papeleta_name && (
                                    <p className="text-sm text-destructive">{errors.papeleta_name.message}</p>
                                )}
                            </div>

                            {/* Descripcion */}
                            <div className="space-y-1">
                                <Label htmlFor="descripcion">Descripción</Label>
                                <Input
                                    id="descripcion"
                                    {...register("papeleta_description")}
                                    className="overflow-x-auto"
                                />
                                {errors.papeleta_description && (
                                    <p className="text-sm text-destructive">{errors.papeleta_description.message}</p>
                                )}
                            </div>

                            {/* Plan - Dinámico desde hook */}
                            <div className="space-y-1">
                                <Label>Plan</Label>
                                <Controller
                                    name="papeleta_plan"
                                    control={control}
                                    render={({ field: { onChange, value, ...field } }) => {
                                        const planOptions = planes.map(p => ({ value: p, label: p }));
                                        const selected = planOptions.find(o => o.value === value) || null;
                                        return (
                                            <Select
                                                {...field}
                                                value={selected}
                                                onChange={(opt) => onChange(opt?.value ?? null)}
                                                options={planOptions}
                                                placeholder="Seleccionar"
                                                isSearchable={true}
                                                classNames={getSelectClassNames(!!errors.papeleta_plan, !!selected)}
                                                classNamePrefix="react-select"
                                                menuPortalTarget={document.body}
                                                styles={menuPortalStyles}
                                            />
                                        );
                                    }}
                                />
                                {errors.papeleta_plan && (
                                    <p className="text-sm text-destructive">{errors.papeleta_plan.message}</p>
                                )}
                            </div>

                            {/* Bloque - Dinámico desde hook */}
                            <div className="space-y-1">
                                <Label>Bloque</Label>
                                <Controller
                                    name="papeleta_block"
                                    control={control}
                                    render={({ field: { onChange, value, ...field } }) => {
                                        const bloqueOptions = bloques.map(b => ({ value: b, label: b }));
                                        const selected = bloqueOptions.find(o => o.value === value) || null;
                                        return (
                                            <Select
                                                {...field}
                                                value={selected}
                                                onChange={(opt) => onChange(opt?.value ?? '')}
                                                options={bloqueOptions}
                                                placeholder="Seleccionar"
                                                isSearchable={true}
                                                classNames={getSelectClassNames(!!errors.papeleta_block, !!selected)}
                                                classNamePrefix="react-select"
                                                menuPortalTarget={document.body}
                                                styles={menuPortalStyles}
                                            />
                                        );
                                    }}
                                />
                                {errors.papeleta_block && (
                                    <p className="text-sm text-destructive">{errors.papeleta_block.message}</p>
                                )}
                            </div>

                            {/* TV - NO usar register, controlar manualmente */}
                            <div className="space-y-1">
                                <Label htmlFor="tv">Tiempo de vuelo</Label>
                                <Input
                                    id="tv"
                                    type="number"
                                    value={tvValue}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setTvValue(val);
                                        if (val === "") {
                                            setValue("papeleta_tv", null);
                                        } else {
                                            const num = Number(val);
                                            if (!isNaN(num)) {
                                                setValue("papeleta_tv", num);
                                            }
                                        }
                                    }}
                                    className={cn(errors.papeleta_tv && "border-destructive")}
                                />
                                {errors.papeleta_tv && (
                                    <p className="text-sm text-destructive">{errors.papeleta_tv.message}</p>
                                )}
                            </div>

                            {/* CRP Piloto - NO usar register, controlar manualmente */}
                            <div className="space-y-1">
                                <Label htmlFor="pilot_crp">CRP Piloto</Label>
                                <Input
                                    id="pilot_crp"
                                    type="number"
                                    value={pilotCrpValue}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setPilotCrpValue(val);
                                        if (val === "") {
                                            setValue("papeleta_pilot_crp_value", null);
                                        } else {
                                            const num = Number(val);
                                            if (!isNaN(num)) {
                                                setValue("papeleta_pilot_crp_value", num);
                                            }
                                        }
                                    }}
                                    className={cn(errors.papeleta_pilot_crp_value && "border-destructive")}
                                />
                                {errors.papeleta_pilot_crp_value && (
                                    <p className="text-sm text-destructive">{errors.papeleta_pilot_crp_value.message}</p>
                                )}
                            </div>

                            {/* CRP Dv - NO usar register, controlar manualmente */}
                            <div className="space-y-1">
                                <Label htmlFor="dv_crp">CRP Dotación</Label>
                                <Input
                                    id="dv_crp"
                                    type="number"
                                    value={dvCrpValue}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setDvCrpValue(val);
                                        if (val === "") {
                                            setValue("papeleta_dv_crp_value", null);
                                        } else {
                                            const num = Number(val);
                                            if (!isNaN(num)) {
                                                setValue("papeleta_dv_crp_value", num);
                                            }
                                        }
                                    }}
                                    className={cn(errors.papeleta_dv_crp_value && "border-destructive")}
                                />
                                {errors.papeleta_dv_crp_value && (
                                    <p className="text-sm text-destructive">{errors.papeleta_dv_crp_value.message}</p>
                                )}
                            </div>

                            {/* Vigencia - NO usar register, controlar manualmente */}
                            <div className="space-y-1">
                                <Label htmlFor="vigencia">Vigencia</Label>
                                <Input
                                    id="vigencia"
                                    type="number"
                                    value={expirationValue}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setExpirationValue(val);
                                        if (val === "") {
                                            setValue("papeleta_expiration", null);
                                        } else {
                                            const num = Number(val);
                                            if (!isNaN(num)) {
                                                setValue("papeleta_expiration", num);
                                            }
                                        }
                                    }}
                                    className={cn(errors.papeleta_expiration && "border-destructive")}
                                />
                                {errors.papeleta_expiration && (
                                    <p className="text-sm text-destructive">{errors.papeleta_expiration.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-auto border-t bg-muted/50 px-6 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    reset();
                                    setOpen(false);
                                    // Limpiar los valores de los campos numéricos
                                    setTvValue("");
                                    setPilotCrpValue("");
                                    setExpirationValue("");
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Guardando..." : defaultValues ? "Guardar Cambios" : "Añadir Papeleta"}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
