import { RefreshCw } from 'lucide-react'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import type { FuelSummary as FuelSummaryData } from '@/types/generated/fuel'

interface FuelSummaryProps {
    summary: FuelSummaryData
    isLoading?: boolean
    /** Etiqueta del mes mostrado (p. ej. "Junio 2026"). */
    periodLabel: string
}

const fmtLitros = (n: number) => n.toLocaleString('es-ES')

/**
 * Informe de combustible del mes: una tabla seccionada por pagador (filas de
 * detalle Evento·Fase·Lugar·Cantidad + subtotal por pagador) con un único total
 * general, más una banda de totales por tipo de lugar. Todo en una sola vista.
 */
export default function FuelSummary({ summary, isLoading = false, periodLabel }: FuelSummaryProps) {
    const { payers, grand_total } = summary
    const isEmpty = payers.length === 0

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-foreground">Resumen de combustible</CardTitle>
                <CardDescription>Litros repostados en {periodLabel}, por pagador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        {/* Informe seccionado por pagador */}
                        <div className="rounded-lg border border-border overflow-x-auto">
                            <table className="w-full min-w-[680px]">
                                <thead>
                                    <tr className="bg-table-header">
                                        <th className="px-4 py-2 text-left text-sm font-semibold text-table-header-foreground">Pagador</th>
                                        <th className="px-4 py-2 text-left text-sm font-semibold text-table-header-foreground">Evento</th>
                                        <th className="px-4 py-2 text-left text-sm font-semibold text-table-header-foreground">Fase</th>
                                        <th className="px-4 py-2 text-left text-sm font-semibold text-table-header-foreground">Lugar</th>
                                        <th className="px-4 py-2 text-right text-sm font-semibold text-table-header-foreground">Litros</th>
                                    </tr>
                                </thead>
                                {isEmpty ? (
                                    <tbody>
                                        <tr>
                                            <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                Sin repostajes este mes
                                            </td>
                                        </tr>
                                    </tbody>
                                ) : (
                                    payers.map((g) => (
                                        <tbody key={g.payer} className="border-t border-border">
                                            {g.rows.map((r, idx) => (
                                                <tr key={`${r.event}-${r.phase}-${r.place_name}-${idx}`} className="border-t border-border/40">
                                                    <td className="px-4 py-2 text-sm text-foreground align-top">{idx === 0 ? g.payer : ''}</td>
                                                    <td className="px-4 py-2 text-sm text-muted-foreground">
                                                        {r.event}
                                                        <span className="block text-xs text-muted-foreground/70">{r.event_place}</span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-muted-foreground">{r.phase}</td>
                                                    <td className="px-4 py-2 text-sm text-muted-foreground">
                                                        {r.place_name}
                                                        <span className="block text-xs text-muted-foreground/70">{r.place_type}</span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-right text-foreground font-mono tabular-nums whitespace-nowrap">
                                                        {fmtLitros(r.qty)}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-muted/30">
                                                <td colSpan={4} className="px-4 py-2 text-sm text-right font-medium text-foreground">
                                                    Subtotal {g.payer}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-right font-medium text-foreground font-mono tabular-nums whitespace-nowrap">
                                                    {fmtLitros(g.subtotal)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    ))
                                )}
                                {!isEmpty && (
                                    <tfoot>
                                        <tr className="border-t-2 border-border bg-muted/50">
                                            <td colSpan={4} className="px-4 py-2.5 text-sm text-right font-semibold text-foreground">
                                                TOTAL GENERAL
                                            </td>
                                            <td className="px-4 py-2.5 text-sm text-right font-semibold text-foreground font-mono tabular-nums whitespace-nowrap">
                                                {fmtLitros(grand_total)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
