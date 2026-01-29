import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Bug, Sparkles, Zap } from "lucide-react";

const ChangelogPage = () => {
    const changes = [
        {
            version: "1.2.0",
            date: "January 29, 2026",
            type: "feature",
            items: [
                {
                    icon: Sparkles,
                    title: "Dark & Light Mode",
                    description: "Added theme toggle for dark and light modes with persistent preference",
                },
                {
                    icon: FileText,
                    title: "Changelog Page",
                    description: "New changelog page to track all updates and improvements",
                },
            ],
        },
        {
            version: "1.1.0",
            date: "January 28, 2026",
            type: "feature",
            items: [
                {
                    icon: Plus,
                    title: "Custom Filename Support",
                    description: "Added ability to customize video filenames before upload with timestamp uniqueness",
                },
                {
                    icon: Sparkles,
                    title: "Platform Selection",
                    description: "Select target platform (Android, iOS, Web) for each video upload",
                },
                {
                    icon: Zap,
                    title: "Video Preview",
                    description: "View video preview with built-in player before uploading",
                },
                {
                    icon: Sparkles,
                    title: "Success Animation",
                    description: "Colorful confetti celebration animation on successful uploads",
                },
            ],
        },
        {
            version: "1.0.0",
            date: "January 25, 2026",
            type: "release",
            items: [
                {
                    icon: Zap,
                    title: "Initial Release",
                    description: "Chunked video upload with parallel processing",
                },
                {
                    icon: Plus,
                    title: "Multiple Upload Support",
                    description: "Upload multiple videos in batch with individual progress tracking",
                },
                {
                    icon: FileText,
                    title: "Upload History",
                    description: "View and manage upload history with IndexedDB storage",
                },
            ],
        },
    ];

    const getTypeColor = (type) => {
        switch (type) {
            case "feature":
                return "bg-primary/20 text-primary border-primary/30";
            case "release":
                return "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30";
            case "fix":
                return "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30";
            default:
                return "bg-secondary text-secondary-foreground";
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <Card className="shadow-lg border-0">
                    <CardHeader className="text-center pb-4">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                            <FileText className="h-7 w-7 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Changelog</CardTitle>
                        <CardDescription className="text-sm">
                            Track updates, new features, and improvements
                        </CardDescription>
                    </CardHeader>
                </Card>

                <div className="space-y-6">
                    {changes.map((release, index) => (
                        <Card key={index} className="shadow-lg border-0">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CardTitle className="text-xl font-bold">
                                            Version {release.version}
                                        </CardTitle>
                                        <Badge className={getTypeColor(release.type)}>
                                            {release.type}
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-sm">
                                        {release.date}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {release.items.map((item, itemIndex) => {
                                        const Icon = item.icon;
                                        return (
                                            <div
                                                key={itemIndex}
                                                className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                            >
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                                                    <Icon className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-sm sm:text-base mb-1">
                                                        {item.title}
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        {item.description}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="shadow-lg border-0 bg-muted/30">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <Bug className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Found a bug or have a feature request?</p>
                                <p className="text-xs text-muted-foreground">
                                    Please report issues to help us improve the application.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ChangelogPage;
