import React, {useState, useTransition} from 'react';
import {useApiPaginatedQuery} from "@/lib/apiQuery";
import {queryKeys} from "@/lib/queryKeys";
import {transformPapeletasFromDB} from "@/features";
import {Papeleta} from "@/types/papeleta";
import {http} from "@/lib/http";
import {useEscuadrilla} from "@/providers";
import {toast} from "sonner";
import {ChevronDown, ChevronUp, Download, Edit, RefreshCw, TicketPlus} from "lucide-react";
import {PermissionLevel, useUser} from "@/providers";
import { AddEditPapeletaForm, type PapeletaFormValues } from "@/features";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
    PageCard,
    PageCardLabel,
    StickyTableHeader,
    TableRow,
    DetailsRow,
    SearchInput,
    PlanBadge,
    RoleBadge,
} from "@/shared/components/common";

const Papeletas = () => {
    const [selectedPapeleta, setSelectedPapeleta] = useState<Papeleta | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { hasPermission } = useUser();
    const { id: escId } = useEscuadrilla();
    const [, startTransition] = useTransition();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingPapeleta, setEditingPapeleta] = useState<Papeleta | null>(null);
    const [filterBlock, setFilterBlock] = useState<string>('Todos los bloques');
    const [filterPlan, setFilterPlan] = useState<string>('Todos los planes');

    const {
        data: papeletas = [],
        isLoading,
        isFetching,
        refetch,
    } = useApiPaginatedQuery<Papeleta>({
        path: "/papeletas",
        queryKey: queryKeys.papeletas.list(escId ?? 0, {}),
        transform: transformPapeletasFromDB,
    });

    const handlePapeletaSubmit = async (data: PapeletaFormValues) => {
        try {
            const payload = { ...data };

            if (editingPapeleta) {
                await http("PUT", `/papeletas/${editingPapeleta.papeleta_sk}`, { body: payload });
                toast.success("Papeleta editada correctamente");
            } else {
                await http("POST", "/papeletas", { body: payload });
                toast.success("Papeleta añadida correctamente");
            }

            await refetch();
            setDrawerOpen(false);
            setEditingPapeleta(null);
            setSelectedPapeleta(null);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error al guardar";
            toast.error(msg);
        }
    };

    const handleAddClick = () => {
        setEditingPapeleta(null);
        setDrawerOpen(true);
    };

    const handleEditClick = (person: Papeleta) => {
        setEditingPapeleta(person);
        setDrawerOpen(true);
    };

    const filteredPapeletas = (() => {
        const normalize = (str: string) =>
            str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        const searchLower = searchTerm ? normalize(searchTerm) : '';

        return papeletas.filter(p => {
            const normalizedName = normalize(`${p.papeleta_name}`);
            const normalizedDescription = normalize(`${p.papeleta_description}`);

            const matchesSearch = !searchTerm ||
                normalizedName.includes(searchLower) ||
                normalizedDescription.includes(searchLower);

            const matchesBlock = filterBlock === 'Todos los bloques' || p.papeleta_block === filterBlock;
            const matchesPlan = filterPlan === 'Todos los planes' || p.papeleta_plan === filterPlan;

            return matchesSearch && matchesBlock && matchesPlan;
        });
    })();


    const handleRowClick = (papeleta: Papeleta) => {
        setSelectedPapeleta(prev => prev?.papeleta_sk === papeleta.papeleta_sk ? null : papeleta);
    };

    const handleRefresh = () => startTransition(() => { refetch(); });

    const exportToCSV = () => {
        if (filteredPapeletas.length === 0) {
            toast.info("No hay datos para exportar");
            return;
        }

        const escapeCSV = (value: any): string => {
            const str = String(value ?? "");
            return `"${str.replace(/"/g, '""')}"`;
        };

        const headers = [
            "ID", "Nombre", "Descripción", "Plan", "Bloque", "CRP",
            "Tiempo de vuelo", "Vigencia"
        ];

        const rows = filteredPapeletas.map(p => [
            p.papeleta_sk,
            p.papeleta_name,
            p.papeleta_description,
            p.papeleta_plan,
            p.papeleta_block,
            p.papeleta_pilot_crp_value,
            p.papeleta_dv_crp_value,
            p.papeleta_tv,
            p.papeleta_expiration
        ]);

        const csvContent = [
            headers.map(escapeCSV).join(";"),
            ...rows.map(row => row.map(escapeCSV).join(";"))
        ].join("\n");

        const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const fechaFormateada = new Date()
            .toLocaleDateString('es-ES')
            .split('/')
            .join('-');
        link.download = `papeletas_${fechaFormateada}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Exportados ${filteredPapeletas.length} registros a CSV en la carpeta de Descargas`);
    };

    const renderPlanBadge = (plan: string | null) => {
        if (!plan) {
            return <span className="text-sm text-muted-foreground">—</span>;
        }

        switch (plan) {
            case 'Adiestramiento Básico':
                return <RoleBadge role="crew">{plan}</RoleBadge>;
            case 'Adiestramiento Avanzado':
                return <RoleBadge role="pilot">{plan}</RoleBadge>;
            case 'Instrucción 1 Piloto':
                return <PlanBadge plan="instruction1-pilot">{plan}</PlanBadge>;
            case 'Instrucción 2 Piloto':
                return <PlanBadge plan="instruction2-pilot">{plan}</PlanBadge>;
            case 'Instrucción 1 Dotación':
                return <PlanBadge plan="instruction1-dv">{plan}</PlanBadge>;
            case 'Instrucción 2 Dotación':
                return <PlanBadge plan="instruction2-dv">{plan}</PlanBadge>;
            default:
                return <RoleBadge role="default">{plan}</RoleBadge>;
        }
    };

    // Función helper para preparar los defaultValues
    const prepareDefaultValues = (papeleta: Papeleta): Partial<PapeletaFormValues> => {
        return {
            papeleta_name: papeleta.papeleta_name,
            papeleta_description: papeleta.papeleta_description,
            papeleta_block: papeleta.papeleta_block,
            papeleta_plan: papeleta.papeleta_plan ?? undefined,
            papeleta_tv: papeleta.papeleta_tv ?? undefined,
            papeleta_pilot_crp_value: papeleta.papeleta_pilot_crp_value ?? undefined,
            papeleta_dv_crp_value: papeleta.papeleta_dv_crp_value ?? undefined,
            papeleta_expiration: papeleta.papeleta_expiration ?? undefined,
        };
    };

    const blockOptions = [...new Set(
        papeletas
            .map(p => p.papeleta_block)
            .filter((block): block is string => block !== null && block !== undefined && block.trim() !== '')
    )].sort();

    const planOptions = [...new Set(
        papeletas
            .map(p => p.papeleta_plan)
            .filter((plan): plan is string => plan !== null && plan !== undefined && plan.trim() !== '')
    )].sort();

    return (
        <div className="h-full overflow-y-auto p-6 pb-8">
            <div className="w-full mx-auto">
                {/* Header */}
                <div className="mb-8 text-center">
                    <GradientTitle>Papeletas</GradientTitle>
                </div>

                {/* Controles */}
                <PageControls>
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <SearchInput
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por Nombre o Descripción..."
                            />
                        </div>


                        {/* Filtro por Plan */}
                        <Select value={filterPlan} onValueChange={(value) => setFilterPlan(value ?? 'Todos los planes')}>
                            <SelectTrigger className="min-w-[200px]">
                                <SelectValue/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Todos los planes">
                                    <span className="text-gray-700 dark:text-gray-300">Todos los planes</span>
                                </SelectItem>
                                {planOptions.map((plan) => (
                                    <SelectItem key={plan} value={plan}>
                                        <span className="text-gray-700 dark:text-gray-300">{plan}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Filtro por Bloque */}
                        <Select value={filterBlock} onValueChange={(value) => setFilterBlock(value ?? 'Todos los bloques')}>
                            <SelectTrigger className="min-w-[200px]">
                                <SelectValue/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Todos los bloques">
                                    <span>Todos los bloques</span>
                                </SelectItem>
                                {blockOptions.map((block) => (
                                    <SelectItem key={block} value={block}>
                                        <span>{block}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>


                        <div className="flex flex-wrap gap-3 items-center">
                            <ActionButton
                                variant="refresh"
                                icon={RefreshCw}
                                label="Refrescar"
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
                                disabled={isFetching}
                                loading={isFetching}
                            />

                            <ActionButton
                                variant="export"
                                icon={Download}
                                label="Exportar CSV"
                                onClick={exportToCSV}
                            />

                            {hasPermission(PermissionLevel.OPERACIONAL) && (
                                <>
                                    <ActionButton
                                        variant="add"
                                        icon={TicketPlus}
                                        label="Añadir"
                                        onClick={handleAddClick}
                                    />

                                    <AddEditPapeletaForm
                                        open={drawerOpen}
                                        onOpenChange={(open) => {
                                            setDrawerOpen(open);
                                            if (!open) {
                                                setEditingPapeleta(null);
                                            }
                                        }}
                                        defaultValues={editingPapeleta ? prepareDefaultValues(editingPapeleta) : undefined}
                                        onSubmit={handlePapeletaSubmit}
                                        title={editingPapeleta ? "Editar Papeleta" : "Añadir Papeleta"}
                                        description={editingPapeleta ? "Modifica los campos necesarios." : "Complete todos los campos para añadir una nueva papeleta."}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </PageControls>

                {/* Tabla */}
                <PageTableContainer>
                    <table className="w-full" role="table">
                        <StickyTableHeader offset="topbar">
                        <tr>
                            <th className="text-left p-4 font-semibold text-table-header-foreground">ID</th>
                            <th className="text-center p-4 font-semibold text-table-header-foreground">Nombre</th>
                            <th className="text-center p-4 font-semibold text-table-header-foreground">Descripción</th>
                            <th className="text-center p-4 font-semibold text-table-header-foreground">Plan</th>
                            <th className="text-center p-4 font-semibold text-table-header-foreground"></th>
                        </tr>
                        </StickyTableHeader>
                        <tbody>
                        {isLoading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Cargando...</td></tr>
                        ) : filteredPapeletas.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No se encontraron papeletas</td></tr>
                        ) : (
                            filteredPapeletas.map((papeleta, idx) => (
                                <React.Fragment key={papeleta.papeleta_sk}>
                                    <TableRow
                                        index={idx}
                                        isSelected={selectedPapeleta?.papeleta_sk === papeleta.papeleta_sk}
                                        onClick={() => handleRowClick(papeleta)}
                                    >
                                        <td className="p-4">
                                            <span className="text-sm text-muted-foreground">{papeleta.papeleta_sk}</span>
                                        </td>
                                        <td className="text-center p-4">
                                            <span className="text-sm text-foreground">{papeleta.papeleta_name}</span>
                                        </td>
                                        <td className="text-center p-4">
                                            <span className="text-sm text-foreground">{papeleta.papeleta_description}</span>
                                        </td>
                                        <td className="text-center p-4">
                                            {renderPlanBadge(papeleta.papeleta_plan)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {selectedPapeleta?.papeleta_sk === papeleta.papeleta_sk ? (
                                                <ChevronUp className="w-5 h-5 text-muted-foreground mx-auto" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-muted-foreground mx-auto" />
                                            )}
                                        </td>
                                    </TableRow>

                                    {selectedPapeleta?.papeleta_sk === papeleta.papeleta_sk && (
                                        <DetailsRow colSpan={5}>
                                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${
                                                hasPermission(PermissionLevel.OPERACIONAL) ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
                                            }`}>
                                                {/* Primer cuadro */}
                                                <PageCard>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <PageCardLabel>Bloque</PageCardLabel>
                                                            <p className="text-sm text-foreground">{papeleta.papeleta_block}</p>
                                                        </div>
                                                        <div>
                                                            <PageCardLabel>Tiempo de vuelo</PageCardLabel>
                                                            <p className="text-sm text-foreground">{papeleta.papeleta_tv}</p>
                                                        </div>
                                                    </div>
                                                </PageCard>

                                                {/* Segundo cuadro */}
                                                <PageCard>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <PageCardLabel>CRP Piloto</PageCardLabel>
                                                            <p className="text-sm text-foreground">
                                                                {papeleta.papeleta_pilot_crp_value + ' %'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <PageCardLabel>CRP Dotación</PageCardLabel>
                                                            <p className="text-sm text-foreground">
                                                                {papeleta.papeleta_dv_crp_value + ' %'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <PageCardLabel>Vigencia</PageCardLabel>
                                                            <p className="text-sm text-foreground">{papeleta.papeleta_expiration}</p>
                                                        </div>
                                                    </div>
                                                </PageCard>

                                                {/* Acciones */}
                                                {hasPermission(PermissionLevel.OPERACIONAL) && (
                                                    <div className="flex flex-col justify-center gap-3">
                                                        <ActionButton
                                                            variant="edit"
                                                            icon={Edit}
                                                            iconSize={16}
                                                            label="Editar"
                                                            aria-label="Editar papeleta"
                                                            onClick={() => handleEditClick(papeleta)}
                                                            className="items-center justify-center"
                                                        />
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
                </PageTableContainer>

                {/* Contador */}
                <div className="text-center text-sm text-muted-foreground">
                    Mostrando {filteredPapeletas.length} de {papeletas.length} papeletas
                </div>
            </div>
        </div>
    );
};

export default Papeletas;
