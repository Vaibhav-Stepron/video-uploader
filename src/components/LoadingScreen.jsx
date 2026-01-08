import { Video, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const APP_VERSION = "0.0.1";

const LoadingScreen = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <Video className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Video Uploader</h2>
                    <Badge variant="outline" className="text-xs">
                        v{APP_VERSION}
                    </Badge>
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            </div>
        </div>
    );
};

export default LoadingScreen;
