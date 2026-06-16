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
import { useApiMutation } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useEscuadrilla } from "@/providers";
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
    hora_salida: string;
    hora_llegada: string;
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
    } = useComisionLugares();

    const { id: escId } = useEscuadrilla();

    // Mutaciones del lookup de lugares: invalidar su clave refresca el selector
    // (y cualquier otro consumidor) sin refetch manual. Los errores HTTP los
    // notifica el toast de useApiMutation.
    const comisionLugaresKey = queryKeys.lookups.comisionLugares(escId ?? 0);
    const insertLugarMutation = useApiMutation<{ comision_lugar_sk: number; comision_name: string }, { comision_name: string }>(
        'POST', '/comision-lugares', { invalidateKeys: [comisionLugaresKey] },
    );
    const updateLugarMutation = useApiMutation<void, { id: number; name: string }>(
        'PUT', (v) => `/comision-lugares/${v.id}`,
        { invalidateKeys: [comisionLugaresKey], body: ({ id, ...rest }) => rest },
    );
    const deleteLugarMutation = useApiMutation<void, { id: number }>(
        'DELETE', (v) => `/comision-lugares/${v.id}`, { invalidateKeys: [comisionLugaresKey] },
    );

    // Alta/edición de comisión. El POST devuelve { success, message } en el body.
    // Invalidan todo el dominio de comisiones (lista y días) de la escuadrilla.
    const comisionesKey = queryKeys.comisiones.all(escId ?? 0);
    const createComisionMutation = useApiMutation<{ comision_id: number; success: boolean; message: string }, Record<string, unknown>>(
        'POST', '/comisiones', { invalidateKeys: [comisionesKey] },
    );
    const updateComisionMutation = useApiMutation<void, Record<string, unknown>>(
        'PUT', (v) => `/comisiones/${v.comision_sk}`,
        { invalidateKeys: [comisionesKey], successMessage: 'Comisión actualizada correctamente', body: ({ comision_sk, ...rest }) => rest },
    );

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
            generaEsfuerzo: true,
            horaSalida: '08:00',
            horaLlegada: '14:00'
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
                generaEsfuerzo: editData.esfuerzo,
                horaSalida: editData.hora_salida,
                horaLlegada: editData.hora_llegada
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

    const insertLugar = (comision_name: string) => insertLugarMutation.mutateAsync({ comision_name });
    const updateLugar = (id: number, name: string) => updateLugarMutation.mutateAsync({ id, name });
    const deleteLugar = (id: number) => deleteLugarMutation.mutateAsync({ id });

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
            setValue('lugar', result.comision_lugar_sk.toString());
            closeAddLugarDialog();
            toast.success('Lugar agregado correctamente');
        } catch (error) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error al agregar lugar: ${error}`);
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
            closeEditLugarDialog();
            toast.success('Lugar actualizado correctamente');
        } catch (error) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error al actualizar lugar: ${error}`);
        } finally {
            setInsertLoading(false);
        }
    };

    const handleDeleteLugar = async () => {
        if (!lugarToDelete) return;

        setDeleteLoading(true);
        try {
            await deleteLugar(lugarToDelete.comision_lugar_sk);

            if (selectedLugar === lugarToDelete.comision_lugar_sk.toString()) {
                setValue('lugar', '');
            }

            closeDeleteConfirmDialog();
            toast.success('Lugar eliminado correctamente');
        } catch (error) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error al eliminar lugar: ${error}`);
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
                await updateComisionMutation.mutateAsync({ ...data, comision_sk: editData.comision_sk });
            } else {
                const result = await createComisionMutation.mutateAsync({ ...data });
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
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error al guardar la comisión: ${error}`);
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
