import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import RegisterComisionForm from "../forms/RegisterComisionForm";

interface RegisterComisionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function RegisterComisionDialog({open, onOpenChange}: RegisterComisionDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="max-w-4xl max-h-[90vh] w-auto h-auto flex flex-col p-0 overflow-hidden"
            >
                <DialogHeader className="px-6 pt-6 pb-6 shrink-0">
                    <DialogTitle>Registrar Comisión</DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    <RegisterComisionForm onClose={() => onOpenChange(false)}/>
                </div>
            </DialogContent>
        </Dialog>
    );
}