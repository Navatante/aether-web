"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import Select from "react-select";
import { getSelectClassNames, menuPortalStyles } from "@/lib/reactSelectClassNames";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
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
    createPersonSchema,
    type PersonFormValues,
    CUERPOS
} from "./schema";
import {
    usePersonEspecialidadesLookup,
    usePersonEmpleosLookup,
    usePersonDivisionesLookup,
    usePersonRolesLookup
} from "@/shared/hooks";

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

    // Usar hooks de lookup para obtener datos
    const { data: especialidades, loading: especialidadesLoading } = usePersonEspecialidadesLookup();
    const { data: empleos, loading: empleosLoading } = usePersonEmpleosLookup();
    const { data: divisiones, loading: divisionesLoading } = usePersonDivisionesLookup();
    const { data: roles, loading: rolesLoading } = usePersonRolesLookup();

    const isLoadingData = especialidadesLoading || empleosLoading || divisionesLoading || rolesLoading;

    // Crear esquema dinámico con los datos cargados
    const personSchema = (() => {
        if (isLoadingData || roles.length === 0) return null;
        return createPersonSchema(roles, empleos, especialidades, divisiones);
    })();

    const {
        register,
        handleSubmit,
        control,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<PersonFormValues>({
        resolver: personSchema ? zodResolver(personSchema) : undefined,
        defaultValues: {
            person_nk: "",
            person_user: "",
            person_rank: "",
            person_cuerpo: undefined,
            person_especialidad: "",
            person_name: "",
            person_last_name_1: "",
            person_last_name_2: "",
            person_phone: "",
            person_dni: "",
            person_division: "",
            person_rol: "",
            person_num_escalafon: 0,
            ...defaultValues,
        },
    });

    const EMPTY_VALUES = {
        person_nk: "",
        person_user: "",
        person_rank: "",
        person_cuerpo: undefined,
        person_especialidad: "",
        person_name: "",
        person_last_name_1: "",
        person_last_name_2: "",
        person_phone: "",
        person_dni: "",
        person_division: "",
        person_rol: "",
        person_num_escalafon: 0,
        person_a_emp: undefined,
        person_f_emb: undefined,
        person_birthdate: undefined,
    } as const;

    // Resetear cuando se abre el dialog
    React.useEffect(() => {
        if (!open || isLoadingData) return;
        reset(defaultValues ?? EMPTY_VALUES);
    }, [open, isLoadingData, defaultValues, reset]);

    const handleFormSubmit = (data: PersonFormValues) => {
        onSubmit(data);
        setOpen(false);
    };

    // Watch para fechas
    const aEmp = watch("person_a_emp");
    const fEmb = watch("person_f_emb");
    const birthdate = watch("person_birthdate");

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
                            {/* NK */}
                            <div className="space-y-1">
                                <Label htmlFor="nk">Código</Label>
                                <Input
                                    id="nk"
                                    {...register("person_nk")}
                                    className={cn(errors.person_nk && "border-destructive")}
                                />
                                {errors.person_nk && (
                                    <p className="text-sm text-destructive">{errors.person_nk.message}</p>
                                )}
                            </div>

                            {/* Usuario */}
                            <div className="space-y-1">
                                <Label htmlFor="user">Usuario</Label>
                                <Input
                                    id="user"
                                    {...register("person_user")}
                                />
                                {errors.person_user && (
                                    <p className="text-sm text-destructive">{errors.person_user.message}</p>
                                )}
                            </div>

                            {/* Cuerpo */}
                            <div className="space-y-1">
                                <Label>Cuerpo</Label>
                                <Controller
                                    name="person_cuerpo"
                                    control={control}
                                    render={({ field: { onChange, value, ...field } }) => {
                                        const cuerpoOptions = CUERPOS.map(c => ({ value: c, label: c }));
                                        const selected = cuerpoOptions.find(o => o.value === value) || null;
                                        return (
                                            <Select
                                                {...field}
                                                value={selected}
                                                onChange={(opt) => onChange(opt?.value ?? '')}
                                                options={cuerpoOptions}
                                                placeholder="Seleccionar"
                                                isSearchable={true}
                                                classNames={getSelectClassNames(!!errors.person_cuerpo, !!selected)}
                                                classNamePrefix="react-select"
                                                menuPortalTarget={document.body}
                                                styles={menuPortalStyles}
                                            />
                                        );
                                    }}
                                />
                                {errors.person_cuerpo && (
                                    <p className="text-sm text-destructive">{errors.person_cuerpo.message}</p>
                                )}
                            </div>

                            {/* Especialidad - Dinámico desde hook */}
                            <div className="space-y-1">
                                <Label>Especialidad</Label>
                                <Controller
                                    name="person_especialidad"
                                    control={control}
                                    render={({ field: { onChange, value, ...field } }) => {
                                        const especialidadOptions = especialidades.map(e => ({ value: e, label: e }));
                                        const selected = especialidadOptions.find(o => o.value === value) || null;
                                        return (
                                            <Select
                                                {...field}
                                                value={selected}
                                                onChange={(opt) => onChange(opt?.value ?? '')}
                                                options={especialidadOptions}
                                                placeholder="Seleccionar"
                                                isSearchable={true}
                                                classNames={getSelectClassNames(!!errors.person_especialidad, !!selected)}
                                                classNamePrefix="react-select"
                                                menuPortalTarget={document.body}
                                                styles={menuPortalStyles}
                                            />
                                        );
                                    }}
                                />
                                {errors.person_especialidad && (
                                    <p className="text-sm text-destructive">{errors.person_especialidad.message}</p>
                                )}
                            </div>

                            {/* Empleo - Dinámico desde hook */}
                            <div className="space-y-1">
                                <Label>Empleo</Label>
                                <Controller
                                    name="person_rank"
                                    control={control}
                                    render={({ field: { onChange, value, ...field } }) => {
                                        const empleoOptions = empleos.map(e => ({ value: e, label: e }));
                                        const selected = empleoOptions.find(o => o.value === value) || null;
                                        return (
                                            <Select
                                                {...field}
                                                value={selected}
                                                onChange={(opt) => onChange(opt?.value ?? '')}
                                                options={empleoOptions}
                                                placeholder="Seleccionar"
                                                isSearchable={true}
                                                classNames={getSelectClassNames(!!errors.person_rank, !!selected)}
                                                classNamePrefix="react-select"
                                                menuPortalTarget={document.body}
                                                styles={menuPortalStyles}
                                            />
                                        );
                                    }}
                                />
                                {errors.person_rank && (
                                    <p className="text-sm text-destructive">{errors.person_rank.message}</p>
                                )}
                            </div>

                            {/* Nombre */}
                            <div className="space-y-1">
                                <Label htmlFor="name">Nombre</Label>
                                <Input
                                    id="name"
                                    {...register("person_name")}
                                />
                                {errors.person_name && (
                                    <p className="text-sm text-destructive">{errors.person_name.message}</p>
                                )}
                            </div>

                            {/* Apellido 1 */}
                            <div className="space-y-1">
                                <Label htmlFor="last1">Primer Apellido</Label>
                                <Input
                                    id="last1"
                                    {...register("person_last_name_1")}
                                />
                                {errors.person_last_name_1 && (
                                    <p className="text-sm text-destructive">{errors.person_last_name_1.message}</p>
                                )}
                            </div>

                            {/* Apellido 2 */}
                            <div className="space-y-1">
                                <Label htmlFor="last2">Segundo Apellido</Label>
                                <Input
                                    id="last2"
                                    {...register("person_last_name_2")}
                                />
                                {errors.person_last_name_2 && (
                                    <p className="text-sm text-destructive">{errors.person_last_name_2.message}</p>
                                )}
                            </div>

                            {/* Teléfono */}
                            <div className="space-y-1">
                                <Label htmlFor="phone">Teléfono</Label>
                                <Input
                                    id="phone"
                                    {...register("person_phone")}
                                />
                                {errors.person_phone && (
                                    <p className="text-sm text-destructive">{errors.person_phone.message}</p>
                                )}
                            </div>

                            {/* DNI */}
                            <div className="space-y-1">
                                <Label htmlFor="dni">DNI</Label>
                                <Input
                                    id="dni"
                                    {...register("person_dni")}
                                    className={cn(errors.person_dni && "border-destructive")}
                                />
                                {errors.person_dni && (
                                    <p className="text-sm text-destructive">{errors.person_dni.message}</p>
                                )}
                            </div>

                            {/* División - Dinámico desde hook */}
                            <div className="space-y-1">
                                <Label>División</Label>
                                <Controller
                                    name="person_division"
                                    control={control}
                                    render={({ field: { onChange, value, ...field } }) => {
                                        const divisionOptions = divisiones.map(d => ({ value: d, label: d }));
                                        const selected = divisionOptions.find(o => o.value === value) || null;
                                        return (
                                            <Select
                                                {...field}
                                                value={selected}
                                                onChange={(opt) => onChange(opt?.value ?? '')}
                                                options={divisionOptions}
                                                placeholder="Seleccionar"
                                                isSearchable={true}
                                                classNames={getSelectClassNames(!!errors.person_division, !!selected)}
                                                classNamePrefix="react-select"
                                                menuPortalTarget={document.body}
                                                styles={menuPortalStyles}
                                            />
                                        );
                                    }}
                                />
                                {errors.person_division && (
                                    <p className="text-sm text-destructive">{errors.person_division.message}</p>
                                )}
                            </div>

                            {/* Rol - Dinámico desde hook */}
                            <div className="space-y-1">
                                <Label>Rol</Label>
                                <Controller
                                    name="person_rol"
                                    control={control}
                                    render={({ field: { onChange, value, ...field } }) => {
                                        const rolOptions = roles.map(r => ({ value: r, label: r }));
                                        const selected = rolOptions.find(o => o.value === value) || null;
                                        return (
                                            <Select
                                                {...field}
                                                value={selected}
                                                onChange={(opt) => onChange(opt?.value ?? '')}
                                                options={rolOptions}
                                                placeholder="Seleccionar"
                                                isSearchable={true}
                                                classNames={getSelectClassNames(!!errors.person_rol, !!selected)}
                                                classNamePrefix="react-select"
                                                menuPortalTarget={document.body}
                                                styles={menuPortalStyles}
                                            />
                                        );
                                    }}
                                />
                                {errors.person_rol && (
                                    <p className="text-sm text-destructive">{errors.person_rol.message}</p>
                                )}
                            </div>

                            {/* Fecha Alta Empresa */}
                            <div className="space-y-1">
                                <Label>Antiguedad empleo</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !aEmp && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {aEmp ? format(aEmp, "dd/MM/yyyy") : <span>Seleccionar</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={aEmp}
                                            onSelect={(date) => setValue("person_a_emp", date || undefined)}
                                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                            captionLayout="dropdown"
                                            startMonth={new Date(1900, 0)}
                                            endMonth={new Date()}
                                        />
                                    </PopoverContent>
                                </Popover>
                                {errors.person_a_emp && (
                                    <p className="text-sm text-destructive">{errors.person_a_emp.message}</p>
                                )}
                            </div>

                            {/* Fecha Embarque */}
                            <div className="space-y-1">
                                <Label>Fecha Embarque</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !fEmb && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {fEmb ? format(fEmb, "dd/MM/yyyy") : <span>Seleccionar</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={fEmb}
                                            onSelect={(date) => setValue("person_f_emb", date || undefined)}
                                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                            captionLayout="dropdown"
                                            startMonth={new Date(1900, 0)}
                                            endMonth={new Date()}
                                        />
                                    </PopoverContent>
                                </Popover>
                                {errors.person_f_emb && (
                                    <p className="text-sm text-destructive">{errors.person_f_emb.message}</p>
                                )}
                            </div>

                            {/* Fecha Nacimiento */}
                            <div className="space-y-1">
                                <Label>Fecha Nacimiento</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !birthdate && "text-muted-foreground",
                                                errors.person_birthdate && "border-destructive"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {birthdate ? format(birthdate, "dd/MM/yyyy") : <span>Seleccionar</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={birthdate}
                                            onSelect={(date) => setValue("person_birthdate", date || undefined)}
                                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                            captionLayout="dropdown"
                                            startMonth={new Date(1900, 0)}
                                            endMonth={new Date()}
                                        />
                                    </PopoverContent>
                                </Popover>
                                {errors.person_birthdate && (
                                    <p className="text-sm text-destructive">{errors.person_birthdate.message}</p>
                                )}
                            </div>

                            {/* Nº Escalafón */}
                            <div className="space-y-1">
                                <Label htmlFor="escalafon">Nº Escalafón</Label>
                                <Input
                                    id="escalafon"
                                    type="number"
                                    placeholder="12345"
                                    {...register("person_num_escalafon", { valueAsNumber: true })}
                                />
                                {errors.person_num_escalafon && (
                                    <p className="text-sm text-destructive">{errors.person_num_escalafon.message}</p>
                                )}
                            </div>
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
