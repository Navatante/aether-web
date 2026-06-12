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
            <div className="inline-flex bg-gray-200 dark:bg-white/10 rounded-xl p-1">
                <button
                    onClick={() => handleChange('pilots')}
                    className={`px-6 py-2 rounded-lg transition-all font-medium ${
                        viewMode === 'pilots'
                            ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-md'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    aria-pressed={viewMode === 'pilots'}
                >
                    Pilotos
                </button>
                <button
                    onClick={() => handleChange('crew')}
                    className={`px-6 py-2 rounded-lg transition-all font-medium ${
                        viewMode === 'crew'
                            ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-md'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    aria-pressed={viewMode === 'crew'}
                >
                    Dotaciones
                </button>
            </div>
        </div>
    );
}