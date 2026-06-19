import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import RegisterExtraHoursForm from '../forms/RegisterExtraHoursForm';
import type { ExtraHourItem } from '@/types/generated/extrahours';

interface RegisterExtraHoursDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: 'create' | 'edit';
    initial?: ExtraHourItem;
}

export default function RegisterExtraHoursDialog({
    open, onOpenChange, mode = 'create', initial,
}: RegisterExtraHoursDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="max-w-lg max-h-[90vh] w-auto h-auto flex flex-col p-0 overflow-hidden"
            >
                <DialogHeader className="px-6 pt-6 pb-6 shrink-0">
                    <DialogTitle>
                        {mode === 'edit' ? 'Editar horas extra' : 'Registrar horas extra'}
                    </DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    <RegisterExtraHoursForm
                        mode={mode}
                        initial={initial}
                        onClose={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
