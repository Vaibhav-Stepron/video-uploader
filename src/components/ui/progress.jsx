import * as React from "react";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef(({ className, value, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "relative h-3 w-full overflow-hidden rounded-full bg-secondary/50",
            className
        )}
        {...props}
    >
        <div
            className="h-full w-full flex-1 bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-in-out shadow-sm shadow-primary/30"
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </div>
));
Progress.displayName = "Progress";

export { Progress };
