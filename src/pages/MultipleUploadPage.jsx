import { useState, useRef, useEffect } from "react";
import {
    Upload,
    X,
    Video,
    HardDrive,
    Loader2,
    Play,
    Trash2,
    CheckCircle2,
    AlertCircle,
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

const CHUNK_SIZE = 5 * 1024 * 1024;
const PARALLEL_UPLOADS = 3;
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const PLATFORMS = ["Android", "iOS", "Web"];

const MultipleUploadPage = () => {
    const [videos, setVideos] = useState([]);
    const [chunksCompleted, setChunksCompleted] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [previewVideo, setPreviewVideo] = useState(null);

    const fileInputRef = useRef(null);
    const abortControllerRef = useRef(null);
    const videoPreviewRef = useRef(null);
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

    useEffect(() => {
        const requestWakeLock = async () => {
            if (uploading && "wakeLock" in navigator) {
                try {
                    wakeLockRef.current = await navigator.wakeLock.request("screen");
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
                } catch (err) {
                    console.error("Wake Lock release error:", err);
                }
            }
        };

        if (uploading) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }

        return () => {
            releaseWakeLock();
        };
    }, [uploading]);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        const videoFiles = files.filter((file) => file.type.startsWith("video/"));

        const newVideos = videoFiles.map((file, index) => ({
            id: Date.now() + index,
            file,
            name: file.name.replace(/\.[^/.]+$/, ""),
            platform: "Android",
            status: "pending",
            progress: 0,
            url: null,
            error: null,
            previewUrl: URL.createObjectURL(file),
        }));

        setVideos((prev) => [...prev, ...newVideos]);
        e.target.value = "";
    };

    const updateVideo = (id, updates) => {
        setVideos((prev) =>
            prev.map((video) =>
                video.id === id ? { ...video, ...updates } : video
            )
        );
    };

    const removeVideo = (id) => {
        const video = videos.find((v) => v.id === id);
        if (video?.previewUrl) {
            URL.revokeObjectURL(video.previewUrl);
        }
        setVideos((prev) => prev.filter((video) => video.id !== id));
    };

    const handlePreview = (video) => {
        setPreviewVideo(video);
    };

    const closePreview = () => {
        if (videoPreviewRef.current) {
            videoPreviewRef.current.pause();
        }
        setPreviewVideo(null);
    };

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

    const uploadSingleVideo = async (video) => {
        const startTime = Date.now();
        
        // Create unique filename with timestamp (same as single upload)
        const ext = video.file.name.split('.').pop();
        const uniqueFileName = `${video.name}_${Date.now()}.${ext}`;
        
        const chunks = Math.ceil(video.file.size / CHUNK_SIZE);
        setTotalChunks(chunks);
        setChunksCompleted(0);
        updateVideo(video.id, { status: "uploading", progress: 0 });
        abortControllerRef.current = new AbortController();

        try {
            let completed = 0;
            const chunkIndices = Array.from({ length: chunks }, (_, i) => i);

            for (let i = 0; i < chunkIndices.length; i += PARALLEL_UPLOADS) {
                const batch = chunkIndices.slice(i, i + PARALLEL_UPLOADS);
                await Promise.all(
                    batch.map((idx) =>
                        uploadChunk(
                            video.file,
                            idx,
                            chunks,
                            abortControllerRef.current.signal,
                            uniqueFileName
                        ).then(() => {
                            completed++;
                            setChunksCompleted(completed);
                            const progress = Math.round((completed / chunks) * 95);
                            updateVideo(video.id, { progress });
                        })
                    )
                );
            }

            updateVideo(video.id, { progress: 98 });
            const result = await finalizeUpload(video.file, chunks, uniqueFileName);
            const url = result.Url || result.url;
            const uploadDuration = Date.now() - startTime;

            await addUpload({
                fileName: uniqueFileName,
                url,
                fileSize: video.file.size,
                uploadDuration,
                platform: video.platform,
                originalFileName: video.file.name,
            });

            // Trigger confetti celebration for successful upload
            const colors = ['#00b37e', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];
            confetti({
                particleCount: 80,
                spread: 60,
                origin: { y: 0.6 },
                colors,
                shapes: ['square', 'circle'],
                scalar: 0.8,
            });

            updateVideo(video.id, {
                status: "success",
                progress: 100,
                url,
            });
        } catch (error) {
            updateVideo(video.id, {
                status: "error",
                error: error.name === "AbortError" ? "Upload cancelled" : error.message,
            });
            throw error;
        }
    };

    const handleUploadAll = async () => {
        const pendingVideos = videos.filter(
            (v) => v.status === "pending" || v.status === "error"
        );
        if (pendingVideos.length === 0) return;

        setUploading(true);
        for (const video of pendingVideos) {
            try {
                await uploadSingleVideo(video);
            } catch (error) {
                console.error("Upload failed:", error);
            }
        }
        setUploading(false);
    };

    const handleCancel = () => {
        abortControllerRef.current?.abort();
        setUploading(false);
    };

    const pendingCount = videos.filter((v) => v.status === "pending").length;
    const successCount = videos.filter((v) => v.status === "success").length;
    const errorCount = videos.filter((v) => v.status === "error").length;

    return (
        <div className="h-full overflow-y-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <Card className="shadow-lg border-0">
                    <CardHeader className="text-center pb-4">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                            <Video className="h-7 w-7 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold">
                            Upload Multiple Videos
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Add multiple videos, select platform, and upload one by one
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-6">
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full"
                                size="lg"
                            >
                                <Upload className="mr-2 h-5 w-5" />
                                Select Videos
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                multiple
                                onChange={handleFileSelect}
                                hidden
                            />
                        </div>

                        {videos.length > 0 && (
                            <div className="mb-6 grid grid-cols-3 gap-4">
                                <div className="text-center p-3 rounded-lg bg-muted">
                                    <div className="text-2xl font-bold">{pendingCount}</div>
                                    <div className="text-xs text-muted-foreground">Pending</div>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{successCount}</div>
                                    <div className="text-xs text-muted-foreground">Uploaded</div>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{errorCount}</div>
                                    <div className="text-xs text-muted-foreground">Failed</div>
                                </div>
                            </div>
                        )}

                        {videos.length > 0 && (
                            <div className="mb-6 flex gap-2">
                                {!uploading ? (
                                    <>
                                        <Button onClick={handleUploadAll} disabled={pendingCount === 0} className="flex-1">
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload All ({pendingCount})
                                        </Button>
                                        <Button variant="outline" onClick={() => setVideos([])}>
                                            Clear All
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="destructive" onClick={handleCancel} className="flex-1">
                                        <X className="mr-2 h-4 w-4" />
                                        Cancel Upload
                                    </Button>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {videos.map((video) => (
                                <Card
                                    key={video.id}
                                    className={cn(
                                        "border-2",
                                        video.status === "uploading" && "border-primary bg-primary/5",
                                        video.status === "success" && "border-green-200 dark:border-green-900",
                                        video.status === "error" && "border-red-200 dark:border-red-900"
                                    )}
                                >
                                    <CardContent className="p-4">
                                        <div className="space-y-3">
                                            <div
                                                className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer group"
                                                onClick={() => handlePreview(video)}
                                            >
                                                <video src={video.previewUrl} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Play className="h-8 w-8 text-white" />
                                                </div>
                                                {!uploading && video.status !== "uploading" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => { e.stopPropagation(); removeVideo(video.id); }}
                                                        className="absolute top-2 right-2 h-8 w-8 bg-black/50 hover:bg-destructive text-white"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-muted-foreground">Video Name</label>
                                                    <input
                                                        type="text"
                                                        value={video.name}
                                                        onChange={(e) => updateVideo(video.id, { name: e.target.value })}
                                                        disabled={uploading || video.status === "success"}
                                                        className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                    />
                                                </div>

                                                <div className="flex gap-4 items-end">
                                                    <div className="flex-1">
                                                        <label className="text-xs text-muted-foreground">Platform</label>
                                                        <select
                                                            value={video.platform}
                                                            onChange={(e) => updateVideo(video.id, { platform: e.target.value })}
                                                            disabled={uploading || video.status === "success"}
                                                            className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                        >
                                                            {PLATFORMS.map((platform) => (
                                                                <option key={platform} value={platform}>{platform}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                        <HardDrive className="h-3 w-3" />
                                                        {formatFileSize(video.file.size)}
                                                    </div>
                                                </div>

                                                {video.status === "uploading" && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="flex items-center gap-1">
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                Uploading...
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                {chunksCompleted}/{totalChunks} chunks
                                                            </span>
                                                        </div>
                                                        <Progress value={video.progress} className="h-1.5" />
                                                    </div>
                                                )}

                                                {video.status === "success" && (
                                                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Upload Complete!
                                                    </div>
                                                )}

                                                {video.status === "error" && (
                                                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                                                        <AlertCircle className="h-4 w-4" />
                                                        {video.error}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {videos.length === 0 && (
                            <div className="text-center py-12">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                    <Video className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <p className="text-lg font-medium mb-1">No videos selected</p>
                                <p className="text-sm text-muted-foreground">
                                    Click the button above to select multiple videos
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {previewVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={closePreview}>
                    <div className="relative w-full max-w-4xl mx-4" onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={closePreview}
                            className="absolute -top-12 right-0 text-white hover:bg-white/20"
                        >
                            <X className="h-6 w-6" />
                        </Button>
                        <div className="bg-background rounded-lg p-4">
                            <h3 className="text-lg font-semibold mb-3">{previewVideo.name}</h3>
                            <video
                                ref={videoPreviewRef}
                                src={previewVideo.previewUrl}
                                controls
                                autoPlay
                                className="w-full rounded-lg"
                            />
                            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Platform: {previewVideo.platform}</span>
                                <span>Size: {formatFileSize(previewVideo.file.size)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultipleUploadPage;
