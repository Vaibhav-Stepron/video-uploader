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
    Calendar,
    ClipboardList,
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
    const [uploadStartTime, setUploadStartTime] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [selectedDate, setSelectedDate] = useState("");
    const [copiedAll, setCopiedAll] = useState(false);

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

    // Get unique dates for date picker
    const uniqueDates = [...new Set(
        uploadHistory.map((item) => {
            const date = new Date(item.uploadedAt);
            return date.toISOString().split('T')[0];
        })
    )].sort((a, b) => new Date(b) - new Date(a));

    // Filter and sort history by date
    const filteredHistory = uploadHistory
        .filter((item) => {
            if (!selectedDate) return true;
            const itemDate = new Date(item.uploadedAt).toISOString().split('T')[0];
            return itemDate === selectedDate;
        })
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    // Global copy function - copies all visible records in Excel-compatible table format
    const handleCopyAll = async () => {
        try {
            // Header row
            const header = "File Name\tURL\tDate\tTime";

            // Data rows (tab-separated for Excel compatibility)
            const rows = filteredHistory.map((item) => {
                const date = new Date(item.uploadedAt);
                const formattedDate = date.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                });
                const formattedTime = date.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                });
                const encodedUrl = encodeURI(item.url);
                return `${item.fileName}\t${encodedUrl}\t${formattedDate}\t${formattedTime}`;
            });

            const copyText = [header, ...rows].join("\n");

            await navigator.clipboard.writeText(copyText);
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 2000);
        } catch (error) {
            console.error("Failed to copy all:", error);
        }
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header Card */}
                <Card className="shadow-lg border-0">
                    <CardHeader className="text-center pb-4">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                            <Video className="h-7 w-7 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Video Uploader</CardTitle>
                        <CardDescription className="text-sm">
                            Chunked uploads with parallel processing
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
                <Card className="shadow-lg border-0">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-lg">Upload History</CardTitle>
                                    <Badge variant="secondary" className="text-xs">
                                        {filteredHistory.length} {filteredHistory.length === 1 ? 'file' : 'files'}
                                    </Badge>
                                </div>
                                {uploadHistory.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearHistory}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        <Trash2 className="mr-1 h-4 w-4" />
                                        Clear All
                                    </Button>
                                )}
                            </div>
                            {uploadHistory.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <select
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            <option value="">All Dates</option>
                                            {uniqueDates.map((date) => (
                                                <option key={date} value={date}>
                                                    {new Date(date).toLocaleDateString("en-US", {
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric",
                                                    })}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {filteredHistory.length > 0 && (
                                        <Button
                                            variant={copiedAll ? "default" : "outline"}
                                            size="sm"
                                            onClick={handleCopyAll}
                                            className="ml-auto"
                                        >
                                            {copiedAll ? (
                                                <>
                                                    <Check className="mr-1 h-4 w-4" />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <ClipboardList className="mr-1 h-4 w-4" />
                                                    Copy All
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                    <Clock className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    {uploadHistory.length === 0 ? "No uploads yet" : "No uploads for selected date"}
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                    {uploadHistory.length === 0 ? "Your uploaded videos will appear here" : "Try selecting a different date or 'All Dates'"}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {filteredHistory.map((item) => (
                                    <div
                                        key={item.id}
                                        className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:bg-muted/50 hover:shadow-sm"
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                            <Video className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate text-sm">
                                                {item.fileName}
                                            </p>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
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
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default VideoUploader;
