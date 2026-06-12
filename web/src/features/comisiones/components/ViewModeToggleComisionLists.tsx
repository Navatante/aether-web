import { useState } from 'react'

export type ViewMode = 'Base o de Corta duración ordenadas por COMFLOAN' |
    'Despliegues ordenados por COMFLOAN' |
    'Ofertadas por otros mandos y de carácter voluntario' |
    'OMP como UNAEMB o UNADEST' |
    'Ranchería' |
    'UNADEST nacionales o extranjero' |
    'UNAEMB nacionales o extranjero';

interface ViewModeToggleProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    onResetFilters?: () => void;
    className?: string;
}

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string; title: string; description: string }[] = [
    {
        value: 'Base o de Corta duración ordenadas por COMFLOAN',
        label: 'Base / Corta duración',
        title: 'Comisiones Base / Corta Duración',
        description: 'Contempla todas aquellas comisiones cuya designación depende de COMFLOAN, normalmente de corta duración, que implique la designación de algún miembro de la escuadrilla para realizar actividades protocolarias, actos militares, personal de enlace, limpiezas o labores ajenas a los trabajos habituales de la unidad.'
    },
    {
        value: 'Despliegues ordenados por COMFLOAN',
        label: 'Despliegues',
        title: 'Despliegues COMFLOAN',
        description: 'Contemplan aquellas comisiones de servicio de diversa duración cuya designación depende de COMFLOAN que implica participar como dotación de aumento para otros mandos o estados mayores desplegables (EMD) como CGMAD o GRUPFLOT en forma de despliegue tanto por tierra como embarcado (el despliegue puede ser también en la B.N.R. para determinados ejercicios).'
    },
    {
        value: 'Ofertadas por otros mandos y de carácter voluntario',
        label: 'Voluntarias',
        title: 'Comisiones Voluntarias',
        description: 'Contemplan aquellas comisiones de servicio cuya designación no depende de la FLOAN y que solicita el interesado de manera voluntaria.'
    },
    {
        value: 'Ranchería',
        label: 'Ranchería',
        title: 'Servicio de Ranchería',
        description: 'Implican dedicación exclusiva del personal a funciones ajenas a su rol en la Escuadrilla. Los días realizados deben computarse también como comisión de servicio (OMP, UNAEMB o UNADEST). Tiene prioridad sobre las demás listas a la hora de nombrar al personal para el servicio de ranchería.'
    },
    {
        value: 'OMP como UNAEMB o UNADEST',
        label: 'OMP',
        title: 'Operaciones de Mantenimiento de la Paz',
        description: 'No se diferenciarán misiones OMP por tierra o embarcado. El requisito diferenciador para que la comisión de servicio sea considerada OMP es percibir las indemnizaciones correspondientes a la misión OMP al menos el 50% de los días de la duración total de la comisión.'
    },
    {
        value: 'UNADEST nacionales o extranjero',
        label: 'UNADEST',
        title: 'UNADEST Nacional / Extranjero',
        description: 'Abarca cualquier comisión desplegado por tierra sin distinción de los días divididos en dietas nacionales e internacionales o incluso OMP, siempre que la duración de los días OMP sea inferior al 50% de los días totales de la comisión de servicio.'
    },
    {
        value: 'UNAEMB nacionales o extranjero',
        label: 'UNAEMB',
        title: 'UNAEMB Nacional / Extranjero',
        description: 'Abarca cualquier comisión embarcado sin distinción de los días divididos en dietas nacionales e internacionales o incluso OMP, siempre que la duración de los días OMP sea inferior al 50% de los días totales de la comisión de servicio.'
    },
];

// Tooltip personalizado
interface CustomTooltipProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

function CustomTooltip({ description, children }: CustomTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleMouseEnter = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPosition({
            x: rect.left + rect.width / 2,
            y: rect.bottom + 8
        });
        setIsVisible(true);
    };

    const handleMouseLeave = () => {
        setIsVisible(false);
    };

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}

            {isVisible && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        left: position.x,
                        top: position.y,
                        transform: 'translateX(-50%)'
                    }}
                >

                    {/* Contenido del tooltip */}
                    <div className="w-80 max-w-[90vw] animate-in fade-in-0 zoom-in-95 duration-200">
                        <div className="relative overflow-hidden rounded-xl border border-border bg-popover shadow-xl dark:shadow-2xl">

                            {/* Descripción */}
                            <div className="px-4 py-3">
                                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                                    {description}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ViewModeToggleComisionLists({
                                                        viewMode,
                                                        onViewModeChange,
                                                        onResetFilters,
                                                        className = '',
                                                    }: ViewModeToggleProps) {
    const handleChange = (mode: ViewMode) => {
        onViewModeChange(mode);
        onResetFilters?.();
    };

    return (
        <div className={`flex justify-center mb-6 ${className}`}>
            <div className="inline-flex flex-wrap gap-1 bg-muted rounded-xl p-1">
                {VIEW_MODE_OPTIONS.map((option) => (
                    <CustomTooltip
                        key={option.value}
                        title={option.title}
                        description={option.description}
                    >
                        <button
                            onClick={() => handleChange(option.value)}
                            className={`px-4 py-2 rounded-lg transition-all font-medium text-sm ${
                                viewMode === option.value
                                    ? 'bg-background text-foreground shadow-md'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            aria-pressed={viewMode === option.value}
                        >
                            {option.label}
                        </button>
                    </CustomTooltip>
                ))}
            </div>
        </div>
    );
}