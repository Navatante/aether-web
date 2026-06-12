import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const toggleButtonVariants = cva(
    "rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm cursor-pointer transition-all",
    {
        variants: {
            variant: {
                // Escala (selección genérica, es la que se usa para Pilotos y Dotaciones en Adiestramiento e Instruccion)
                escala: "",
                // Características
                b1: "",
                b2: "",
                lv: "",
                // Roles
                piloto: "",
                dotacion: "",
                nadador: "",
                "dotacion-nadador": "",
                "no-tripulante": "",
            },
            selected: {
                true: "",
                false: "bg-muted text-muted-foreground hover:bg-muted/80",
            },
        },
        compoundVariants: [
            // Escala seleccionado
            { variant: "escala", selected: true, className: "bg-escala text-escala-foreground" },
            // Características seleccionadas
            { variant: "b1", selected: true, className: "bg-caracteristica-b1 text-caracteristica-b1-foreground" },
            { variant: "b2", selected: true, className: "bg-caracteristica-b2 text-caracteristica-b2-foreground" },
            { variant: "lv", selected: true, className: "bg-caracteristica-lv text-caracteristica-lv-foreground" },
            // Roles seleccionados
            { variant: "piloto", selected: true, className: "bg-role-pilot text-role-pilot-foreground" },
            { variant: "dotacion", selected: true, className: "bg-role-crew text-role-crew-foreground" },
            { variant: "nadador", selected: true, className: "bg-role-swimmer text-role-swimmer-foreground" },
            { variant: "dotacion-nadador", selected: true, className: "bg-gradient-to-r from-role-crew to-role-swimmer text-role-crew-foreground" },
            { variant: "no-tripulante", selected: true, className: "bg-role-no-crew text-role-no-crew-foreground" },
        ],
        defaultVariants: {
            variant: "escala",
            selected: false,
        },
    }
)

// Mapeo de label a variant para uso simplificado
const labelToVariant: Record<string, VariantProps<typeof toggleButtonVariants>["variant"]> = {
    // Escalas - todas usan la misma variante
    "Oficiales": "escala",
    "Suboficiales": "escala",
    "Tropa y marinería": "escala",
    // Características
    "B1": "b1",
    "B2": "b2",
    "LV": "lv",
    // Roles
    "Piloto": "piloto",
    "Dotación": "dotacion",
    "Nadador": "nadador",
    "Dotación/Nadador": "dotacion-nadador",
    "No Tripulante": "no-tripulante",
}

export interface ToggleButtonProps extends Omit<VariantProps<typeof toggleButtonVariants>, "selected"> {
    label: string
    isSelected: boolean
    onClick: () => void
    className?: string
}

export function ToggleButton({
    label,
    isSelected,
    onClick,
    variant,
    className,
}: ToggleButtonProps) {
    // Auto-detectar variante basada en label si no se especifica
    const resolvedVariant = variant ?? labelToVariant[label] ?? "escala"

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                toggleButtonVariants({ variant: resolvedVariant, selected: isSelected }),
                className
            )}
        >
            {label}
        </button>
    )
}

// Componente de grupo para filtros múltiples (Usado en DiasDeComision.tsx y Esfuerzo.tsx)
export interface ToggleButtonGroupProps {
    items: string[]
    selectedItems: Set<string>
    onToggle: (item: string) => void
    className?: string
}

export function ToggleButtonGroup({
    items,
    selectedItems,
    onToggle,
    className,
}: ToggleButtonGroupProps) {
    return (
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
            {items.map((item) => (
                <ToggleButton
                    key={item}
                    label={item}
                    isSelected={selectedItems.has(item)}
                    onClick={() => onToggle(item)}
                />
            ))}
        </div>
    )
}
