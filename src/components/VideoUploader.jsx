import { useState, useRef, useEffect, useCallback } from "react";
import {
    Upload,
    X,
    Copy,
    Check,
    Video,
    HardDrive,
    AlertCircle,
    CheckCircle2,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatFileSize } from "@/lib/utils";
import {
    initDB,
    addUpload,
    getAllUploads,
    deleteUpload,
    clearAllUploads,
} from "@/lib/indexedDB";
import PasswordScreen from "./PasswordScreen";
import LoadingScreen from "./LoadingScreen";
import UploadHistory from "./UploadHistory";
import ConfirmationModal from "./ConfirmationModal";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const PARALLEL_UPLOADS = 3;
const BASE_URL = import.meta.env.VITE_API_BASE_URL

const VideoUploader = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [copied, setCopied] = useState(false);
    const [uploadHistory, setUploadHistory] = useState([]);
    const [chunksCompleted, setChunksCompleted] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [copiedId, setCopiedId] = useState(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, fileName: "" });
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [passwordError, setPasswordError] = useState("");

    const fileInputRef = useRef(null);
    const abortControllerRef = useRef(null);
    const wakeLockRef = useRef(null);

    // Check for existing authentication on mount
    useEffect(() => {
        const isAuth = localStorage.getItem('videoUploaderAuth') === 'true';
        if (isAuth) {
            setIsAuthenticated(true);
        }
    }, []);

    // Initialize IndexedDB
    useEffect(() => {
        const initialize = async () => {
            try {
                await initDB();
                // Keep loading screen visible for minimum time
                await new Promise(resolve => setTimeout(resolve, 1000));
                setIsLoading(false);
            } catch (error) {
                console.error("Failed to initialize:", error);
                setIsLoading(false);
            }
        };
        initialize();
    }, []);

    // Load uploads after authentication
    useEffect(() => {
        const loadUploads = async () => {
            if (isAuthenticated) {
                try {
                    const uploads = await getAllUploads();
                    setUploadHistory(uploads);
                } catch (error) {
                    console.error("Failed to load upload history:", error);
                }
            }
        };
        loadUploads();
    }, [isAuthenticated]);

    // Keep screen awake during upload and warn before closing
    useEffect(() => {
        const requestWakeLock = async () => {
            if (uploading && 'wakeLock' in navigator) {
                try {
                    wakeLockRef.current = await navigator.wakeLock.request('screen');
                    console.log('Wake Lock activated');
                } catch (err) {
                    console.error('Wake Lock error:', err);
                }
            }
        };

        const releaseWakeLock = async () => {
            if (wakeLockRef.current) {
                try {
                    await wakeLockRef.current.release();
                    wakeLockRef.current = null;
                    console.log('Wake Lock released');
                } catch (err) {
                    console.error('Wake Lock release error:', err);
                }
            }
        };

        const handleBeforeUnload = (e) => {
            if (uploading) {
                e.preventDefault();
                e.returnValue = 'Upload in progress. Are you sure you want to leave? The upload will be cancelled.';
                return e.returnValue;
            }
        };

        if (uploading) {
            requestWakeLock();
            window.addEventListener('beforeunload', handleBeforeUnload);
        } else {
            releaseWakeLock();
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            releaseWakeLock();
        };
    }, [uploading]);

    const saveToIndexedDB = async (fileName, url, fileSize, uploadDuration) => {
        try {
            const newEntry = await addUpload({
                fileName,
                url,
                fileSize,
                uploadDuration,
            });
            setUploadHistory((prev) => [newEntry, ...prev]);
        } catch (error) {
            console.error("Failed to save to IndexedDB:", error);
        }
    };

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith("video/")) {
            setSelectedFile(files[0]);
            setUploadStatus("idle");
            setErrorMessage("");
        }
    }, []);

    const handleFileSelect = useCallback((e) => {
        if (e.target.files?.length > 0) {
            setSelectedFile(e.target.files[0]);
            setUploadStatus("idle");
            setErrorMessage("");
        }
    }, []);

    const uploadChunk = async (file, chunkIndex, totalChunks, signal) => {
        const start = chunkIndex * CHUNK_SIZE;
        const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));

        // Encode filename to handle spaces and special characters
        const encodedFileName = encodeURIComponent(file.name);

        const formData = new FormData();
        formData.append("FileName", encodedFileName);
        formData.append("MimeType", file.type);
        formData.append("ChunkIndex", chunkIndex.toString());
        formData.append("TotalChunks", totalChunks.toString());
        formData.append("Chunk", chunk);
        formData.append("UserId", 1);

        const response = await fetch(`${BASE_URL}/UploadChunk`, {
            method: "POST",
            body: formData,
            signal,
        });
        if (!response.ok) throw new Error(`Chunk ${chunkIndex} failed`);
        return response.json();
    };

    const finalizeUpload = async (file, totalChunks) => {
        // Encode filename to handle spaces and special characters
        const encodedFileName = encodeURIComponent(file.name);

        const formData = new FormData();
        formData.append("FileName", encodedFileName);
        formData.append("MimeType", file.type);
        formData.append("TotalChunks", totalChunks.toString());
        formData.append("UserId", 1);

        const response = await fetch(`${BASE_URL}/FinalizeUpload`, {
            method: "POST",
            body: formData,
        });
        if (!response.ok) throw new Error("Finalize failed");
        return response.json();
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        const startTime = Date.now();

        const chunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
        setTotalChunks(chunks);
        setChunksCompleted(0);
        setUploading(true);
        setUploadStatus("idle");
        setErrorMessage("");
        setVideoUrl("");
        setUploadProgress(0);

        abortControllerRef.current = new AbortController();

        try {
            let completed = 0;
            const chunkIndices = Array.from({ length: chunks }, (_, i) => i);

            for (let i = 0; i < chunkIndices.length; i += PARALLEL_UPLOADS) {
                const batch = chunkIndices.slice(i, i + PARALLEL_UPLOADS);
                await Promise.all(
                    batch.map((idx) =>
                        uploadChunk(
                            selectedFile,
                            idx,
                            chunks,
                            abortControllerRef.current.signal
                        ).then(() => {
                            completed++;
                            setChunksCompleted(completed);
                            setUploadProgress(Math.round((completed / chunks) * 95));
                        })
                    )
                );
            }

            setUploadProgress(98);
            const result = await finalizeUpload(selectedFile, chunks);
            const url = result.Url || result.url;

            const uploadDuration = Date.now() - startTime;

            setUploadProgress(100);
            setUploadStatus("success");
            setVideoUrl(url);

            await saveToIndexedDB(
                selectedFile.name,
                url,
                selectedFile.size,
                uploadDuration
            );

            setTimeout(() => {
                setSelectedFile(null);
                setUploadProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }, 500);
        } catch (error) {
            setErrorMessage(
                error.name === "AbortError" ? "Upload cancelled" : error.message
            );
            setUploadStatus("error");
        } finally {
            setUploading(false);
        }
    };

    const handleCancel = () => abortControllerRef.current?.abort();

    const handleReset = () => {
        setSelectedFile(null);
        setUploadProgress(0);
        setUploadStatus("idle");
        setErrorMessage("");
        setVideoUrl("");
        setCopied(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleCopyUrl = async (url = videoUrl, id = null) => {
        try {
            // Encode spaces and special characters in the URL to make it valid
            const encodedUrl = encodeURI(url);
            await navigator.clipboard.writeText(encodedUrl);
            if (id) {
                setCopiedId(id);
                setTimeout(() => setCopiedId(null), 2000);
            } else {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
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

    // Handle password submission
    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        setPasswordError("");

        const correctPassword = "Stepron@123";

        if (passwordInput === correctPassword) {
            localStorage.setItem('videoUploaderAuth', 'true');
            setIsAuthenticated(true);
            setPasswordInput("");
        } else {
            setPasswordError("Incorrect password. Please try again.");
        }
    };

    // Show password screen if not authenticated
    if (!isAuthenticated) {
        if (isLoading) {
            return <LoadingScreen />;
        }

        return (
            <PasswordScreen
                passwordInput={passwordInput}
                setPasswordInput={setPasswordInput}
                handlePasswordSubmit={handlePasswordSubmit}
                passwordError={passwordError}
            />
        );
    }

    // Show loading screen while initializing
    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header Card */}
                <Card className="shadow-lg border-0">
                    <CardContent>
                        {/* Drop Zone */}
                        <div
                            className={cn(
                                "relative rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer",
                                isDragging
                                    ? "border-primary bg-primary/5 scale-[1.02]"
                                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                                selectedFile && "border-primary bg-primary/5",
                                uploading && "pointer-events-none opacity-75"
                            )}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => !uploading && fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleFileSelect}
                                hidden
                            />

                            {!selectedFile ? (
                                <div className="flex flex-col items-center justify-center py-12 px-4">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                                        <Upload className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="mb-1 text-lg font-medium">
                                        Drop your video here
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        or click to browse
                                    </p>

                                </div>
                            ) : (
                                <div className="flex items-center gap-4 p-6">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                                        <Video className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{selectedFile.name}</p>
                                        <div className="flex gap-3 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <HardDrive className="h-3 w-3" />
                                                {formatFileSize(selectedFile.size)}
                                            </span>
                                            <span>
                                                {Math.ceil(selectedFile.size / CHUNK_SIZE)} chunks
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {selectedFile && (
                            <div className="mt-4 flex gap-2">
                                {!uploading ? (
                                    <>
                                        <Button onClick={handleUpload} className="flex-1">
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload Video
                                        </Button>
                                        <Button variant="outline" onClick={handleReset}>
                                            <X className="mr-2 h-4 w-4" />
                                            Clear
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant="destructive"
                                        onClick={handleCancel}
                                        className="flex-1"
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        Cancel Upload
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Upload Progress */}
                        {uploading && (
                            <div className="mt-6 space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Uploading...
                                    </span>
                                    <span className="text-muted-foreground">
                                        {chunksCompleted}/{totalChunks} chunks
                                    </span>
                                </div>
                                <Progress value={uploadProgress} className="h-2" />
                                <p className="text-center text-sm font-medium">
                                    {uploadProgress}%
                                </p>
                            </div>
                        )}

                        {/* Success State */}
                        {uploadStatus === "success" && videoUrl && (
                            <div className="mt-6 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-green-800 dark:text-green-200">
                                            Upload Complete!
                                        </h3>
                                        <div className="mt-2 flex gap-2">
                                            <input
                                                type="text"
                                                value={videoUrl}
                                                readOnly
                                                className="flex-1 min-w-0 rounded-md border bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                                            />
                                            <Button
                                                size="sm"
                                                variant={copied ? "default" : "outline"}
                                                onClick={() => handleCopyUrl()}
                                            >
                                                {copied ? (
                                                    <>
                                                        <Check className="mr-1 h-4 w-4" />
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="mr-1 h-4 w-4" />
                                                        Copy
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {uploadStatus === "error" && (
                            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-medium text-red-800 dark:text-red-200">
                                            Upload Failed
                                        </h3>
                                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                            {errorMessage}
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleReset}
                                            className="mt-3"
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Upload History - Always visible */}
                <UploadHistory
                    uploadHistory={uploadHistory}
                    onCopyUrl={handleCopyUrl}
                    onDelete={(id, fileName) => setDeleteConfirm({ show: true, id, fileName })}
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
                        Are you sure you want to delete all {uploadHistory.length} uploaded video records? This will permanently remove all history.
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
                onCancel={() => setDeleteConfirm({ show: false, id: null, fileName: "" })}
                confirmText="Delete"
            />
        </div>
    );
};

export default VideoUploader;
