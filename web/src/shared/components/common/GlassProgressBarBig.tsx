import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import "./GlassProgressBarBig.css";

interface GlassProgressBarProps {
    type?: "crp" | "airflow";
    value?: number;
    className?: string;
}

// Color constants - defined outside component to prevent recreation
const GREEN_COLORS = {
    primary: "rgba(34, 197, 94, 0.7)",
    secondary: "rgba(74, 222, 128, 0.5)",
    glow: "rgba(134, 239, 172, 0.8)",
    particles: "rgba(187, 247, 208, 0.9)",
} as const;

const ORANGE_COLORS = {
    primary: "rgba(249, 115, 22, 0.7)",
    secondary: "rgba(251, 146, 60, 0.5)",
    glow: "rgba(253, 186, 116, 0.8)",
    particles: "rgba(254, 215, 170, 0.9)",
} as const;

const RED_COLORS = {
    primary: "rgba(239, 68, 68, 0.7)",
    secondary: "rgba(248, 113, 113, 0.5)",
    glow: "rgba(252, 165, 165, 0.8)",
    particles: "rgba(254, 202, 202, 0.9)",
} as const;

// Airflow color helper - returns colors for both light and dark modes
function getAirflowColors(percentage: number, isDark: boolean) {
    if (percentage > 80) {
        // Blue tones - good airflow
        return isDark
            ? {
                airColor: "rgba(135,206,235,0.5)",
                airColorLight: "rgba(173,216,230,0.4)",
                airColorGlow: "rgba(135,206,235,0.7)",
            }
            : {
                airColor: "rgba(100,180,220,0.5)",
                airColorLight: "rgba(130,195,230,0.4)",
                airColorGlow: "rgba(80,160,210,0.6)",
            };
    }
    if (percentage >= 40) {
        // Neutral colors - medium airflow
        return isDark
            ? {
                airColor: "rgba(255,255,255,0.4)",
                airColorLight: "rgba(245,245,245,0.35)",
                airColorGlow: "rgba(255,255,255,0.6)",
            }
            : {
                airColor: "rgba(140,150,170,0.5)",
                airColorLight: "rgba(160,170,190,0.4)",
                airColorGlow: "rgba(120,130,160,0.6)",
            };
    }
    // Low values - poor airflow (darker/warmer)
    return isDark
        ? {
            airColor: "rgba(105,105,105,0.5)",
            airColorLight: "rgba(128,128,128,0.45)",
            airColorGlow: "rgba(85,85,85,0.7)",
        }
        : {
            airColor: "rgba(130,120,110,0.5)",
            airColorLight: "rgba(150,140,130,0.4)",
            airColorGlow: "rgba(110,100,90,0.6)",
        };
}

// CRP color helper
function getEtherealColors(percentage: number) {
    if (percentage > 80) return GREEN_COLORS;
    if (percentage >= 40) return ORANGE_COLORS;
    return RED_COLORS;
}

function GlassProgressBarBig({
    type = "crp",
    value = 0,
    className = "",
}: GlassProgressBarProps) {
    const [animatedValue, setAnimatedValue] = useState(0);
    const barRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();

    // Resolve actual theme (handle "system" setting)
    const [isDark, setIsDark] = useState(() => {
        if (theme === "system") {
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return theme === "dark";
    });

    useEffect(() => {
        if (theme === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            setIsDark(mediaQuery.matches);

            const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
            mediaQuery.addEventListener("change", handler);
            return () => mediaQuery.removeEventListener("change", handler);
        } else {
            setIsDark(theme === "dark");
        }
    }, [theme]);

    const displayPercentage = Math.max(0, Math.min(100, value));

    const tooltipText = type === "airflow"
        ? `${Math.round(displayPercentage)}% Airflow medio`
        : `${Math.round(displayPercentage)}% CRP medio`;

    const label = type === "airflow" ? "Airflow" : "CRP";

    useEffect(() => {
        const timer = setTimeout(() => setAnimatedValue(displayPercentage), 100);
        return () => clearTimeout(timer);
    }, [displayPercentage]);

    const airflowColors = getAirflowColors(displayPercentage, isDark);

    const etherealColors = getEtherealColors(displayPercentage);

    const { airColor, airColorLight, airColorGlow } = airflowColors;

    // ============================================
    // RENDER: Airflow
    // ============================================
    const renderAirflowContent = () => (
        <>
            {/* Capa base de aire - gradiente difuso con parte superior transparente */}
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(180deg,
                        transparent 0%,
                        rgba(255,255,255,0.02) 5%,
                        ${airColorLight.replace('0.35)', '0.08)')} 15%,
                        ${airColorLight} 35%,
                        ${airColor} 60%,
                        ${airColorGlow} 100%)`,
                }}
            />

            {/* Corrientes de aire - efecto turbulento superior (muy sutil) */}
            <div
                className="absolute -top-4 left-0 right-0 h-8 overflow-hidden"
                style={{
                    filter: "blur(3px)",
                    opacity: 0.4,
                }}
            >
                <svg
                    className="absolute -top-1 left-0 w-[300%] h-8"
                    viewBox="0 0 300 20"
                    preserveAspectRatio="none"
                    style={{
                        animation: "airFlow 4s ease-in-out infinite",
                    }}
                >
                    <path
                        d="M0,10 Q15,5 30,10 T60,10 T90,10 T120,10 T150,10 T180,10 T210,10 T240,10 T270,10 T300,10 L300,20 L0,20 Z"
                        fill={airColorLight}
                    />
                </svg>
            </div>

            {/* Segunda capa de corriente (desfasada, más transparente) */}
            <div
                className="absolute -top-2 left-0 right-0 h-6 overflow-hidden"
                style={{
                    filter: "blur(4px)",
                }}
            >
                <svg
                    className="absolute -top-0.5 left-0 w-[250%] h-5"
                    viewBox="0 0 250 15"
                    preserveAspectRatio="none"
                    style={{
                        animation: "airFlow2 5s ease-in-out infinite",
                        opacity: 0.3,
                    }}
                >
                    <path
                        d="M0,8 Q20,4 40,8 T80,8 T120,8 T160,8 T200,8 T250,8 L250,15 L0,15 Z"
                        fill={isDark ? "rgba(255,255,255,0.15)" : airColorLight}
                    />
                </svg>
            </div>

            {/* Partículas de polvo/aire flotando */}
            {animatedValue > 5 && (
                <>
                    <div
                        className="absolute w-1 h-1 rounded-full"
                        style={{
                            background: isDark
                                ? `radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 70%)`
                                : `radial-gradient(circle, ${airColorGlow} 0%, transparent 70%)`,
                            left: "25%",
                            filter: "blur(0.5px)",
                            animation: "dustFloat1 6s ease-in-out infinite",
                        }}
                    />
                    <div
                        className="absolute w-1.5 h-1.5 rounded-full"
                        style={{
                            background: isDark
                                ? `radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 70%)`
                                : `radial-gradient(circle, ${airColor} 0%, transparent 70%)`,
                            left: "55%",
                            filter: "blur(0.5px)",
                            animation: "dustFloat2 7s ease-in-out infinite 1s",
                        }}
                    />
                    <div
                        className="absolute w-0.5 h-0.5 rounded-full"
                        style={{
                            background: isDark
                                ? `radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 70%)`
                                : `radial-gradient(circle, ${airColorGlow} 0%, transparent 70%)`,
                            left: "70%",
                            filter: "blur(0.3px)",
                            animation: "dustFloat3 4s ease-in-out infinite 0.5s",
                        }}
                    />
                    <div
                        className="absolute w-1 h-1 rounded-full"
                        style={{
                            background: isDark
                                ? `radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)`
                                : `radial-gradient(circle, ${airColorLight} 0%, transparent 70%)`,
                            left: "35%",
                            filter: "blur(0.5px)",
                            animation: "dustFloat4 8s ease-in-out infinite 2s",
                        }}
                    />
                    <div
                        className="absolute w-0.5 h-0.5 rounded-full"
                        style={{
                            background: isDark
                                ? `radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 70%)`
                                : `radial-gradient(circle, ${airColor} 0%, transparent 70%)`,
                            left: "45%",
                            filter: "blur(0.2px)",
                            animation: "dustFloat5 5s ease-in-out infinite 1.5s",
                        }}
                    />
                    <div
                        className="absolute w-0.5 h-0.5 rounded-full"
                        style={{
                            background: isDark
                                ? `radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 70%)`
                                : `radial-gradient(circle, ${airColorLight} 0%, transparent 70%)`,
                            left: "15%",
                            filter: "blur(0.3px)",
                            animation: "dustFloat6 9s ease-in-out infinite 3s",
                        }}
                    />
                </>
            )}

            {/* Efecto de turbulencia interna - más denso abajo */}
            <div
                className="absolute inset-0 opacity-30"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 40% at 30% 70%, ${airColorLight} 0%, transparent 60%),
                        radial-gradient(ellipse 60% 30% at 70% 80%, ${airColorLight} 0%, transparent 50%)
                    `,
                    animation: "turbulence 3s ease-in-out infinite alternate",
                }}
            />

            {/* Brillo interno difuso - concentrado en la base */}
            <div
                className="absolute inset-0 opacity-15"
                style={{
                    background: `linear-gradient(180deg,
                        transparent 0%,
                        transparent 40%,
                        ${airColorGlow} 100%)`,
                    filter: "blur(6px)",
                }}
            />
        </>
    );

    // ============================================
    // RENDER: CRP
    // ============================================
    const renderCrpContent = () => (
        <>
            {/* Capa base nebulosa */}
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(180deg,
                        ${etherealColors.secondary} 0%,
                        ${etherealColors.primary} 50%,
                        ${etherealColors.secondary} 100%)`,
                    animation: "etherealShift 4s ease-in-out infinite",
                }}
            />

            {/* Niebla ondulante superior */}
            <div
                className="absolute -top-4 left-0 right-0 h-8"
                style={{
                    background: `radial-gradient(ellipse 100% 100% at 50% 100%, ${etherealColors.primary} 0%, transparent 70%)`,
                    animation: "mistFloat 3s ease-in-out infinite",
                    filter: "blur(4px)",
                }}
            />

            {/* Wisps etéreos (hebras de energía) */}
            <div
                className="absolute inset-0 overflow-hidden"
                style={{ opacity: 0.7 }}
            >
                <div
                    className="absolute w-full h-full"
                    style={{
                        background: `
                            radial-gradient(ellipse 30% 50% at 20% 30%, ${etherealColors.glow} 0%, transparent 50%),
                            radial-gradient(ellipse 40% 30% at 70% 60%, ${etherealColors.glow} 0%, transparent 50%),
                            radial-gradient(ellipse 35% 40% at 40% 80%, ${etherealColors.glow} 0%, transparent 50%)
                        `,
                        animation: "wispsMove 5s ease-in-out infinite",
                    }}
                />
            </div>

            {/* Partículas flotantes etéreas */}
            {animatedValue > 5 && (
                <>
                    <div
                        className="absolute w-2 h-2 rounded-full"
                        style={{
                            background: `radial-gradient(circle at 30% 30%, ${etherealColors.particles}, transparent)`,
                            boxShadow: `0 0 8px ${etherealColors.glow}`,
                            left: "25%",
                            animation: "particleFloat1 6s ease-in-out infinite",
                            filter: "blur(0.5px)",
                        }}
                    />
                    <div
                        className="absolute w-1.5 h-1.5 rounded-full"
                        style={{
                            background: `radial-gradient(circle at 30% 30%, ${etherealColors.particles}, transparent)`,
                            boxShadow: `0 0 6px ${etherealColors.glow}`,
                            left: "55%",
                            animation: "particleFloat2 5s ease-in-out infinite 0.5s",
                            filter: "blur(0.3px)",
                        }}
                    />
                    <div
                        className="absolute w-1 h-1 rounded-full"
                        style={{
                            background: `radial-gradient(circle at 30% 30%, ${etherealColors.particles}, transparent)`,
                            boxShadow: `0 0 4px ${etherealColors.glow}`,
                            left: "70%",
                            animation: "particleFloat3 4s ease-in-out infinite 1s",
                        }}
                    />
                    <div
                        className="absolute w-1 h-1 rounded-full"
                        style={{
                            background: `radial-gradient(circle at 30% 30%, ${etherealColors.particles}, transparent)`,
                            boxShadow: `0 0 5px ${etherealColors.glow}`,
                            left: "35%",
                            animation: "particleFloat4 7s ease-in-out infinite 2s",
                            filter: "blur(0.5px)",
                        }}
                    />
                    <div
                        className="absolute w-0.5 h-0.5 rounded-full"
                        style={{
                            background: etherealColors.particles,
                            boxShadow: `0 0 3px ${etherealColors.glow}`,
                            left: "45%",
                            animation: "particleFloat5 3s ease-in-out infinite 0.3s",
                        }}
                    />
                    <div
                        className="absolute w-1.5 h-1.5 rounded-full"
                        style={{
                            background: `radial-gradient(circle at 40% 40%, white, ${etherealColors.glow}, transparent)`,
                            boxShadow: `0 0 10px ${etherealColors.glow}`,
                            left: "15%",
                            animation: "particleFloat6 8s ease-in-out infinite 1.5s",
                            filter: "blur(0.3px)",
                        }}
                    />
                </>
            )}

            {/* Destello central pulsante */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${etherealColors.glow} 0%, transparent 60%)`,
                    animation: "corePulse 2s ease-in-out infinite",
                    opacity: 0.5,
                }}
            />

            {/* Velo de luz vertical */}
            <div
                className="absolute inset-0 opacity-40"
                style={{
                    background: `linear-gradient(0deg,
                        transparent 0%,
                        ${etherealColors.glow} 30%,
                        transparent 50%,
                        ${etherealColors.glow} 70%,
                        transparent 100%)`,
                    animation: "veilRise 4s linear infinite",
                }}
            />
        </>
    );

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    ref={barRef}
                    className={`relative cursor-help flex flex-col items-center ${className}`}
                    style={{
                        transform: "translateZ(0)",
                        isolation: "isolate",
                    }}
                >
                    {/* Barra de cristal */}
                    <div
                        className="relative w-9 h-full rounded-full overflow-hidden"
                        style={{
                            background: isDark
                                ? "linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)"
                                : "linear-gradient(90deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.07) 25%, rgba(0,0,0,0.03) 50%, rgba(0,0,0,0.01) 100%)",
                            boxShadow: isDark
                                ? `
                                    inset -2px 0 4px rgba(0,0,0,0.2),
                                    inset 2px 0 4px rgba(255,255,255,0.1),
                                    inset 0 3px 4px rgba(255,255,255,0.15),
                                    inset 0 -3px 4px rgba(0,0,0,0.15),
                                    0 0 12px rgba(255,255,255,0.05)
                                `
                                : `
                                    inset -2px 0 4px rgba(0,0,0,0.06),
                                    inset 2px 0 4px rgba(255,255,255,0.7),
                                    inset 0 3px 4px rgba(255,255,255,0.6),
                                    inset 0 -3px 4px rgba(0,0,0,0.04),
                                    0 2px 8px rgba(0,0,0,0.08)
                                `,
                            border: isDark
                                ? "1px solid rgba(255,255,255,0.12)"
                                : "1px solid rgba(0,0,0,0.1)",
                            transform: "translateZ(0)",
                            willChange: "transform",
                        }}
                    >
                        {/* Contenedor del contenido animado */}
                        <div
                            className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out overflow-hidden"
                            style={{
                                height: `${animatedValue}%`,
                            }}
                        >
                            {type === "airflow" ? renderAirflowContent() : renderCrpContent()}
                        </div>

                        {/* Reflejo de cristal izquierdo */}
                        <div
                            className="absolute left-1 top-2 bottom-2 w-1 rounded-full pointer-events-none"
                            style={{
                                background: isDark
                                    ? "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.25) 100%)"
                                    : "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.8) 100%)",
                            }}
                        />

                        {/* Reflejo de cristal derecho (sutil) */}
                        <div
                            className="absolute right-1.5 top-4 bottom-4 w-0.5 rounded-full pointer-events-none opacity-50"
                            style={{
                                background: isDark
                                    ? "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.02) 100%)"
                                    : "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.02) 100%)",
                            }}
                        />
                    </div>

                    {/* Etiqueta en la base */}
                    <span
                        className="mt-1.5 text-[12px] font-medium tracking-wide text-muted-foreground uppercase"
                    >
                        {label}
                    </span>
                </div>
            </TooltipTrigger>

            <TooltipContent
                side="top"
                sideOffset={10}
                variant="info"
            >
                {tooltipText}
            </TooltipContent>
        </Tooltip>
    );
}

export default GlassProgressBarBig;
