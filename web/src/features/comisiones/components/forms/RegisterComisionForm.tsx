// Formulario de alta/edición de comisiones. La lógica vive en
// hooks/useComisionForm; aquí solo el render.

import { Controller } from 'react-hook-form';
import Select from "react-select";
import { getSelectClassNames, menuPortalStyles } from "@/lib/reactSelectClassNames";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings, Pencil, Trash2, CalendarIcon } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useComisionForm, type ComisionEditData } from '../../hooks/useComisionForm';

export type { ComisionEditData };

interface RegisterComisionFormProps {
    onClose: () => void;
    editData?: ComisionEditData | null;
}

export default function RegisterComisionForm({ onClose, editData }: RegisterComisionFormProps) {
    const {
        isEditMode,
        handleSubmit,
        control,
        errors,
        isSubmitting,
        onSubmit,
        fechaInicio,
        setFechaInicio,
        fechaFin,
        setFechaFin,
        generaEsfuerzo,
        handleSegmentChange,
        tipoArray,
        tipoLoading,
        tipoError,
        lugarArray,
        lugarLoading,
        lugarQueryError,
        isAddLugarOpen,
        setIsAddLugarOpen,
        isManageLugaresOpen,
        setIsManageLugaresOpen,
        isEditLugarOpen,
        isDeleteConfirmOpen,
        newLugarName,
        setNewLugarName,
        editingLugar,
        setEditingLugar,
        lugarToDelete,
        lugarError,
        setLugarError,
        insertLoading,
        deleteLoading,
        closeAddLugarDialog,
        closeEditLugarDialog,
        closeDeleteConfirmDialog,
        openEditDialog,
        openDeleteConfirm,
        handleAddLugar,
        handleEditLugar,
        handleDeleteLugar,
    } = useComisionForm({ onClose, editData });

    return (
        <>
            <div className="space-y-6 p-6 bg-background">
                {/* Fechas */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Fecha Inicio */}
                    <div className="space-y-2">
                        <Label className="text-foreground">Fecha Inicio</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full h-10 justify-start text-left font-normal",
                                        !fechaInicio && "text-muted-foreground",
                                        errors.fechaInicio && "border-danger"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {fechaInicio ? format(fechaInicio, "dd/MM/yyyy", { locale: es }) : <span>Seleccionar</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={fechaInicio}
                                    onSelect={setFechaInicio}
                                    disabled={(date) => date < new Date("1900-01-01")}
                                    captionLayout="dropdown"
                                    startMonth={new Date(new Date().getFullYear() - 10, 0)}
                                    endMonth={new Date(new Date().getFullYear() + 10, 11)}
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                        {errors.fechaInicio && (
                            <p className="text-sm text-danger">{errors.fechaInicio.message}</p>
                        )}
                    </div>

                    {/* Fecha Fin */}
                    <div className="space-y-2">
                        <Label className="text-foreground">Fecha Fin</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full h-10 justify-start text-left font-normal",
                                        !fechaFin && "text-muted-foreground",
                                        errors.fechaFin && "border-danger"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {fechaFin ? format(fechaFin, "dd/MM/yyyy", { locale: es }) : <span>Seleccionar</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={fechaFin}
                                    onSelect={setFechaFin}
                                    disabled={(date) =>
                                        date < new Date("1900-01-01") ||
                                        (fechaInicio ? date < fechaInicio : false)
                                    }
                                    captionLayout="dropdown"
                                    startMonth={new Date(new Date().getFullYear() - 10, 0)}
                                    endMonth={new Date(new Date().getFullYear() + 10, 11)}
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                        {errors.fechaFin && (
                            <p className="text-sm text-danger">{errors.fechaFin.message}</p>
                        )}
                    </div>
                </div>

                {/* Select Tipo */}
                <div className="space-y-2">
                    <Label htmlFor="tipo" className="text-foreground">Tipo</Label>
                    <Controller
                        name="tipo"
                        control={control}
                        render={({ field: { onChange, value, ...field } }) => {
                            const tipoOptions = (tipoArray ?? []).map(t => ({ value: t.comision_type_sk.toString(), label: t.name }));
                            const selected = tipoOptions.find(o => o.value === value) || null;
                            return (
                                <Select
                                    {...field}
                                    inputId="tipo"
                                    value={selected}
                                    onChange={(opt) => onChange(opt?.value ?? '')}
                                    options={tipoOptions}
                                    placeholder={tipoLoading ? "Cargando..." : "Seleccione un tipo"}
                                    isLoading={tipoLoading}
                                    isDisabled={Boolean(tipoLoading || tipoError)}
                                    isSearchable={true}
                                    classNames={getSelectClassNames(!!errors.tipo, !!selected)}
                                    classNamePrefix="react-select"
                                    menuPortalTarget={document.body}
                                    styles={menuPortalStyles}
                                />
                            );
                        }}
                    />
                    {errors.tipo && (
                        <p className="text-sm text-danger">{errors.tipo.message}</p>
                    )}
                </div>

                {/* Select Lugar */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="lugar" className="text-foreground">Lugar</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsManageLugaresOpen(true)}
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                            <Settings className="h-4 w-4 mr-1" />
                            Gestionar
                        </Button>
                    </div>
                    <Controller
                        name="lugar"
                        control={control}
                        render={({ field: { onChange, value, ...field } }) => {
                            const lugarOptions = [
                                { value: 'add-new', label: '+ Agregar nuevo lugar' },
                                ...(lugarArray ?? []).map(l => ({ value: l.comision_lugar_sk.toString(), label: l.comision_name }))
                            ];
                            const selected = lugarOptions.find(o => o.value === value && o.value !== 'add-new') || null;
                            return (
                                <Select
                                    {...field}
                                    inputId="lugar"
                                    value={selected}
                                    onChange={(opt) => {
                                        if (opt?.value === 'add-new') { setIsAddLugarOpen(true); return; }
                                        onChange(opt?.value ?? '');
                                    }}
                                    options={lugarOptions}
                                    placeholder={lugarLoading ? "Cargando..." : "Seleccione un lugar"}
                                    isLoading={lugarLoading}
                                    isDisabled={Boolean(lugarLoading || lugarQueryError)}
                                    isSearchable={true}
                                    classNames={getSelectClassNames(!!errors.lugar, !!selected)}
                                    classNamePrefix="react-select"
                                    menuPortalTarget={document.body}
                                    styles={menuPortalStyles}
                                />
                            );
                        }}
                    />
                    {errors.lugar && (
                        <p className="text-sm text-danger">{errors.lugar.message}</p>
                    )}
                </div>

                {/* Genera Esfuerzo */}
                <div className="space-y-2">
                    <Label className="text-foreground">Genera esfuerzo:</Label>
                    <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1">
                        <button
                            type="button"
                            onClick={() => handleSegmentChange(true)}
                            className={`
                                inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 
                                text-sm font-medium ring-offset-background transition-all focus-visible:outline-none 
                                focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 
                                disabled:pointer-events-none disabled:opacity-50
                                ${generaEsfuerzo === true
                                ? 'bg-success text-success-foreground shadow-sm'
                                : 'bg-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground/80'
                            }
                            `}
                        >
                            Sí
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSegmentChange(false)}
                            className={`
                                inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 
                                text-sm font-medium ring-offset-background transition-all focus-visible:outline-none 
                                focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 
                                disabled:pointer-events-none disabled:opacity-50
                                ${generaEsfuerzo === false
                                ? 'bg-danger text-danger-foreground shadow-sm'
                                : 'bg-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground/80'
                            }
                            `}
                        >
                            No
                        </button>
                    </div>
                </div>

                {/* Botón Guardar */}
                <div className="pt-4">
                    <Button
                        onClick={() => handleSubmit(onSubmit)()}
                        className="w-full"
                        size="lg"
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? (isEditMode ? 'Actualizando...' : 'Guardando...')
                            : (isEditMode ? 'Actualizar' : 'Guardar')
                        }
                    </Button>
                </div>
            </div>

            {/* Diálogos (sin cambios) */}
            <Dialog open={isAddLugarOpen} onOpenChange={closeAddLugarDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Agregar nuevo lugar</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-lugar-name">Nombre del lugar</Label>
                            <Input
                                id="new-lugar-name"
                                value={newLugarName}
                                onChange={(e) => {
                                    setNewLugarName(e.target.value);
                                    setLugarError('');
                                }}
                                placeholder="Ingrese el nombre del lugar"
                                className={lugarError ? 'border-danger' : ''}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddLugar();
                                    }
                                }}
                            />
                            {lugarError && (
                                <p className="text-sm text-danger">{lugarError}</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeAddLugarDialog}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleAddLugar} disabled={insertLoading}>
                            {insertLoading ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isManageLugaresOpen} onOpenChange={setIsManageLugaresOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Gestionar lugares</DialogTitle>
                        <DialogDescription>
                            Edita o elimina los lugares existentes
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-[400px] overflow-y-auto">
                        {lugarLoading ? (
                            <p className="text-center text-muted-foreground">Cargando...</p>
                        ) : lugarArray && lugarArray.length > 0 ? (
                            <div className="space-y-2">
                                {lugarArray.map((lugar) => (
                                    <div
                                        key={lugar.comision_lugar_sk}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <span className="text-sm font-medium">{lugar.comision_name}</span>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                onClick={() => openEditDialog(lugar)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => openDeleteConfirm(lugar)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground">No hay lugares disponibles</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsManageLugaresOpen(false)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditLugarOpen} onOpenChange={closeEditLugarDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar lugar</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-lugar-name">Nombre del lugar</Label>
                            <Input
                                id="edit-lugar-name"
                                value={editingLugar?.comision_name || ''}
                                onChange={(e) => {
                                    if (editingLugar) {
                                        setEditingLugar({
                                            ...editingLugar,
                                            comision_name: e.target.value
                                        });
                                    }
                                    setLugarError('');
                                }}
                                placeholder="Ingrese el nombre del lugar"
                                className={lugarError ? 'border-danger' : ''}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleEditLugar();
                                    }
                                }}
                            />
                            {lugarError && (
                                <p className="text-sm text-danger">{lugarError}</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeEditLugarDialog}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleEditLugar} disabled={insertLoading}>
                            {insertLoading ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteConfirmOpen} onOpenChange={closeDeleteConfirmDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Confirmar eliminación</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de que deseas eliminar el lugar "{lugarToDelete?.comision_name}"?
                            Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={closeDeleteConfirmDialog}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteLugar}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}