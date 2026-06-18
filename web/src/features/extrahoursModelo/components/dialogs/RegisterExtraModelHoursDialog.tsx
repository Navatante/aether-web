import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import RegisterExtraModelHoursForm from '../forms/RegisterExtraModelHoursForm';
import type { ExtraModelHourItem } from '@/types/generated/extramodelhours';

interface RegisterExtraModelHoursDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: 'create' | 'edit';
    initial?: ExtraModelHourItem;
}

export default function RegisterExtraModelHoursDialog({
    open, onOpenChange, mode = 'create', initial,
}: RegisterExtraModelHoursDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="max-w-lg max-h-[90vh] w-auto h-auto flex flex-col p-0 overflow-hidden"
            >
                <DialogHeader className="px-6 pt-6 pb-6 shrink-0">
                    <DialogTitle>
                        {mode === 'edit' ? 'Editar horas extra (NH-90)' : 'Registrar horas extra (NH-90)'}
                    </DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    <RegisterExtraModelHoursForm
                        mode={mode}
                        initial={initial}
                        onClose={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
