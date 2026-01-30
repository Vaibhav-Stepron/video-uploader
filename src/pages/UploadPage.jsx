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
    Play,
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
import { addUpload, initDB } from "@/lib/indexedDB";
import confetti from "canvas-confetti";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const PARALLEL_UPLOADS = 3;
const BASE_URL = "https://bimiscwebapi-staging.azurewebsites.net/api/Users";
const PLATFORMS = ["Android", "iOS", "Web"];

const UploadPage = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [videoName, setVideoName] = useState("");
    const [platform, setPlatform] = useState("Android");
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [copied, setCopied] = useState(false);
    const [chunksCompleted, setChunksCompleted] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState("");

    const fileInputRef = useRef(null);
    const abortControllerRef = useRef(null);
    const wakeLockRef = useRef(null);

    // Initialize IndexedDB on mount
    useEffect(() => {
        const initialize = async () => {
            try {
                await initDB();
            } catch (error) {
                console.error("Failed to initialize IndexedDB:", error);
            }
        };
        initialize();
    }, []);

    // Keep screen awake during upload and warn before closing
    useEffect(() => {
        const requestWakeLock = async () => {
            if (uploading && "wakeLock" in navigator) {
                try {
                    wakeLockRef.current = await navigator.wakeLock.request("screen");
                    console.log("Wake Lock activated");
                } catch (err) {
                    console.error("Wake Lock error:", err);
                }
            }
        };

        const releaseWakeLock = async () => {
            if (wakeLockRef.current) {
                try {
                    await wakeLockRef.current.release();
                    wakeLockRef.current = null;
                    console.log("Wake Lock released");
                } catch (err) {
                    console.error("Wake Lock release error:", err);
                }
            }
        };

        const handleBeforeUnload = (e) => {
            if (uploading) {
                e.preventDefault();
                e.returnValue =
                    "Upload in progress. Are you sure you want to leave? The upload will be cancelled.";
                return e.returnValue;
            }
        };

        if (uploading) {
            requestWakeLock();
            window.addEventListener("beforeunload", handleBeforeUnload);
        } else {
            releaseWakeLock();
        }

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            releaseWakeLock();
        };
    }, [uploading]);

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
            const file = files[0];
            setSelectedFile(file);
            setVideoName(file.name.replace(/\.[^/.]+$/, ""));

            // Create preview URL
            const previewUrl = URL.createObjectURL(file);
            setVideoPreviewUrl(previewUrl);

            setUploadStatus("idle");
            setErrorMessage("");
        }
    }, []);

    const handleFileSelect = useCallback((e) => {
        if (e.target.files?.length > 0) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setVideoName(file.name.replace(/\.[^/.]+$/, ""));

            // Create preview URL
            const previewUrl = URL.createObjectURL(file);
            setVideoPreviewUrl(previewUrl);

            setUploadStatus("idle");
            setErrorMessage("");
        }
    }, []);

    const uploadChunk = async (file, chunkIndex, totalChunks, signal, fileName) => {
        const start = chunkIndex * CHUNK_SIZE;
        const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));

        const encodedFileName = encodeURIComponent(fileName);

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

    const finalizeUpload = async (file, totalChunks, fileName) => {
        const encodedFileName = encodeURIComponent(fileName);

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

        // Create unique filename with timestamp
        const ext = selectedFile.name.split('.').pop();
        const uniqueFileName = `${videoName}_${Date.now()}.${ext}`;

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
                            abortControllerRef.current.signal,
                            uniqueFileName
                        ).then(() => {
                            completed++;
                            setChunksCompleted(completed);
                            setUploadProgress(Math.round((completed / chunks) * 95));
                        })
                    )
                );
            }

            setUploadProgress(98);
            const result = await finalizeUpload(selectedFile, chunks, uniqueFileName);
            const url = result.Url || result.url;

            const uploadDuration = Date.now() - startTime;

            setUploadProgress(100);
            setUploadStatus("success");
            setVideoUrl(url);

            // Trigger colorful confetti celebration
            const colors = ['#00b37e', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#22d3ee'];

            // Center burst
            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 },
                colors,
                shapes: ['square', 'circle'],
                scalar: 1.2,
                gravity: 1,
                drift: 0,
                ticks: 200
            });

            // Left side burst
            setTimeout(() => {
                confetti({
                    particleCount: 80,
                    angle: 60,
                    spread: 70,
                    origin: { x: 0, y: 0.6 },
                    colors,
                    shapes: ['square', 'circle'],
                    scalar: 1,
                    gravity: 1.2,
                    ticks: 200
                });
            }, 150);

            // Right side burst
            setTimeout(() => {
                confetti({
                    particleCount: 80,
                    angle: 120,
                    spread: 70,
                    origin: { x: 1, y: 0.6 },
                    colors,
                    shapes: ['square', 'circle'],
                    scalar: 1,
                    gravity: 1.2,
                    ticks: 200
                });
            }, 300);

            // Additional top burst for extra celebration
            setTimeout(() => {
                confetti({
                    particleCount: 100,
                    spread: 120,
                    origin: { y: 0.3 },
                    colors,
                    shapes: ['square', 'circle'],
                    scalar: 0.9,
                    gravity: 0.8,
                    ticks: 250
                });
            }, 450);

            await addUpload({
                fileName: uniqueFileName,
                url,
                fileSize: selectedFile.size,
                uploadDuration,
                platform,
                originalFileName: selectedFile.name,
            });

            setTimeout(() => {
                if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
                setSelectedFile(null);
                setVideoName("");
                setUploadProgress(0);
                setVideoPreviewUrl("");
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
        if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
        setSelectedFile(null);
        setVideoName("");
        setPlatform("Android");
        setUploadProgress(0);
        setUploadStatus("idle");
        setErrorMessage("");
        setVideoUrl("");
        setCopied(false);
        setVideoPreviewUrl("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleCopyUrl = async () => {
        try {
            const encodedUrl = encodeURI(videoUrl);
            await navigator.clipboard.writeText(encodedUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    return (
        <div style={{ height: 'calc(100vh - 100px)' }} className="w-full flex flex-col bg-background overflow-hidden">
            <div className="flex-1 flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8">
                <div className="w-full h-full max-w-7xl">
                    <Card className="shadow-xl border-0 w-full  flex flex-col bg-card/95 backdrop-blur-sm">
                        <CardContent className="flex-1 flex flex-col overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 min-h-0 pt-6">
                            {/* Grid Layout for wide screens */}
                            <div className={cn(
                                "grid gap-4 lg:gap-6",
                                selectedFile ? "lg:grid-cols-2" : "lg:grid-cols-1"
                            )}>
                                {/* Drop Zone */}
                                <div
                                    className={cn(
                                        "relative rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer",
                                        !selectedFile && "min-h-[200px] sm:min-h-[240px]",
                                        selectedFile && "h-fit",
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
                                        <div className="flex flex-col items-center justify-center py-10 sm:py-12 px-4">
                                            <div className="mb-3 sm:mb-4 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-muted">
                                                <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                                            </div>
                                            <p className="mb-1 text-base sm:text-lg font-medium text-center">
                                                Drop your video here
                                            </p>
                                            <p className="text-xs sm:text-sm text-muted-foreground text-center">
                                                or click to browse
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 p-4 sm:p-5">
                                            {/* Video Preview */}
                                            {videoPreviewUrl && (
                                                <div className="relative rounded-lg overflow-hidden bg-black shadow-lg">
                                                    <video
                                                        src={videoPreviewUrl}
                                                        className="w-full max-h-48 sm:max-h-56 lg:max-h-72 object-contain"
                                                        controls
                                                    />
                                                </div>
                                            )}
                                            {/* File Info */}
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                                                    <Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate text-sm sm:text-base">{selectedFile.name}</p>
                                                    <div className="flex gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground flex-wrap">
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
                                        </div>
                                    )}
                                </div>

                                {/* Form Fields and Actions - Only visible when file is selected */}
                                {selectedFile && (
                                    <div className="space-y-4 lg:space-y-5">
                                        {/* Video Name and Platform Selection */}
                                        {!uploading && (
                                            <div className="space-y-3 sm:space-y-4">
                                                <div>
                                                    <label className="text-xs sm:text-xs text-muted-foreground font-medium block mb-1.5">Video Name</label>
                                                    <input
                                                        type="text"
                                                        value={videoName}
                                                        onChange={(e) => setVideoName(e.target.value)}
                                                        placeholder="Enter video name"
                                                        className="w-full rounded-md border border-border bg-background px-3 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs sm:text-xs text-muted-foreground font-medium block mb-1.5">Platform</label>
                                                    <select
                                                        value={platform}
                                                        onChange={(e) => setPlatform(e.target.value)}
                                                        className="w-full rounded-md border border-border bg-background pl-3 pr-10 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3e%3cpolyline points=%226 9 12 15 18 9%22%3e%3c/polyline%3e%3c/svg%3e')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
                                                    >
                                                        {PLATFORMS.map((p) => (
                                                            <option key={p} value={p}>{p}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {/* Upload Progress */}
                                        {uploading && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between text-xs sm:text-sm">
                                                    <span className="flex items-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                        <span className="font-medium">Uploading...</span>
                                                    </span>
                                                    <span className="text-muted-foreground font-medium">
                                                        {chunksCompleted}/{totalChunks} chunks
                                                    </span>
                                                </div>
                                                <Progress value={uploadProgress} className="h-2 sm:h-2.5" />
                                                <p className="text-center text-sm sm:text-base font-semibold text-primary">
                                                    {uploadProgress}%
                                                </p>
                                            </div>
                                        )}

                                        {/* Success State */}
                                        {uploadStatus === "success" && videoUrl && (
                                            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3 sm:p-4 shadow-md">
                                                <div className="flex items-start gap-2 sm:gap-3">
                                                    <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 flex-shrink-0">
                                                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold text-sm sm:text-base text-green-800 dark:text-green-200">
                                                            Upload Complete!
                                                        </h3>
                                                        <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                                            <input
                                                                type="text"
                                                                value={videoUrl}
                                                                readOnly
                                                                className="flex-1 min-w-0 rounded-md border bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm"
                                                            />
                                                            <Button
                                                                size="sm"
                                                                variant={copied ? "default" : "outline"}
                                                                onClick={handleCopyUrl}
                                                                className="w-full sm:w-auto"
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
                                            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-3 sm:p-4 shadow-md">
                                                <div className="flex items-start gap-2 sm:gap-3">
                                                    <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 flex-shrink-0">
                                                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold text-sm sm:text-base text-red-800 dark:text-red-200">
                                                            Upload Failed
                                                        </h3>
                                                        <p className="mt-1 text-xs sm:text-sm text-red-600 dark:text-red-400">
                                                            {errorMessage}
                                                        </p>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={handleReset}
                                                            className="mt-3 w-full sm:w-auto"
                                                        >
                                                            Try Again
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                            {!uploading ? (
                                                <>
                                                    <Button onClick={handleUpload} className="flex-1 shadow-md">
                                                        <Upload className="mr-2 h-4 w-4" />
                                                        Upload Video
                                                    </Button>
                                                    <Button variant="outline" onClick={handleReset} className="sm:w-auto">
                                                        <X className="mr-2 h-4 w-4" />
                                                        Clear
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    variant="destructive"
                                                    onClick={handleCancel}
                                                    className="flex-1 shadow-md"
                                                >
                                                    <X className="mr-2 h-4 w-4" />
                                                    Cancel Upload
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default UploadPage;
