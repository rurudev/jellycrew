import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent/90",
  secondary: "border border-edge-strong bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
  /** Only inside confirm dialogs and danger zones. */
  danger: "bg-danger text-danger-fg hover:bg-danger/90",
};

/** Console controls are 32 px; `sm` fits inside table rows; `lg` is the 44 px touch size for guest pages. */
const sizes: Record<ButtonSize, string> = {
  sm: "h-7 gap-1 px-2 text-xs",
  md: "h-8 gap-1.5 px-3 text-sm",
  lg: "h-11 gap-2 px-4 text-base",
};

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. Use this instead of a `w-full` className. */
  block?: boolean;
}

export function buttonClasses({ variant = "primary", size = "md", block = false }: ButtonStyleProps, className?: string): string {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-(--duration-fast) ease-(--ease-standard) disabled:cursor-not-allowed disabled:opacity-60",
    sizes[size],
    variants[variant],
    block && "w-full",
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps & { icon?: ReactNode };

export function Button({ className, variant, size, block, icon, children, ...props }: ButtonProps) {
  return (
    <button className={buttonClasses({ variant, size, block }, className)} {...props}>
      {icon}
      {children}
    </button>
  );
}

/** A link that looks like a button, for navigation actions ("Edit access"). Never nest a Button inside a Link. */
export function LinkButton({ className, variant, size, block, icon, children, ...props }: ComponentProps<typeof Link> & ButtonStyleProps & { icon?: ReactNode }) {
  return (
    <Link className={buttonClasses({ variant, size, block }, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
