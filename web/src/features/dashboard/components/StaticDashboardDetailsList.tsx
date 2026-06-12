import { cn } from "@/lib/utils";

export interface DetailItem {
    label: string;
    value: number | string;
    indent?: boolean;
}

interface StatDetailsListProps {
    items: DetailItem[];
    className?: string;
}

/**
 * Lista de detalles para StatsCard.
 * Soporta jerarquía visual mediante la prop `indent`.
 */
function StaticDashboardDetailsList({
    items,
    className,
}: StatDetailsListProps) {
    return (
        <dl className={cn("mt-3 space-y-1.5", className)}>
            {items.map((item, idx) => (
                <div
                    key={idx}
                    className={cn(
                        "flex justify-between items-baseline text-sm",
                        item.indent
                            ? "pl-3 ml-1 border-l-2 border-muted/50 text-muted-foreground/80"
                            : "text-muted-foreground"
                    )}
                >
                    <dt className="truncate pr-2">{item.label}</dt>
                    <dd className="font-medium tabular-nums text-foreground/70">
                        {item.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

export default StaticDashboardDetailsList;
