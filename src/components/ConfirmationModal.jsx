import { AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const ConfirmationModal = ({
    show,
    title,
    description,
    content,
    onConfirm,
    onCancel,
    confirmText = "Delete",
    cancelText = "Cancel"
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card/95 backdrop-blur-md rounded-xl shadow-2xl p-6 max-w-sm mx-4 border border-border/50">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/20 border border-destructive/30">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-foreground">{title}</h3>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>
                <div className="mb-6">
                    {content}
                </div>
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={onCancel} className="border-border/50 hover:bg-secondary">
                        {cancelText}
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} className="shadow-md shadow-destructive/25">
                        <Trash2 className="mr-1 h-4 w-4" />
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
