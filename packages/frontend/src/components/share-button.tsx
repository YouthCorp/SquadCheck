"use client";

import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  url: string;
  className?: string;
}

export function ShareButton({ url, className }: ShareButtonProps) {
  async function handleShare() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  }

  return (
    <button
      onClick={handleShare}
      title="Share lineup"
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors",
        className,
      )}
    >
      <Link2 className="w-3.5 h-3.5" />
    </button>
  );
}
