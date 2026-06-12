import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RemoveCardButtonProps {
    index: number;
    onRemove: (index: number) => void;
}

/**
 * Botón estandarizado para eliminar una Card del formulario de vuelos.
 */
function RemoveCardButton({ index, onRemove }: RemoveCardButtonProps) {
    return (
        <Button
            type="button"
            onClick={() => onRemove(index)}
            variant="ghost"
            size="sm"
            className="hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
        >
            <Trash2 size={18} />
        </Button>
    );
}

export default RemoveCardButton;
