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
            <div className="inline-flex bg-gray-200 dark:bg-white/10 rounded-xl p-1">
                <button
                    onClick={() => handleChange('nh90')}
                    className={`px-6 py-2 rounded-lg transition-all font-medium ${
                        viewMode === 'nh90'
                            ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-md'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    aria-pressed={viewMode === 'nh90'}
                >
                    NH-90
                </button>
                <button
                    onClick={() => handleChange('totals')}
                    className={`px-6 py-2 rounded-lg transition-all font-medium ${
                        viewMode === 'totals'
                            ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-md'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    aria-pressed={viewMode === 'totals'}
                >
                    Totales
                </button>
            </div>
        </div>
    );
}