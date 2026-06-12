import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import RegisterFlightForm from "../forms/RegisterFlightForm";

interface RegisterFlightDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function RegisterFlightDialog({ open, onOpenChange }: RegisterFlightDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="!max-w-none w-[100vw] h-[100vh] flex flex-col p-0 "
            >
                <DialogHeader className="px-6 pt-6 pb-6 shrink-0">
                    <DialogTitle>Registrar Vuelo</DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6">
                    <RegisterFlightForm onClose={() => onOpenChange(false)}/>
                </div>
            </DialogContent>
        </Dialog>
    );
}