import { Loader2 } from "lucide-react"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { useApiQuery } from "@/lib/apiQuery"
import { queryKeys } from "@/lib/queryKeys"
import { useEscuadrilla } from "@/providers"
import { StickyTableHeader, TableRow, formatDateDisplay } from "@/shared/components/common"
import type { ComisionBreakdownItem } from "@/types/comisions"
import type { ViewMode } from "../ViewModeToggleComisionLists"

interface BreakdownPersona {
    person_sk: number
    label: string   // "RANGO Nombre Apellidos"
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    persona: BreakdownPersona | null
    categoria: ViewMode
    fechaFin: string
}

export default function ComisionDiasBreakdownDialog({ open, onOpenChange, persona, categoria, fechaFin }: Props) {
    const { id: escId } = useEscuadrilla()

    const query = { person: persona?.person_sk, categoria, fechaFin }
    const { data, isLoading, isError } = useApiQuery<{ items: ComisionBreakdownItem[] }>(
        "GET",
        "/comisiones/dias/breakdown",
        { enabled: open && persona != null, query },
        queryKeys.comisiones.dias.breakdown(escId ?? 0, query),
    )

    const items = data?.items ?? []
    const total = items.reduce((acc, it) => acc + it.dias, 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-auto max-w-[calc(100%-2rem)] sm:max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
                    <DialogTitle>{persona?.label ?? "Desglose de días"}</DialogTitle>
                    <DialogDescription>{categoria}</DialogDescription>
                </DialogHeader>

                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full" role="table">
                            <StickyTableHeader>
                                <tr>
                                    <th className="text-left p-3 font-semibold text-table-header-foreground">Código</th>
                                    <th className="text-left p-3 font-semibold text-table-header-foreground">Lugar</th>
                                    <th className="text-left p-3 font-semibold text-table-header-foreground">Fechas</th>
                                    <th className="text-right p-3 font-semibold text-table-header-foreground">Días</th>
                                </tr>
                            </StickyTableHeader>
                            <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center">
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    </td>
                                </tr>
                            ) : isError ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-danger">
                                        No se pudo cargar el desglose
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                        No hay comisiones para esta categoría
                                    </td>
                                </tr>
                            ) : (
                                items.map((it, idx) => (
                                    <TableRow key={it.comision_sk} index={idx} className="cursor-default">
                                        <td className="p-3 text-sm text-foreground">
                                            {it.comision_code || "—"}
                                        </td>
                                        <td className="p-3 text-sm text-foreground">{it.lugar}</td>
                                        <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">
                                            {formatDateDisplay(it.start_date)} – {formatDateDisplay(it.end_date)}
                                        </td>
                                        <td className="p-3 text-right font-mono font-semibold text-foreground">
                                            {it.dias}
                                        </td>
                                    </TableRow>
                                ))
                            )}
                            </tbody>
                            {items.length > 0 && (
                                <tfoot>
                                    <tr className="border-t border-border bg-table-header">
                                        <td colSpan={3} className="p-3 text-right text-sm font-medium text-muted-foreground">
                                            Total
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-lg text-foreground">
                                            {total}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
