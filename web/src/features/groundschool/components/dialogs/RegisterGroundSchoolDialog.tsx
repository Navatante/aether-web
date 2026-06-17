import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import RegisterGroundSchoolForm from '../forms/RegisterGroundSchoolForm';

interface RegisterGroundSchoolDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function RegisterGroundSchoolDialog({ open, onOpenChange }: RegisterGroundSchoolDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="max-w-lg max-h-[90vh] w-auto h-auto flex flex-col p-0 overflow-hidden"
            >
                <DialogHeader className="px-6 pt-6 pb-6 shrink-0">
                    <DialogTitle>Registrar Ground School</DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    <RegisterGroundSchoolForm onClose={() => onOpenChange(false)} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
