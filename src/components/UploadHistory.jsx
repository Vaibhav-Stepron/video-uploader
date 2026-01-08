import { useState } from "react";
import {
    Video,
    Copy,
    Check,
    Trash2,
    Clock,
    HardDrive,
    Calendar,
    ClipboardList,
    Smartphone,
    Globe,
    Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFileSize, formatDate, formatDuration } from "@/lib/utils";

const getPlatformIcon = (platform) => {
    switch (platform) {
        case "Android":
        case "iOS":
            return Smartphone;
        case "Web":
            return Globe;
        default:
            return Monitor;
    }
};

const getPlatformColor = (platform) => {
    switch (platform) {
        case "Android":
            return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        case "iOS":
            return "bg-blue-500/20 text-blue-400 border-blue-500/30";
        case "Web":
            return "bg-purple-500/20 text-purple-400 border-purple-500/30";
        default:
            return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
};

const UploadHistory = ({
    uploadHistory,
    onCopyUrl,
    onDelete,
    onClearAll,
    copiedId
}) => {
    const [selectedDate, setSelectedDate] = useState("");
    const [copiedAll, setCopiedAll] = useState(false);

    const uniqueDates = [...new Set(
        uploadHistory.map((item) => {
            const date = new Date(item.uploadedAt);
            return date.toISOString().split('T')[0];
        })
    )].sort((a, b) => new Date(b) - new Date(a));

    const filteredHistory = uploadHistory
        .filter((item) => {
            if (!selectedDate) return true;
            const itemDate = new Date(item.uploadedAt).toISOString().split('T')[0];
            return itemDate === selectedDate;
        })
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    const handleCopyAll = async () => {
        try {
            const header = "File Name\tPlatform\tURL\tDate\tTime";
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
                const platform = item.platform || "N/A";
                return `${item.fileName}\t${platform}\t${encodedUrl}\t${formattedDate}\t${formattedTime}`;
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
        <Card className="border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">Upload History</CardTitle>
                            <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30">
                                {filteredHistory.length} {filteredHistory.length === 1 ? 'file' : 'files'}
                            </Badge>
                        </div>
                        {uploadHistory.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClearAll}
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
                                    className="rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
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
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                            <Clock className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                            {uploadHistory.length === 0 ? "No uploads yet" : "No uploads for selected date"}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                            {uploadHistory.length === 0 ? "Your uploaded videos will appear here" : "Try selecting a different date or 'All Dates'"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                        {filteredHistory.map((item) => (
                            <div
                                key={item.id}
                                className="group flex items-center gap-3 rounded-xl border border-border/50 bg-background/30 p-3 transition-all hover:bg-background/50 hover:border-primary/30"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                    <Video className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium truncate text-sm">
                                            {item.fileName}
                                        </p>
                                        {item.platform && (
                                            <Badge
                                                variant="outline"
                                                className={`text-xs shrink-0 ${getPlatformColor(item.platform)}`}
                                            >
                                                {(() => {
                                                    const Icon = getPlatformIcon(item.platform);
                                                    return (
                                                        <>
                                                            <Icon className="h-3 w-3 mr-1" />
                                                            {item.platform}
                                                        </>
                                                    );
                                                })()}
                                            </Badge>
                                        )}
                                    </div>
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
                                        onClick={() => onCopyUrl(item.url, item.id)}
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
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => onDelete(item.id, item.fileName)}
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
    );
};

export default UploadHistory;
