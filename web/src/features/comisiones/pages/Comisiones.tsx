import React, { useState, useEffect, useTransition } from 'react';
import { useApiPaginatedQuery, useApiMutation } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { ComisionData } from "@/types/comisions";
import {
    ChevronDown, ChevronUp,
    Search, ChevronLeft, ChevronRight, RefreshCw, Trash2, Users, Pencil
} from 'lucide-react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PermissionLevel, useUser } from "@/providers";
import { useDebouncedValue } from "@/shared/hooks";
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
    StickyTableHeader,
    TableRow,
    DetailsRow,
} from "@/shared/components/common";
import { RegisterComisionForm, type ComisionEditData } from "../components";

interface DeleteActionState {
    status: 'idle' | 'pending' | 'success' | 'error';
    error?: string;
    deletedId?: number;
}

const Comisiones = () => {
    const [selectedComision, setSelectedComision] = useState<ComisionData | null>(null);
    const [confirmationText, setConfirmationText] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [comisionToDelete, setComisionToDelete] = useState<number | null>(null);
    const [deletingPersonId, setDeletingPersonId] = useState<number | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [comisionToEdit, setComisionToEdit] = useState<ComisionEditData | null>(null);
    const { hasPermission, escuadrillaId } = useUser();
    const [isPending, startTransition] = useTransition();
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebouncedValue(searchQuery, 300);

    const [params, setParamsState] = useState({ limit: 20, offset: 0, comision_sk: null as number | null });
    const setParams = (newParams: Partial<typeof params>) => {
        setParamsState(prev => ({ ...prev, ...newParams }));
    };

    // Búsqueda en vivo (300ms): al dejar de teclear busca por ID y vuelve a la
    // 1ª página. El debounce lo encapsula useDebouncedValue.
    useEffect(() => {
        const sk = debouncedSearch.trim() ? parseInt(debouncedSearch, 10) : null;
        setParams({ comision_sk: sk != null && !Number.isNaN(sk) ? sk : null, offset: 0 });
    }, [debouncedSearch]);

    const query: Record<string, string | number> = { limit: params.limit, offset: params.offset };
    if (params.comision_sk != null) query.comision_sk = params.comision_sk;

    const {
        data: comisions,
        totalCount,
        isLoading,
        refetch,
    } = useApiPaginatedQuery<ComisionData>({
        path: "/comisiones",
        query,
        queryKey: queryKeys.comisiones.list(escuadrillaId ?? 0, params),
    });

    const itemsPerPage = params.limit;
    const currentPage = Math.floor(params.offset / itemsPerPage) + 1;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    // Ambas DELETE invalidan todo el dominio de comisiones de la escuadrilla
    // (lista y días, sin depender de los params de paginación). Los errores HTTP
    // los notifica el toast de useApiMutation.
    const invalidateKeys = [queryKeys.comisiones.all(escuadrillaId ?? 0)];
    const deleteComision = useApiMutation<void, { comisionId: number }>(
        'DELETE', (v) => `/comisiones/${v.comisionId}`,
        { invalidateKeys, successMessage: "Comisión eliminada con éxito." },
    );
    const deletePersona = useApiMutation<void, { personComisionSk: number }>(
        'DELETE', (v) => `/person-comisiones/${v.personComisionSk}`,
        { invalidateKeys },
    );

    const [, deleteAction, isDeleting] = React.useActionState<DeleteActionState, number>(
        async (_prev, comisionId) => {
            try {
                await deleteComision.mutateAsync({ comisionId });
                if (selectedComision?.comision_sk === comisionId) setSelectedComision(null);
                setConfirmationText('');
                setDeleteDialogOpen(false);
                setComisionToDelete(null);
                return { status: 'success', deletedId: comisionId };
            } catch (error) {
                // El error HTTP ya lo notifica el toast de useApiMutation.
                return { status: 'error', error: error instanceof Error ? error.message : 'Error' };
            }
        },
        { status: 'idle' }
    );

    const handleRowClick = (comision: ComisionData) => {
        setSelectedComision(selectedComision?.comision_sk === comision.comision_sk ? null : comision);
    };

    const handleRefresh = () => startTransition(() => { refetch(); });

    const openDeleteDialog = (comisionId: number) => {
        setComisionToDelete(comisionId);
        setConfirmationText('');
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (comisionToDelete && confirmationText === `eliminarcomision${comisionToDelete}`) {
            deleteAction(comisionToDelete);
        }
    };

    const handleDeletePersona = async (personComisionSk: number, personaNombre: string) => {
        setDeletingPersonId(personComisionSk);
        try {
            await deletePersona.mutateAsync({ personComisionSk });
            toast.success(`${personaNombre} eliminado/a de la comisión`);
        } catch {
            // El error HTTP ya lo notifica el toast de useApiMutation.
        } finally {
            setDeletingPersonId(null);
        }
    };

    const handleEditComision = (comision: ComisionData) => {
        setComisionToEdit(comision);
        setEditDialogOpen(true);
    };

    const handleEditDialogClose = () => {
        setEditDialogOpen(false);
        setComisionToEdit(null);
        refetch();
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="h-full p-3 sm:p-6 pb-8 flex flex-col">
            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Header */}
                <div className="mb-8 text-center flex-shrink-0">
                    <GradientTitle>Comisiones</GradientTitle>
                </div>

                {/* Controles */}
                <PageControls className="flex-shrink-0">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar por ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-card border-input border focus:border-ring focus:outline-none transition-all placeholder:text-muted-foreground text-foreground w-full pl-10 pr-4 py-2.5 rounded-xl"
                                    aria-label="Buscar comisión"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 items-center">
                            <ActionButton
                                variant="refresh"
                                icon={RefreshCw}
                                label="Actualizar"
                                onClick={(e) => {
                                    handleRefresh();
                                    const icon = e.currentTarget.querySelector("svg");
                                    if (icon) {
                                        icon.classList.remove("animate-spin-once");
                                        requestAnimationFrame(() => {
                                            icon.classList.add("animate-spin-once");
                                        });
                                    }
                                }}
                                disabled={isPending}
                                loading={isPending}
                            />
                        </div>
                    </div>
                </PageControls>

                {/* Tabla */}
                <PageTableContainer className="flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full" role="table">
                            <StickyTableHeader>
                            <tr>
                                <th className="text-left p-4 font-semibold text-table-header-foreground">ID</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Fecha Inicio</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Fecha Fin</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Días</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Lugar</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Tipo</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Esfuerzo</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground"></th>
                            </tr>
                            </StickyTableHeader>
                            <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : comisions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                        No se encontraron comisiones
                                    </td>
                                </tr>
                            ) : (
                                comisions.map((comision, idx) => (
                                    <React.Fragment key={comision.comision_sk}>
                                        <TableRow
                                            index={idx}
                                            isSelected={selectedComision?.comision_sk === comision.comision_sk}
                                            onClick={() => handleRowClick(comision)}
                                        >
                                            <td className="p-4">
                                                <span className="text-sm text-muted-foreground">{comision.comision_sk}</span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-muted-foreground">
                                                    {formatDate(comision.fecha_inicio)}
                                                </span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-muted-foreground">
                                                    {formatDate(comision.fecha_fin)}
                                                </span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-foreground">{comision.dias}</span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-foreground">{comision.lugar}</span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-muted-foreground">{comision.tipo}</span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs ${
                                                    comision.esfuerzo
                                                        ? 'bg-success-muted text-success-muted-foreground'
                                                        : 'bg-muted text-muted-foreground'
                                                }`}>
                                                    {comision.esfuerzo ? 'Sí' : 'No'}
                                                </span>
                                            </td>
                                            <td className="text-center p-4">
                                                {selectedComision?.comision_sk === comision.comision_sk ? (
                                                    <ChevronUp className="w-5 h-5 text-muted-foreground mx-auto" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-muted-foreground mx-auto" />
                                                )}
                                            </td>
                                        </TableRow>

                                        {selectedComision?.comision_sk === comision.comision_sk && (
                                            <DetailsRow colSpan={8}>
                                                        {/* Acciones */}
                                                        <div className="flex gap-4 mb-6 border-b border-details-border pb-4">
                                                            {hasPermission(PermissionLevel.ADMINISTRATIVO) && (
                                                                <>
                                                                    {/* Botón Editar */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleEditComision(comision);
                                                                        }}
                                                                        className="ml-auto pb-2 px-4 text-info hover:text-info/80 transition-all text-xs"
                                                                    >
                                                                        <Pencil className="pb-1 w-4 h-4 inline mr-1" />
                                                                        Editar
                                                                    </button>

                                                                    {/* Botón Eliminar */}
                                                                    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                                                                        <AlertDialogTrigger render={
                                                                            <button
                                                                                onClick={() => openDeleteDialog(comision.comision_sk)}
                                                                                className="pb-2 px-4 text-danger hover:text-danger/80 transition-all text-xs"
                                                                            >
                                                                                <Trash2 className="pb-1 w-4 h-4 inline mr-1" />
                                                                                Eliminar
                                                                            </button>
                                                                        } />
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle className="text-xl font-semibold">
                                                                                    ¿Estás absolutamente seguro?
                                                                                </AlertDialogTitle>
                                                                                <AlertDialogDescription>
                                                                                    Esta acción no se puede deshacer. Eliminará permanentemente la comisión{' '}
                                                                                    <span className="font-semibold text-foreground">ID: {comisionToDelete}</span>.
                                                                                    <br /><br />
                                                                                    Escribe: <strong className="text-danger">eliminarcomision{comisionToDelete}</strong>
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <Input
                                                                                placeholder="Escribe aquí..."
                                                                                value={confirmationText}
                                                                                onChange={(e) => setConfirmationText(e.target.value)}
                                                                                className="mt-4"
                                                                                disabled={isDeleting}
                                                                            />
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel
                                                                                    disabled={isDeleting}
                                                                                >
                                                                                    Cancelar
                                                                                </AlertDialogCancel>
                                                                                <AlertDialogAction
                                                                                    onClick={handleDeleteConfirm}
                                                                                    disabled={confirmationText !== `eliminarcomision${comisionToDelete}` || isDeleting}
                                                                                    className="bg-danger hover:bg-danger/90 text-danger-foreground"
                                                                                >
                                                                                    {isDeleting ? (
                                                                                        <span className="flex items-center gap-2">
                                                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                                                            Eliminando...
                                                                                        </span>
                                                                                    ) : 'Continuar'}
                                                                                </AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Personas participantes */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-2 text-foreground/80">
                                                                <Users className="w-5 h-5" />
                                                                <h3 className="font-semibold">Personas Participantes</h3>
                                                                <span className="text-sm text-muted-foreground">
                                                                    ({comision.personas_participantes?.length || 0})
                                                                </span>
                                                            </div>

                                                            {comision.personas_participantes && comision.personas_participantes.length > 0 ? (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                    {comision.personas_participantes
                                                                        .sort((a, b) => a.orden - b.orden)
                                                                        .map((persona) => (
                                                                            <div
                                                                                key={persona.person_comision_sk}
                                                                                className="bg-card/50 rounded-lg p-3 border border-border hover:bg-muted transition-colors group"
                                                                            >
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <span className="text-foreground/90 text-sm truncate block">
                                                                                            {persona.nombre}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                                                        <span className="text-muted-foreground text-xs">
                                                                                            #{persona.orden}
                                                                                        </span>
                                                                                        {hasPermission(PermissionLevel.ADMINISTRATIVO) && (
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleDeletePersona(
                                                                                                        persona.person_comision_sk,
                                                                                                        persona.nombre
                                                                                                    );
                                                                                                }}
                                                                                                disabled={deletingPersonId === persona.person_comision_sk}
                                                                                                className="p-1 rounded text-danger/60 hover:text-danger hover:bg-danger-muted transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                                                                                title={`Eliminar a ${persona.nombre} de la comisión`}
                                                                                            >
                                                                                                {deletingPersonId === persona.person_comision_sk ? (
                                                                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                                                                ) : (
                                                                                                    <Trash2 className="w-4 h-4" />
                                                                                                )}
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    }
                                                                </div>
                                                            ) : (
                                                                <div className="text-muted-foreground text-sm italic">
                                                                    No hay personas asignadas a esta comisión
                                                                </div>
                                                            )}
                                                        </div>
                                            </DetailsRow>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 bg-card/50 border-t border-border">
                            <div className="text-sm text-muted-foreground">
                                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} comisiones
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setParams({ offset: Math.max(0, params.offset - itemsPerPage) })}
                                    disabled={currentPage === 1 || isPending}
                                    className={`p-2 rounded-lg transition-colors ${
                                        currentPage === 1 || isPending
                                            ? 'text-muted-foreground/30 cursor-not-allowed'
                                            : 'text-foreground hover:bg-muted'
                                    }`}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum = totalPages <= 5
                                            ? i + 1
                                            : currentPage <= 3
                                                ? i + 1
                                                : currentPage >= totalPages - 2
                                                    ? totalPages - 4 + i
                                                    : currentPage - 2 + i;
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setParams({ offset: (pageNum - 1) * itemsPerPage })}
                                                disabled={isPending}
                                                className={`px-3 py-1 rounded-lg transition-colors ${
                                                    currentPage === pageNum
                                                        ? 'bg-primary/20 text-foreground'
                                                        : 'text-muted-foreground hover:bg-muted'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => setParams({ offset: Math.min((totalPages - 1) * itemsPerPage, params.offset + itemsPerPage) })}
                                    disabled={currentPage === totalPages || isPending}
                                    className={`p-2 rounded-lg transition-colors ${
                                        currentPage === totalPages || isPending
                                            ? 'text-muted-foreground/30 cursor-not-allowed'
                                            : 'text-foreground hover:bg-muted'
                                    }`}
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </PageTableContainer>
            </div>

            {/* Dialog para editar comisión */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px] p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle className="text-xl font-semibold">
                            Editar Comisión #{comisionToEdit?.comision_sk}
                        </DialogTitle>
                    </DialogHeader>
                    <RegisterComisionForm
                        onClose={handleEditDialogClose}
                        editData={comisionToEdit}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Comisiones;
