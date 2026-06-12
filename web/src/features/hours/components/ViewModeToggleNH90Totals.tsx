type ViewMode = 'nh90' | 'totals';

interface ViewModeToggleProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    onResetFilters?: () => void;
    className?: string;
}

export default function ViewModeToggleNH90Totals({
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
                    onClick={() => handleChange('nh90')}
                    className={`px-6 py-2 rounded-lg transition-all font-medium ${
                        viewMode === 'nh90'
                            ? 'bg-background text-foreground shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-pressed={viewMode === 'nh90'}
                >
                    NH-90
                </button>
                <button
                    onClick={() => handleChange('totals')}
                    className={`px-6 py-2 rounded-lg transition-all font-medium ${
                        viewMode === 'totals'
                            ? 'bg-background text-foreground shadow-md'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-pressed={viewMode === 'totals'}
                >
                    Totales
                </button>
            </div>
        </div>
    );
}