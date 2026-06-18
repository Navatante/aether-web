import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import RegisterExtraHoursOtrosModelosForm from '../forms/RegisterExtraHoursOtrosModelosForm';
import type { ExtraHourItem } from '@/types/generated/extrahours';

interface RegisterExtraHoursOtrosModelosDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: 'create' | 'edit';
    initial?: ExtraHourItem;
}

export default function RegisterExtraHoursOtrosModelosDialog({
    open, onOpenChange, mode = 'create', initial,
}: RegisterExtraHoursOtrosModelosDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="max-w-lg max-h-[90vh] w-auto h-auto flex flex-col p-0 overflow-hidden"
            >
                <DialogHeader className="px-6 pt-6 pb-6 shrink-0">
                    <DialogTitle>
                        {mode === 'edit' ? 'Editar horas extra (otros modelos)' : 'Registrar horas extra (otros modelos)'}
                    </DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    <RegisterExtraHoursOtrosModelosForm
                        mode={mode}
                        initial={initial}
                        onClose={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
