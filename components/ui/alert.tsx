import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800",
        className,
      )}
      role="alert"
      {...props}
    />
  );
}
