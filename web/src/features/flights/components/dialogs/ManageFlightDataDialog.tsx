// Gestión de datos generales de vuelo (lugares, aeronaves, eventos).
// Cada tab vive en ./manage-flight-data/; aquí solo la navegación de tabs
// y la confirmación de borrado compartida.

import React, { useState } from 'react';
import { useLogger } from '@/lib/logger';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
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
import { Loader2, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiMutation } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useEscuadrilla } from "@/providers";
import { type DeleteTarget, type TabId } from './manage-flight-data/shared';
import { PlacesTab } from './manage-flight-data/PlacesTab';
import { AircraftsTab } from './manage-flight-data/AircraftsTab';
import { EventsTab } from './manage-flight-data/EventsTab';

interface ManageFlightDataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const TABS: { id: TabId; label: string }[] = [
    { id: 'lugares', label: 'Lugares' },
    { id: 'aeronaves', label: 'Aeronaves' },
    { id: 'eventos', label: 'Eventos' },
];

export default function ManageFlightDataDialog({ open, onOpenChange }: ManageFlightDataDialogProps): React.ReactElement {
    const log = useLogger('ManageFlightDataDialog');
    const { id: escId } = useEscuadrilla();

    // DELETE de los tres tipos. invalidateKeys es estático, así que cubre las
    // claves de los tres lookups (lista de gestión + selector del formulario de
    // vuelo) de una vez; invalidar una clave sin observadores activos es un
    // no-op, así que sobra-invalidar es inocuo y evita tres mutaciones aparte.
    const deleteItem = useApiMutation<void, DeleteTarget>(
        'DELETE',
        (t) =>
            t.type === 'lugares' ? `/lookups/departure-arrival-places/${t.sk}`
            : t.type === 'aeronaves' ? `/lookups/aircrafts/${t.sk}`
            : `/events/${t.sk}`,
        {
            invalidateKeys: [
                queryKeys.lookups.departureArrivalPlaces(escId ?? 0),
                queryKeys.lookups.aircrafts(escId ?? 0),
                queryKeys.lookups.aircraftsManage(escId ?? 0),
                queryKeys.lookups.eventsLookup(escId ?? 0),
                queryKeys.lookups.eventsManage(escId ?? 0),
            ],
        },
    );

    const [activeTab, setActiveTab] = useState<TabId>('lugares');
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

    const handleClose = () => {
        setActiveTab('lugares');
        setDeleteTarget(null);
        onOpenChange(false);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        const target = deleteTarget;
        setDeleteTarget(null);
        try {
            await deleteItem.mutateAsync(target);
            log.info(`Eliminado: ${target.label}`);
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error eliminando ${target.type}: ${err}`);
        }
    };

    const tabDescriptions: Record<TabId, string> = {
        lugares: 'Gestiona los lugares disponibles para los selectores de salida y llegada.',
        aeronaves: 'Gestiona las aeronaves disponibles para el registro de vuelos.',
        eventos: 'Gestiona los eventos disponibles para el registro de vuelos.',
    };

    return (
        <>
            <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); else onOpenChange(true); }}>
                <DialogContent
                    overlayClassName="bg-black/5! supports-backdrop-filter:backdrop-blur-sm!"
                    className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl ring-2 ring-foreground/20"
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Database className="w-5 h-5" />
                            Gestión de datos generales de vuelo
                        </DialogTitle>
                        <DialogDescription>
                            {tabDescriptions[activeTab]}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Tab navigation */}
                    <div className="flex border-b border-border -mx-1 px-1">
                        {TABS.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setActiveTab(id)}
                                className={cn(
                                    "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                                    activeTab === id
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-2">
                        {activeTab === 'lugares' && (
                            <PlacesTab onDeleteRequest={setDeleteTarget} />
                        )}
                        {activeTab === 'aeronaves' && (
                            <AircraftsTab onDeleteRequest={setDeleteTarget} />
                        )}
                        {activeTab === 'eventos' && (
                            <EventsTab onDeleteRequest={setDeleteTarget} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirmación de eliminación compartida */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar elemento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget && (
                                <>
                                    Vas a eliminar <strong>{deleteTarget.label}</strong>.
                                    {' '}Esta acción fallará si el elemento está siendo usado en vuelos registrados.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteItem.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={deleteItem.isPending}
                            className="bg-danger text-danger-foreground hover:bg-danger/90"
                        >
                            {deleteItem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
