"use client";

import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function InfoTooltip({ content, side = "top", className }: InfoTooltipProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "inline-flex cursor-pointer items-center justify-center p-1 -m-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Info size={11} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side={side} sideOffset={6} className="isolate z-50">
          <Popover.Popup className="max-w-[220px] rounded-md bg-foreground px-3 py-1.5 text-center text-xs leading-relaxed text-background shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
            {content}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
