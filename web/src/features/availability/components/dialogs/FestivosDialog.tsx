import React, { useState, useEffect } from 'react';
import { useApiQuery, useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers/UserProvider';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, PartyPopper, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface Festivo {
    festivo_sk: number;
    festivo_dia: string;
    festivo_motivo: string;
}

interface FestivosDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type FormMode = 'list' | 'create' | 'edit';

export default function FestivosDialog({ open, onOpenChange }: FestivosDialogProps): React.ReactElement {
    const { id: escId } = useEscuadrilla();
    const festivosKey = queryKeys.availability.festivos(escId ?? 0);

    // Estado del formulario
    const [mode, setMode] = useState<FormMode>('list');
    const [editingFestivo, setEditingFestivo] = useState<Festivo | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [festivoMotivo, setFestivoMotivo] = useState<string>('');
    const [formError, setFormError] = useState<string | null>(null);
    const [calendarOpen, setCalendarOpen] = useState<boolean>(false);

    // Estado para confirmación de eliminación
    const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
    const [festivoToDelete, setFestivoToDelete] = useState<Festivo | null>(null);

    // Datos vía TanStack Query (los errores HTTP los notifica el toast de useApiMutation).
    const {
        data: festivosData,
        isLoading: loading,
        error: queryError,
    } = useApiQuery<Festivo[]>('GET', '/festivos', { enabled: open }, festivosKey);
    const festivos = festivosData ?? [];

    const saveMutation = useApiMutation<unknown, { festivo_sk?: number; festivo_dia: string; festivo_motivo: string }>(
        mode === 'edit' ? 'PUT' : 'POST',
        (vars) => (mode === 'edit' ? `/festivos/${vars.festivo_sk}` : '/festivos'),
        { invalidateKeys: [festivosKey] },
    );

    const deleteMutation = useApiMutation<void, { festivo_sk: number }>(
        'DELETE',
        (vars) => `/festivos/${vars.festivo_sk}`,
        { invalidateKeys: [festivosKey] },
    );

    const saving = saveMutation.isPending;
    const deleting = deleteMutation.isPending;
    const error = formError ?? queryError?.message ?? null;

    useEffect(() => {
        if (open) {
            resetForm();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const resetForm = () => {
        setMode('list');
        setEditingFestivo(null);
        setSelectedDate(undefined);
        setFestivoMotivo('');
        setFormError(null);
        setCalendarOpen(false);
    };

    const handleCreate = () => {
        setMode('create');
        setSelectedDate(undefined);
        setFestivoMotivo('');
    };

    const handleEdit = (festivo: Festivo) => {
        setMode('edit');
        setEditingFestivo(festivo);
        // Parsear la fecha del festivo
        const fecha = new Date(festivo.festivo_dia);
        setSelectedDate(fecha);
        setFestivoMotivo(festivo.festivo_motivo);
    };

    const handleDeleteClick = (festivo: Festivo) => {
        setFestivoToDelete(festivo);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!festivoToDelete) return;
        try {
            await deleteMutation.mutateAsync({ festivo_sk: festivoToDelete.festivo_sk });
            setDeleteDialogOpen(false);
            setFestivoToDelete(null);
        } catch {
            // El toast de useApiMutation ya notifica el error.
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDate || !festivoMotivo.trim()) {
            setFormError('Todos los campos son obligatorios');
            return;
        }
        setFormError(null);

        try {
            await saveMutation.mutateAsync({
                ...(mode === 'edit' && editingFestivo ? { festivo_sk: editingFestivo.festivo_sk } : {}),
                festivo_dia: format(selectedDate, 'yyyy-MM-dd'),
                festivo_motivo: festivoMotivo.trim(),
            });
            resetForm();
        } catch {
            // El toast de useApiMutation ya notifica el error.
        }
    };

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handleDateSelect = (date: Date | undefined) => {
        setSelectedDate(date);
        setCalendarOpen(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={(isOpen) => {
                if (!isOpen) resetForm();
                onOpenChange(isOpen);
            }}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PartyPopper className="w-5 h-5" />
                            {mode === 'list' && 'Días Festivos'}
                            {mode === 'create' && 'Agregar Día Festivo'}
                            {mode === 'edit' && 'Editar Día Festivo'}
                        </DialogTitle>
                        <DialogDescription>
                            {mode === 'list' && 'Gestiona los días festivos del calendario.'}
                            {mode === 'create' && 'Ingresa los datos del nuevo día festivo.'}
                            {mode === 'edit' && 'Modifica los datos del día festivo.'}
                        </DialogDescription>
                    </DialogHeader>

                    {error && (
                        <div className="bg-danger-muted border border-danger/30 rounded-lg p-3">
                            <p className="text-sm text-danger">{error}</p>
                        </div>
                    )}

                    {mode === 'list' ? (
                        <>
                            <div className="flex justify-end mb-2">
                                <Button onClick={handleCreate} size="sm" className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    Agregar Festivo
                                </Button>
                            </div>

                            <div className="flex-1 overflow-auto border rounded-lg">
                                {loading ? (
                                    <div className="flex items-center justify-center p-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-info" />
                                        <span className="ml-2 text-muted-foreground">Cargando...</span>
                                    </div>
                                ) : festivos.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground">
                                        No hay días festivos registrados
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Motivo</TableHead>
                                                <TableHead className="w-[100px] text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {festivos.map((festivo) => (
                                                <TableRow key={festivo.festivo_sk}>
                                                    <TableCell className="font-medium">
                                                        {formatDate(festivo.festivo_dia)}
                                                    </TableCell>
                                                    <TableCell>{festivo.festivo_motivo}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(festivo)}
                                                                className="h-8 w-8"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDeleteClick(festivo)}
                                                                className="h-8 w-8 text-danger hover:text-danger hover:bg-danger-muted"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="festivo-fecha">Fecha</Label>
                                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                    <PopoverTrigger render={
                                        <Button
                                            id="festivo-fecha"
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !selectedDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedDate ? (
                                                format(selectedDate, "dd/MM/yyyy", { locale: es })
                                            ) : (
                                                <span>Selecciona una fecha</span>
                                            )}
                                        </Button>
                                    } />
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={handleDateSelect}
                                            defaultMonth={selectedDate || new Date()}
                                            captionLayout="dropdown"
                                            startMonth={new Date(new Date().getFullYear() - 10, 0)}
                                            endMonth={new Date(new Date().getFullYear() + 10, 11)}
                                            locale={es}
                                            className="rounded-md border"
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="festivo_motivo">Motivo</Label>
                                <Input
                                    id="festivo_motivo"
                                    type="text"
                                    placeholder="Ej: Navidad, Año Nuevo, etc."
                                    value={festivoMotivo}
                                    onChange={(e) => setFestivoMotivo(e.target.value)}
                                    maxLength={200}
                                    required
                                />
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={resetForm}
                                    disabled={saving}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {mode === 'create' ? 'Agregar' : 'Guardar'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog de confirmación de eliminación */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar día festivo?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {festivoToDelete && (
                                <>
                                    Vas a eliminar el festivo <strong>{festivoToDelete.festivo_motivo}</strong> del día{' '}
                                    <strong>{formatDate(festivoToDelete.festivo_dia)}</strong>.
                                    Esta acción no se puede deshacer.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={deleting}
                            className="bg-danger text-danger-foreground hover:bg-danger/90"
                        >
                            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}