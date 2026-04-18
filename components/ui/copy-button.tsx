"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  className?: string;
  label?: string;
  value: string;
}

function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently fail
    }
  }, [value]);

  return (
    <Button
      className={cn("gap-1.5", className)}
      onClick={handleCopy}
      size="sm"
      type="button"
      variant={copied ? "default" : "secondary"}
    >
      {copied ? (
        <>
          <Check className="size-3.5" weight="bold" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="size-3.5" weight="bold" />
          <span>{label ?? "Copy"}</span>
        </>
      )}
    </Button>
  );
}

export { CopyButton };
