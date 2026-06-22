import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import RegisterFuelForm from '../forms/RegisterFuelForm';
import type { FuelItem } from '@/types/generated/fuel';

interface RegisterFuelDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: 'create' | 'edit';
    initial?: FuelItem;
}

export default function RegisterFuelDialog({
    open, onOpenChange, mode = 'create', initial,
}: RegisterFuelDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="max-w-2xl max-h-[90vh] w-full h-auto flex flex-col p-0 overflow-hidden"
            >
                <DialogHeader className="px-6 pt-6 pb-6 shrink-0">
                    <DialogTitle>
                        {mode === 'edit' ? 'Editar repostaje' : 'Registrar combustible'}
                    </DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    <RegisterFuelForm
                        mode={mode}
                        initial={initial}
                        onClose={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
