"use client";

// Alta/edición de persona: composición solo-render. La lógica (lookups,
// esquema dinámico, react-hook-form, reset al abrir) vive en usePersonForm y
// el andamiaje de campo en shared/components/forms/FormFields.

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { TextField, SelectField, DateField } from "@/shared/components/forms/FormFields";
import { type PersonFormValues, CUERPOS } from "./schema";
import { usePersonForm } from "../../hooks/usePersonForm";

interface AddEditPersonFormProps {
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultValues?: Partial<PersonFormValues>;
    onSubmit: (data: PersonFormValues) => void;
    title?: string;
    description?: string;
}

export function AddEditPersonForm({
                                      trigger,
                                      open: controlledOpen,
                                      onOpenChange,
                                      defaultValues,
                                      onSubmit,
                                      title = "Añadir Persona",
                                      description = "Complete todos los campos para añadir una nueva persona.",
                                  }: AddEditPersonFormProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    const open = controlledOpen ?? isOpen;
    const setOpen = onOpenChange ?? setIsOpen;

    const {
        register,
        handleSubmit,
        control,
        setValue,
        reset,
        errors,
        isSubmitting,
        isLoadingData,
        catalogs,
        dates,
    } = usePersonForm(open, defaultValues);

    const handleFormSubmit = (data: PersonFormValues) => {
        onSubmit(data);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
            {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="sm:max-w-4xl max-h-[90vh] w-full flex flex-col p-0 overflow-hidden"
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
                            <TextField id="nk" label="Código" error={errors.person_nk?.message} {...register("person_nk")} />
                            <TextField id="user" label="Usuario" error={errors.person_user?.message} {...register("person_user")} />
                            <SelectField label="Cuerpo" name="person_cuerpo" control={control}
                                         options={CUERPOS} error={errors.person_cuerpo?.message} />
                            <SelectField label="Especialidad" name="person_especialidad" control={control}
                                         options={catalogs.especialidades} error={errors.person_especialidad?.message} />
                            <SelectField label="Empleo" name="person_rank" control={control}
                                         options={catalogs.empleos} error={errors.person_rank?.message} />
                            <TextField id="name" label="Nombre" error={errors.person_name?.message} {...register("person_name")} />
                            <TextField id="last1" label="Primer Apellido" error={errors.person_last_name_1?.message} {...register("person_last_name_1")} />
                            <TextField id="last2" label="Segundo Apellido" error={errors.person_last_name_2?.message} {...register("person_last_name_2")} />
                            <TextField id="phone" label="Teléfono" error={errors.person_phone?.message} {...register("person_phone")} />
                            <TextField id="dni" label="DNI" error={errors.person_dni?.message} {...register("person_dni")} />
                            <SelectField label="Localidad" name="person_localidad" control={control}
                                         options={catalogs.localidades} error={errors.person_localidad?.message} />
                            <SelectField label="División" name="person_division" control={control}
                                         options={catalogs.divisiones} error={errors.person_division?.message} />
                            <SelectField label="Rol" name="person_rol" control={control}
                                         options={catalogs.roles} error={errors.person_rol?.message} />
                            <DateField label="Antiguedad empleo" value={dates.aEmp}
                                       onSelect={(date) => setValue("person_a_emp", date)}
                                       error={errors.person_a_emp?.message} />
                            <DateField label="Fecha Embarque" value={dates.fEmb}
                                       onSelect={(date) => setValue("person_f_emb", date)}
                                       error={errors.person_f_emb?.message} />
                            <DateField label="Fecha Nacimiento" value={dates.birthdate}
                                       onSelect={(date) => setValue("person_birthdate", date)}
                                       error={errors.person_birthdate?.message} errorBorder />
                            <TextField id="escalafon" label="Nº Escalafón" type="number" placeholder="12345"
                                       error={errors.person_num_escalafon?.message}
                                       {...register("person_num_escalafon", { valueAsNumber: true })} />
                        </div>

                        <div className="mt-auto border-t bg-muted/50 px-6 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => { reset(); setOpen(false); }}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Guardando..." : defaultValues ? "Guardar Cambios" : "Añadir Persona"}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
