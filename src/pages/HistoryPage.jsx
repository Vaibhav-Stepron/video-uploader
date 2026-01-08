import { useState, useEffect } from "react";
import { getAllUploads, deleteUpload, clearAllUploads } from "@/lib/indexedDB";
import UploadHistory from "@/components/UploadHistory";
import ConfirmationModal from "@/components/ConfirmationModal";

const HistoryPage = () => {
    const [uploadHistory, setUploadHistory] = useState([]);
    const [copiedId, setCopiedId] = useState(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({
        show: false,
        id: null,
        fileName: "",
    });

    // Load uploads on mount
    useEffect(() => {
        const loadUploads = async () => {
            try {
                const uploads = await getAllUploads();
                setUploadHistory(uploads);
            } catch (error) {
                console.error("Failed to load upload history:", error);
            }
        };
        loadUploads();
    }, []);

    const handleCopyUrl = async (url, id) => {
        try {
            const encodedUrl = encodeURI(url);
            await navigator.clipboard.writeText(encodedUrl);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    const handleClearHistory = async () => {
        try {
            await clearAllUploads();
            setUploadHistory([]);
            setShowClearConfirm(false);
        } catch (error) {
            console.error("Failed to clear history:", error);
        }
    };

    const handleRemoveHistoryItem = async (id) => {
        try {
            await deleteUpload(id);
            setUploadHistory((prev) => prev.filter((item) => item.id !== id));
            setDeleteConfirm({ show: false, id: null, fileName: "" });
        } catch (error) {
            console.error("Failed to remove item:", error);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <UploadHistory
                    uploadHistory={uploadHistory}
                    onCopyUrl={handleCopyUrl}
                    onDelete={(id, fileName) =>
                        setDeleteConfirm({ show: true, id, fileName })
                    }
                    onClearAll={() => setShowClearConfirm(true)}
                    copiedId={copiedId}
                />
            </div>

            {/* Clear All Confirmation Modal */}
            <ConfirmationModal
                show={showClearConfirm}
                title="Clear All History"
                description="This action cannot be undone"
                content={
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete all {uploadHistory.length} uploaded
                        video records? This will permanently remove all history.
                    </p>
                }
                onConfirm={handleClearHistory}
                onCancel={() => setShowClearConfirm(false)}
                confirmText="Delete All"
            />

            {/* Individual Delete Confirmation Modal */}
            <ConfirmationModal
                show={deleteConfirm.show}
                title="Delete Video"
                description="This action cannot be undone"
                content={
                    <>
                        <p className="text-sm text-muted-foreground mb-2">
                            Are you sure you want to delete this video?
                        </p>
                        <p className="text-sm font-medium truncate">
                            {deleteConfirm.fileName}
                        </p>
                    </>
                }
                onConfirm={() => handleRemoveHistoryItem(deleteConfirm.id)}
                onCancel={() =>
                    setDeleteConfirm({ show: false, id: null, fileName: "" })
                }
                confirmText="Delete"
            />
        </div>
    );
};

export default HistoryPage;
