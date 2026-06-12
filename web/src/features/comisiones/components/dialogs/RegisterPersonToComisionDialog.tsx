import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import RegisterPersonToComisionForm from "../forms/RegisterPersonToComisionForm";

interface RegisterComisionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function RegisterPersonToComisionDialog({open, onOpenChange}: RegisterComisionDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="min-w-[900px] max-w-fit max-h-[90vh] flex flex-col p-0 overflow-hidden"
            >
                <DialogHeader className="px-6 pt-6 pb-6 shrink-0">
                    <DialogTitle>Registrar Personal en Comisión</DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    <RegisterPersonToComisionForm onClose={() => onOpenChange(false)}/>
                </div>
            </DialogContent>
        </Dialog>
    );
}