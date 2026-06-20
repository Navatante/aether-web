import React from 'react';
import {
    ChevronDown, ChevronUp,
    ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
    StickyTableHeader,
    TableRow,
    DetailsRow,
    SearchInput,
    EventBadge,
} from "@/shared/components/common";
import { useFlightsPage } from "../hooks/useFlightsPage";
import { FlightDetailPanel } from "../components/FlightDetailPanel";
import { formatDateTimeSpain, getEventType } from "../utils/flightDisplay";

const Flights = () => {
    const page = useFlightsPage();
    const {
        flights, totalCount, isLoading,
        selectedFlight, handleRowClick,
        activeTab, setActiveTab,
        canDeleteFlights,
        deleteDialogOpen, setDeleteDialogOpen,
        confirmationText, setConfirmationText,
        flightToDelete, openDeleteDialog, deleteAction, isDeleting,
        searchQuery, setSearchQuery,
        params, setParams, itemsPerPage, currentPage, totalPages,
        isPending, handleRefresh,
    } = page;

    const deleteControls = {
        flightToDelete,
        open: deleteDialogOpen,
        onOpenChange: setDeleteDialogOpen,
        onOpenDialog: openDeleteDialog,
        confirmationText,
        onConfirmationChange: setConfirmationText,
        onConfirm: deleteAction,
        isDeleting,
    };

    return (
        <div className="h-full p-3 sm:p-6 pb-8 flex flex-col">
            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Header */}
                <div className="mb-8 text-center flex-shrink-0">
                    <GradientTitle>Vuelos</GradientTitle>
                </div>

                {/* Controles */}
                <PageControls className="flex-shrink-0">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <SearchInput
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por ID..."
                            />
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
                        <table className="w-full min-w-[760px]" role="table">
                            <StickyTableHeader>
                            <tr>
                                <th className="text-left p-4 font-semibold text-table-header-foreground">ID</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Fecha</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Helicóptero</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Evento</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Comte Aeronave</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Horas</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground"></th>
                            </tr>
                            </StickyTableHeader>
                            <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                            ) : flights.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No se encontraron vuelos</td></tr>
                            ) : (
                                flights.map((flight, idx) => (
                                    <React.Fragment key={flight.id}>
                                        <TableRow
                                            index={idx}
                                            isSelected={selectedFlight?.id === flight.id}
                                            onClick={() => handleRowClick(flight)}
                                        >
                                            <td className="p-4">
                                                <span className="text-sm text-muted-foreground">{flight.id}</span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-muted-foreground">
                                                    {formatDateTimeSpain(flight.fecha, flight.hora)}
                                                </span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-muted-foreground">{flight.helicoptero}</span>
                                            </td>
                                            <td className="text-center p-4">
                                                <EventBadge type={getEventType(flight.evento)}>{flight.evento}</EventBadge>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-foreground">{flight.cteAeronave}</span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-muted-foreground">{flight.horas}h</span>
                                            </td>
                                            <td className="text-center p-4">
                                                {selectedFlight?.id === flight.id ? (
                                                    <ChevronUp className="w-5 h-5 text-muted-foreground mx-auto" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-muted-foreground mx-auto" />
                                                )}
                                            </td>
                                        </TableRow>

                                        {selectedFlight?.id === flight.id && (
                                            <DetailsRow colSpan={7}>
                                                <FlightDetailPanel
                                                    flight={flight}
                                                    activeTab={activeTab}
                                                    onTabChange={setActiveTab}
                                                    canDelete={canDeleteFlights}
                                                    deleteControls={deleteControls}
                                                />
                                            </DetailsRow>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-muted/50 border-t border-border">
                            <div className="text-sm text-muted-foreground">
                                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} vuelos
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setParams({ offset: Math.max(0, params.offset - itemsPerPage) })} disabled={currentPage === 1 || isPending} className={`p-2 rounded-lg transition-colors ${currentPage === 1 || isPending ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-foreground hover:bg-muted'}`}><ChevronLeft className="w-5 h-5" /></button>
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        const pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                                        return (
                                            <button key={pageNum} onClick={() => setParams({ offset: (pageNum - 1) * itemsPerPage })} disabled={isPending} className={`px-3 py-1 rounded-lg transition-colors ${currentPage === pageNum ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button onClick={() => setParams({ offset: Math.min((totalPages - 1) * itemsPerPage, params.offset + itemsPerPage) })} disabled={currentPage === totalPages || isPending} className={`p-2 rounded-lg transition-colors ${currentPage === totalPages || isPending ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-foreground hover:bg-muted'}`}><ChevronRight className="w-5 h-5" /></button>
                            </div>
                        </div>
                    )}
                </PageTableContainer>
            </div>
        </div>
    );
};

export default Flights;
