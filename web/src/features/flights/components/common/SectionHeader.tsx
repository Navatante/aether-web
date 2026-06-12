import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SectionHeaderProps {
    title: string;
    onAdd: () => void;
}

/**
 * Header de sección con título y botón para añadir elementos.
 * Usado en las secciones de Pilotos, Dotaciones, Papeletas, Cupos y Pasajeros.
 */
function SectionHeader({ title, onAdd }: SectionHeaderProps) {
    return (
        <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">{title}</h1>
            <Button
                type="button"
                onClick={onAdd}
                className="flex items-center gap-2 size-6 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:border-emerald-500/30 dark:hover:text-emerald-400"
                variant="outline"
            >
                <Plus size={18} />
            </Button>
        </div>
    );
}

export default SectionHeader;
