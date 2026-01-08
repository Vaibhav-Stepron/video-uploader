import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const APP_VERSION = "0.0.1";

const PasswordScreen = ({
    passwordInput,
    setPasswordInput,
    handlePasswordSubmit,
    passwordError
}) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Lock className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">
                        Enter Password
                    </CardTitle>
                    <CardDescription>
                        Enter password to access the video uploader
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <input
                                type="password"
                                placeholder="Enter password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className="w-full rounded-md border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                autoFocus
                            />
                            {passwordError && (
                                <p className="text-sm text-red-600 dark:text-red-400">
                                    {passwordError}
                                </p>
                            )}
                        </div>
                        <Button type="submit" className="w-full">
                            <Lock className="mr-2 h-4 w-4" />
                            Unlock
                        </Button>
                    </form>
                    <div className="mt-4 text-center">
                        <Badge variant="outline" className="text-xs">
                            v{APP_VERSION}
                        </Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PasswordScreen;
