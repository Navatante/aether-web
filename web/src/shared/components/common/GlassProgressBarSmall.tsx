import { useState, useEffect, useRef } from "react";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import { getEtherealColors } from "./glassColors";

interface GlassProgressBarProps {
    type?: "crp" | "airflow";
    value?: number;
    className?: string;
    diasSinVueloReal?: number;
    diasSinSimulador?: number;
}

// Airflow color helper
function getAirflowColors(percentage: number) {
    if (percentage > 80) {
        return {
            liquidColor: "rgba(135,206,235,0.4)",
            liquidColorLight: "rgba(173,216,230,0.35)",
            liquidColorGlow: "rgba(135,206,235,0.6)",
        };
    }
    if (percentage >= 40) {
        return {
            liquidColor: "rgba(255,255,255,0.4)",
            liquidColorLight: "rgba(245,245,245,0.35)",
            liquidColorGlow: "rgba(255,255,255,0.6)",
        };
    }
    return {
        liquidColor: "rgba(105,105,105,0.4)",
        liquidColorLight: "rgba(128,128,128,0.35)",
        liquidColorGlow: "rgba(85,85,85,0.6)",
    };
}

// Calculate display values for airflow type
function calculateAirflowDisplay(value: number, diasSinVueloReal?: number, diasSinSimulador?: number) {
    if (value === -1) {
        return {
            displayPercentage: 0,
            percentageText: "0% Airflow",
            diasRealText: "No ha volado nunca",
            diasSimText: null as string | null,
        };
    }

    const daysWithoutFlying = Math.max(0, value);
    const percentage = Math.max(
        0,
        Math.min(100, 100 - (daysWithoutFlying / 60) * 100)
    );

    const diasRealText = diasSinVueloReal !== undefined
        ? (diasSinVueloReal === -1 ? "Nunca ha volado real" : `${diasSinVueloReal} días sin vuelo real`)
        : null;
    const diasSimText = diasSinSimulador !== undefined
        ? (diasSinSimulador === -1 ? "Nunca ha volado simulado" : `${diasSinSimulador} días sin simulador`)
        : null;

    return {
        displayPercentage: percentage,
        percentageText: `${Math.round(percentage)}% Airflow`,
        diasRealText,
        diasSimText,
    };
}

// Calculate display values for CRP type
function calculateCrpDisplay(value: number) {
    const percentage = Math.max(0, Math.min(100, value));
    return {
        displayPercentage: percentage,
        tooltipText: `${Math.round(percentage)}% CRP`,
    };
}

function GlassProgressBarSmall({
    type = "crp",
    value = 0,
    className = "",
    diasSinVueloReal,
    diasSinSimulador,
}: GlassProgressBarProps) {
    const [animatedValue, setAnimatedValue] = useState(0);
    const barRef = useRef<HTMLDivElement>(null);

    const airflowDisplay = type === "airflow"
        ? calculateAirflowDisplay(value, diasSinVueloReal, diasSinSimulador)
        : null;
    const crpDisplay = type === "crp" ? calculateCrpDisplay(value) : null;
    const displayPercentage = airflowDisplay?.displayPercentage ?? crpDisplay?.displayPercentage ?? 0;

    const airflowColors = getAirflowColors(displayPercentage);

    const etherealColors = getEtherealColors(displayPercentage);

    const { liquidColor, liquidColorLight, liquidColorGlow } = airflowColors;

    useEffect(() => {
        const timer = setTimeout(
            () => setAnimatedValue(displayPercentage),
            100
        );
        return () => clearTimeout(timer);
    }, [displayPercentage]);

    // ============================================
    // RENDER: Airflow content
    // ============================================
    const renderAirflowContent = () => (
        <>
            {/* Capa base - gradiente con parte superior más visible */}
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(180deg,
                        ${liquidColor} 0%,
                        ${liquidColor} 20%,
                        ${liquidColorLight} 50%,
                        ${liquidColorGlow} 100%)`,
                }}
            />

            {/* Brillo interno difuso - concentrado en la base */}
            <div
                className="absolute inset-0 opacity-15"
                style={{
                    background: `linear-gradient(180deg,
                        transparent 0%,
                        transparent 40%,
                        ${liquidColorGlow} 100%)`,
                    filter: "blur(4px)",
                }}
            />
        </>
    );

    // ============================================
    // RENDER: CRP content
    // ============================================
    const renderCrpContent = () => (
        <>
            {/* Capa base nebulosa (sin animación) */}
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(180deg,
                        ${etherealColors.secondary} 0%,
                        ${etherealColors.primary} 50%,
                        ${etherealColors.secondary} 100%)`,
                }}
            />

            {/* Niebla superior estática */}
            <div
                className="absolute -top-2 left-0 right-0 h-4"
                style={{
                    background: `radial-gradient(ellipse 100% 100% at 50% 100%, ${etherealColors.primary} 0%, transparent 70%)`,
                    filter: "blur(2px)",
                }}
            />

            {/* Destello central estático */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${etherealColors.glow} 0%, transparent 60%)`,
                    opacity: 0.4,
                }}
            />
        </>
    );

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    ref={barRef}
                    className={`relative cursor-help ${className}`}
                >
                    {/* Barra de cristal */}
                    <div
                        className="relative w-3 h-full rounded-full overflow-hidden"
                        style={{
                            background:
                                "linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)",
                            boxShadow: `
                                inset -1px 0 3px rgba(0,0,0,0.2),
                                inset 1px 0 3px rgba(255,255,255,0.1),
                                inset 0 2px 3px rgba(255,255,255,0.15),
                                inset 0 -2px 3px rgba(0,0,0,0.15),
                                0 0 8px rgba(255,255,255,0.05)
                            `,
                            border: "1px solid rgba(255,255,255,0.12)",
                        }}
                    >
                        {/* Contenedor del contenido animado */}
                        <div
                            className={`absolute bottom-0 left-0 right-0 transition-all ease-out overflow-hidden ${
                                type === "airflow" ? "rounded-full duration-1000" : "rounded-b-full duration-700"
                            }`}
                            style={{
                                height: `${animatedValue}%`,
                            }}
                        >
                            {type === "airflow" ? renderAirflowContent() : renderCrpContent()}
                        </div>

                        {/* Reflejo de cristal izquierdo */}
                        <div
                            className="absolute left-0.5 top-1 bottom-1 w-0.5 rounded-full pointer-events-none"
                            style={{
                                background:
                                    "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.25) 100%)",
                            }}
                        />
                    </div>
                </div>
            </TooltipTrigger>

            {/* Tooltip shadcn */}
            <TooltipContent
                side="top"
                sideOffset={10}
                variant="info"
            >
                {airflowDisplay ? (
                    <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{airflowDisplay.percentageText}</span>
                        {airflowDisplay.diasRealText && <span>{airflowDisplay.diasRealText}</span>}
                        {airflowDisplay.diasSimText && <span>{airflowDisplay.diasSimText}</span>}
                    </div>
                ) : (
                    crpDisplay?.tooltipText
                )}
            </TooltipContent>
        </Tooltip>
    );
}

export default GlassProgressBarSmall;
