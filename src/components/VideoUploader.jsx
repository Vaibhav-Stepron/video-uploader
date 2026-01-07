import { useState, useRef, useEffect, useCallback } from "react";
import {
    Upload,
    X,
    Copy,
    Check,
    Trash2,
    Video,
    Clock,
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
import { Badge } from "@/components/ui/badge";
import { cn, formatFileSize, formatDate, formatDuration } from "@/lib/utils";
import {
    initDB,
    addUpload,
    getAllUploads,
    deleteUpload,
    clearAllUploads,
} from "@/lib/indexedDB";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const PARALLEL_UPLOADS = 3;
const BASE_URL = "https://bimiscwebapi-test.azurewebsites.net/api/Users";

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
    const [uploadStartTime, setUploadStartTime] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    const fileInputRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Initialize IndexedDB and load history
    useEffect(() => {
        const loadHistory = async () => {
            try {
                await initDB();
                const uploads = await getAllUploads();
                setUploadHistory(uploads);
            } catch (error) {
                console.error("Failed to load upload history:", error);
            }
        };
        loadHistory();
    }, []);

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

        const formData = new FormData();
        formData.append("FileName", file.name);
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
        const formData = new FormData();
        formData.append("FileName", file.name);
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
        setUploadStartTime(startTime);

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
            await navigator.clipboard.writeText(url);
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
        } catch (error) {
            console.error("Failed to clear history:", error);
        }
    };

    const handleRemoveHistoryItem = async (id) => {
        try {
            await deleteUpload(id);
            setUploadHistory((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            console.error("Failed to remove item:", error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header Card */}
                <Card>
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Video className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-3xl">Video Uploader</CardTitle>
                        <CardDescription>
                            Chunked uploads with parallel processing • 5MB chunks • 3 parallel
                            uploads
                        </CardDescription>
                    </CardHeader>
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
                                    <div className="mt-4 flex gap-2">
                                        <Badge variant="secondary">No size limit</Badge>
                                        <Badge variant="secondary">5MB chunks</Badge>
                                        <Badge variant="secondary">3 parallel</Badge>
                                    </div>
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

                {/* Upload History */}
                {uploadHistory.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Upload History</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearHistory}
                                    className="text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="mr-1 h-4 w-4" />
                                    Clear All
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {uploadHistory.map((item) => (
                                <div
                                    key={item.id}
                                    className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                        <Video className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate text-sm">
                                            {item.fileName}
                                        </p>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <HardDrive className="h-3 w-3" />
                                                {formatFileSize(item.fileSize)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDuration(item.uploadDuration)}
                                            </span>
                                            <span>{formatDate(item.uploadedAt)}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button
                                            size="icon"
                                            variant={copiedId === item.id ? "default" : "ghost"}
                                            className="h-8 w-8"
                                            onClick={() => handleCopyUrl(item.url, item.id)}
                                            title="Copy URL"
                                        >
                                            {copiedId === item.id ? (
                                                <Check className="h-4 w-4" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleRemoveHistoryItem(item.id)}
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default VideoUploader;
