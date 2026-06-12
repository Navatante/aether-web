type ViewMode = 'pilots' | 'crew';

interface ViewModeToggleProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    onResetFilters?: () => void;
    className?: string;
}

export default function ViewModeTogglePilotsDvs({
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
            <div className="inline-flex bg-muted rounded-xl p-1">
                <button
                    onClick={() => handleChange('pilots')}
                    className={`px-6 py-2 rounded-lg transition-all font-medium ${
                        viewMode === 'pilots'
                            ? 'bg-background text-foreground shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-pressed={viewMode === 'pilots'}
                >
                    Pilotos
                </button>
                <button
                    onClick={() => handleChange('crew')}
                    className={`px-6 py-2 rounded-lg transition-all font-medium ${
                        viewMode === 'crew'
                            ? 'bg-background text-foreground shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-pressed={viewMode === 'crew'}
                >
                    Dotaciones
                </button>
            </div>
        </div>
    );
}