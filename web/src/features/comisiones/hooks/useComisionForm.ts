// Estado y lógica del formulario de comisiones (alta/edición) y del CRUD
// de lugares de comisión. El componente RegisterComisionForm queda solo
// con el render.

import { useState, useEffect } from 'react';
import { useLogger } from '@/lib/logger';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useComisionTypes, useComisionLugares, type ComisionLugarLookup } from "@/shared/hooks";
import { format } from 'date-fns';
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { http } from "@/lib/http";
import { FormValues, formSchema } from "../components/forms/schema";

// Datos para modo edición
export interface ComisionEditData {
    comision_sk: number;
    fecha_inicio: string;
    fecha_fin: string;
    dias: number;
    lugar: string;
    tipo: string;
    esfuerzo: boolean;
}

export function useComisionForm({ onClose, editData }: { onClose: () => void; editData?: ComisionEditData | null }) {
    const log = useLogger('RegisterComisionForm');
    const isEditMode = !!editData;

    const [isAddLugarOpen, setIsAddLugarOpen] = useState(false);
    const [isManageLugaresOpen, setIsManageLugaresOpen] = useState(false);
    const [isEditLugarOpen, setIsEditLugarOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [newLugarName, setNewLugarName] = useState('');
    const [editingLugar, setEditingLugar] = useState<ComisionLugarLookup | null>(null);
    const [lugarToDelete, setLugarToDelete] = useState<ComisionLugarLookup | null>(null);
    const [lugarError, setLugarError] = useState('');
    const [insertLoading, setInsertLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const navigate = useNavigate();

    // Estados para las fechas como Date
    const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
    const [fechaFin, setFechaFin] = useState<Date | undefined>(undefined);

    // Arrays para Selects
    const {
        data: tipoArray,
        loading: tipoLoading,
        error: tipoError
    } = useComisionTypes();

    const {
        data: lugarArray,
        loading: lugarLoading,
        error: lugarQueryError,
        refetch: refetchLugares
    } = useComisionLugares();

    // Configuración del formulario
    const {
        handleSubmit,
        control,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            fechaInicio: '',
            fechaFin: '',
            tipo: '',
            lugar: '',
            generaEsfuerzo: true
        }
    });

    // Cargar datos en modo edición cuando los arrays estén disponibles
    useEffect(() => {
        if (isEditMode && editData && tipoArray && lugarArray && !tipoLoading && !lugarLoading) {
            // Encontrar el tipo_sk por nombre
            const tipoFound = tipoArray.find(t => t.name === editData.tipo);
            // Encontrar el lugar_sk por nombre
            const lugarFound = lugarArray.find(l => l.comision_name === editData.lugar);

            // Parsear fechas string a Date
            const fechaInicioDate = editData.fecha_inicio ? new Date(editData.fecha_inicio + 'T00:00:00') : undefined;
            const fechaFinDate = editData.fecha_fin ? new Date(editData.fecha_fin + 'T00:00:00') : undefined;

            setFechaInicio(fechaInicioDate);
            setFechaFin(fechaFinDate);

            reset({
                fechaInicio: editData.fecha_inicio,
                fechaFin: editData.fecha_fin,
                tipo: tipoFound ? tipoFound.comision_type_sk.toString() : '',
                lugar: lugarFound ? lugarFound.comision_lugar_sk.toString() : '',
                generaEsfuerzo: editData.esfuerzo
            });
        }
    }, [isEditMode, editData, tipoArray, lugarArray, tipoLoading, lugarLoading, reset]);

    // Sincronizar fechaInicio con el formulario
    useEffect(() => {
        if (fechaInicio) {
            setValue('fechaInicio', format(fechaInicio, 'yyyy-MM-dd'), { shouldValidate: true });
        } else {
            setValue('fechaInicio', '', { shouldValidate: true });
        }
    }, [fechaInicio, setValue]);

    // Sincronizar fechaFin con el formulario
    useEffect(() => {
        if (fechaFin) {
            setValue('fechaFin', format(fechaFin, 'yyyy-MM-dd'), { shouldValidate: true });
        } else {
            setValue('fechaFin', '', { shouldValidate: true });
        }
    }, [fechaFin, setValue]);

    const generaEsfuerzo = watch('generaEsfuerzo');
    const selectedLugar = watch('lugar');

    const handleSegmentChange = (value: boolean) => {
        setValue('generaEsfuerzo', value);
    };

    // Función para insertar nuevo lugar (POST /comision-lugares)
    const insertLugar = async (comision_name: string): Promise<{ comision_lugar_sk: number; comision_name: string }> => {
        return await http<{ comision_lugar_sk: number; comision_name: string }>(
            'POST', '/comision-lugares', { body: { comision_name } }
        );
    };

    // Función para actualizar lugar (PUT /comision-lugares/:id)
    const updateLugar = async (id: number, name: string): Promise<void> => {
        await http<void>('PUT', `/comision-lugares/${id}`, { body: { name } });
    };

    // Función para eliminar lugar (DELETE /comision-lugares/:id)
    const deleteLugar = async (id: number): Promise<void> => {
        await http<void>('DELETE', `/comision-lugares/${id}`);
    };

    const closeAddLugarDialog = () => {
        setIsAddLugarOpen(false);
        setNewLugarName('');
        setLugarError('');
    };

    const closeEditLugarDialog = () => {
        setIsEditLugarOpen(false);
        setEditingLugar(null);
        setLugarError('');
    };

    const closeDeleteConfirmDialog = () => {
        setIsDeleteConfirmOpen(false);
        setLugarToDelete(null);
    };

    const openEditDialog = (lugar: ComisionLugarLookup) => {
        setEditingLugar({ ...lugar });
        setIsEditLugarOpen(true);
    };

    const openDeleteConfirm = (lugar: ComisionLugarLookup) => {
        setLugarToDelete(lugar);
        setIsDeleteConfirmOpen(true);
    };

    const handleAddLugar = async () => {
        if (!newLugarName.trim()) {
            setLugarError('El nombre del lugar es requerido');
            return;
        }

        if (lugarArray?.some(l => l.comision_name.toLowerCase() === newLugarName.trim().toLowerCase())) {
            setLugarError('Este lugar ya existe');
            return;
        }

        setInsertLoading(true);
        try {
            const result = await insertLugar(newLugarName.trim());
            await refetchLugares();
            setValue('lugar', result.comision_lugar_sk.toString());
            closeAddLugarDialog();
            toast.success('Lugar agregado correctamente');
        } catch (error) {
            log.error(`Error al agregar lugar: ${error}`);
            setLugarError(error as string || 'Error al guardar el lugar. Por favor intente nuevamente.');
        } finally {
            setInsertLoading(false);
        }
    };

    const handleEditLugar = async () => {
        if (!editingLugar) return;

        if (!editingLugar.comision_name.trim()) {
            setLugarError('El nombre del lugar es requerido');
            return;
        }

        if (lugarArray?.some(l =>
            l.comision_name.toLowerCase() === editingLugar.comision_name.trim().toLowerCase() &&
            l.comision_lugar_sk !== editingLugar.comision_lugar_sk
        )) {
            setLugarError('Ya existe otro lugar con este nombre');
            return;
        }

        setInsertLoading(true);
        try {
            await updateLugar(editingLugar.comision_lugar_sk, editingLugar.comision_name.trim());
            await refetchLugares();
            closeEditLugarDialog();
            toast.success('Lugar actualizado correctamente');
        } catch (error) {
            log.error(`Error al actualizar lugar: ${error}`);
            setLugarError(error as string || 'Error al actualizar el lugar.');
        } finally {
            setInsertLoading(false);
        }
    };

    const handleDeleteLugar = async () => {
        if (!lugarToDelete) return;

        setDeleteLoading(true);
        try {
            await deleteLugar(lugarToDelete.comision_lugar_sk);
            await refetchLugares();

            if (selectedLugar === lugarToDelete.comision_lugar_sk.toString()) {
                setValue('lugar', '');
            }

            closeDeleteConfirmDialog();
            toast.success('Lugar eliminado correctamente');
        } catch (error) {
            log.error(`Error al eliminar lugar: ${error}`);
            toast.error(error as string || 'Error al eliminar el lugar. Puede que esté en uso.');
            closeDeleteConfirmDialog();
        } finally {
            setDeleteLoading(false);
        }
    };

    // Manejador para guardar (crear o actualizar)
    const onSubmit = async (data: FormValues) => {
        log.debug(`Datos del formulario válidos: ${JSON.stringify(data)}`);

        try {
            if (isEditMode && editData) {
                // PUT /comisiones/:id
                await http<void>('PUT', `/comisiones/${editData.comision_sk}`, { body: data });
                toast.success('Comisión actualizada correctamente');
            } else {
                // POST /comisiones
                const result = await http<{
                    comision_id: number;
                    success: boolean;
                    message: string;
                }>('POST', '/comisiones', { body: data });

                log.info(`Resultado de inserción: ${JSON.stringify(result)}`);

                if (result.success) {
                    toast.success(result.message);
                } else {
                    toast.error('Error al guardar la comisión');
                    return;
                }
            }

            navigate('/comisiones');
            onClose();
        } catch (error) {
            log.error(`Error al guardar la comisión: ${error}`);
            toast.error(error as string || 'Error al guardar la comisión');
        }
    };

    return {
        isEditMode,

        // react-hook-form
        handleSubmit,
        control,
        errors,
        isSubmitting,
        onSubmit,

        // fechas
        fechaInicio,
        setFechaInicio,
        fechaFin,
        setFechaFin,

        // segmento esfuerzo
        generaEsfuerzo,
        handleSegmentChange,

        // lookups
        tipoArray,
        tipoLoading,
        tipoError,
        lugarArray,
        lugarLoading,
        lugarQueryError,

        // CRUD de lugares
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
    };
}
