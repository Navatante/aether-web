import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import ExamForm from '../forms/ExamForm';
import { EXAM_CONFIG, type ExamType } from '../../flightsafety';
import type { ExamDialogInitial, ExamMode } from '../../hooks/useRegisterExam';

interface RegisterExamDialogProps {
    type: ExamType;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: ExamMode;
    initial?: ExamDialogInitial;
    initialPersonSk?: number;
    onSuccess?: () => void;
}

const TITLE: Record<ExamMode, string> = {
    create: 'Programar',
    edit: 'Editar',
    complete: 'Registrar resultado',
};

export default function RegisterExamDialog({
    type, open, onOpenChange, mode = 'create', initial, initialPersonSk, onSuccess,
}: RegisterExamDialogProps) {
    const cfg = EXAM_CONFIG[type];
    return (
        <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
            <DialogContent
                onWheel={(e) => e.stopPropagation()}
                className="max-w-xl max-h-[90vh] w-full h-auto flex flex-col p-0 overflow-hidden"
            >
                <DialogHeader className="px-6 pt-6 pb-6 shrink-0">
                    <DialogTitle>
                        {`${TITLE[mode]} · ${cfg.label}`}
                    </DialogTitle>
                </DialogHeader>
                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    <ExamForm
                        type={type}
                        mode={mode}
                        initial={initial}
                        initialPersonSk={initialPersonSk}
                        onClose={() => onOpenChange(false)}
                        onSuccess={onSuccess}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
