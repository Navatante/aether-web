import { cn } from "@/lib/utils";

// Modelo compartido de los cuadros de instrucción/adiestramiento (pilotos y dotaciones):
// etiqueta de plan, color por bloque y las piezas de tabla comunes (badge + fila divisoria).

// "Instrucción 1 Piloto" / "Instrucción 1 Dotación" -> "Plan de Instrucción 1"
export function planLabel(plan: string): string {
    const cleaned = plan.replace(/\s*(Dotación\/Nadador|Dotación|Piloto)$/i, '').trim();
    return `Plan de ${cleaned}`;
}

// Clases de color por bloque (tokens definidos en theme.css). Se escriben los nombres
// de clase completos para que el JIT de Tailwind los genere.
export function blockBadgeClass(block: string): string {
    const b = block.toLowerCase();
    if (b.includes('entrenador')) return 'bg-block-entrenador text-block-entrenador-foreground';
    if (b.includes('simulador')) return 'bg-block-simulador text-block-simulador-foreground';
    if (b.includes('teórico') || b.includes('teorico')) return 'bg-block-teorico text-block-teorico-foreground';
    if (b.includes('práctico') || b.includes('practico')) return 'bg-block-practico text-block-practico-foreground';
    if (b.includes('vuelo')) return 'bg-block-vuelo text-block-vuelo-foreground';
    return 'bg-block-default text-block-default-foreground';
}

// Ordena papeletas por plan y, dentro de cada plan, por papeleta_order
// (las que no tienen orden van al final) y, a igualdad, por nombre.
export function byPlanThenName<
    T extends { papeleta_plan: string; papeleta_name: string; papeleta_order?: number | null }
>(a: T, b: T): number {
    const planCmp = a.papeleta_plan.localeCompare(b.papeleta_plan);
    if (planCmp !== 0) return planCmp;
    const ao = a.papeleta_order ?? Number.POSITIVE_INFINITY;
    const bo = b.papeleta_order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.papeleta_name.localeCompare(b.papeleta_name);
}

// Badge de color que identifica el bloque de una papeleta.
export function BlockBadge({ block }: { block: string }) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                blockBadgeClass(block),
            )}
        >
            {block}
        </span>
    );
}

// Fila divisoria que titula el grupo de papeletas de un plan. Ocupa toda la tabla;
// el texto va sticky a la izquierda para seguir visible al hacer scroll horizontal.
export function PlanDividerRow({ plan, colSpan }: { plan: string; colSpan: number }) {
    return (
        <tr className="bg-table-header">
            <td colSpan={colSpan} className="p-0 border-b border-border">
                <div className="sticky left-0 inline-block px-4 py-2 text-sm font-semibold uppercase tracking-wide text-table-header-foreground">
                    {planLabel(plan)}
                </div>
            </td>
        </tr>
    );
}
