import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-primary/30 bg-primary/20 text-primary",
                secondary:
                    "border-border/50 bg-secondary/50 text-secondary-foreground",
                destructive:
                    "border-destructive/30 bg-destructive/20 text-destructive",
                outline: "border-border/50 text-foreground",
                success:
                    "border-emerald-500/30 bg-emerald-500/20 text-emerald-400",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

function Badge({ className, variant, ...props }) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
