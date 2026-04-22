import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function HeaderToolbarGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 shrink-0 border-l border-stone-200 dark:border-border pl-3 ml-0 first:border-l-0 first:pl-0",
        className
      )}
    >
      {children}
    </div>
  );
}
