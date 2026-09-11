import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ControlSize = "md" | "lg";

export interface ControlStyleProps {
  /** `md` is the 32 px console size, `lg` the 44 px guest size. */
  size?: ControlSize;
  /** `full` stretches to the container; `auto` adds no width so a className such as `w-40` can size it. */
  width?: "full" | "auto";
  invalid?: boolean;
  mono?: boolean;
}

const base =
  "rounded-md border border-edge-strong bg-surface text-fg transition-colors duration-(--duration-fast) ease-(--ease-standard) placeholder:text-fg-subtle aria-invalid:border-danger disabled:bg-surface-2 disabled:text-fg-muted";

const sizes: Record<ControlSize, string> = {
  md: "h-8 px-2.5 text-sm",
  lg: "h-11 px-3 text-base",
};

function controlClasses({ size = "md", width = "full", invalid, mono }: ControlStyleProps, className?: string, multiline = false): string {
  return cn(base, multiline ? (size === "lg" ? "min-h-24 px-3 py-2 text-base" : "min-h-20 px-2.5 py-1.5 text-sm") : sizes[size], width === "full" && "w-full", mono && "font-mono", invalid && "border-danger", className);
}

type Omitted = "size" | "width";

export function Input({ className, size, width, invalid, mono, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, Omitted> & ControlStyleProps) {
  return <input className={controlClasses({ size, width, invalid, mono }, className)} aria-invalid={invalid || props["aria-invalid"]} {...props} />;
}

export function Textarea({ className, size, width, invalid, mono, ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, Omitted> & ControlStyleProps) {
  return <textarea className={controlClasses({ size, width, invalid, mono }, className, true)} aria-invalid={invalid || props["aria-invalid"]} {...props} />;
}

export function Select({ className, size, width, invalid, mono, ...props }: Omit<SelectHTMLAttributes<HTMLSelectElement>, Omitted> & ControlStyleProps) {
  return <select className={controlClasses({ size, width, invalid, mono }, cn("pr-8", className))} aria-invalid={invalid || props["aria-invalid"]} {...props} />;
}
