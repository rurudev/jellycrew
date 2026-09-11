"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Copies `value` to the clipboard and confirms for a moment. Falls back to a prompt where the clipboard is unavailable. */
export function CopyButton({ value, label = "Copy", size = "sm", variant = "outline", ...props }: { value: string; label?: string } & Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copy this value", value);
        }
      }}
      {...props}
    >
      {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/** A one-off secret or link shown once: mono text with a copy button beside it. */
export function CopyField({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <code className="min-w-0 flex-1 truncate rounded-md border border-input bg-muted/40 px-2.5 py-1.5 font-mono text-xs" title={value}>
        {value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  );
}
