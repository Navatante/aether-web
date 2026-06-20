// Botón de selección de motivo de ausencia (con icono especial para Vuelo
// día/noche). Render puro; el padre controla selección y onClick.

import { type AbsenceReason, EMOJI_MOON, EMOJI_SUN } from '../../../absences';

interface ReasonButtonProps {
    reasonKey: string;
    value: AbsenceReason;
    isSelected: boolean;
    onClick: () => void;
}

export function ReasonButton({ reasonKey, value, isSelected, onClick }: ReasonButtonProps) {
    const isVueloDia = reasonKey === 'Vuelo día';
    const isVueloNoche = reasonKey === 'Vuelo noche';

    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all text-left ${
                isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/50'
            }`}
        >
            {isVueloDia ? (
                <span className="text-base">{EMOJI_SUN}</span>
            ) : isVueloNoche ? (
                <span className="text-base">{EMOJI_MOON}</span>
            ) : (
                <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: value.color }}
                />
            )}
            <span className="text-sm">{value.label}</span>
        </button>
    );
}
