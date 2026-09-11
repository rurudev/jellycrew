import { cn } from "@/lib/utils";

/** The whole icon set: 16 px grid, 1.5 px stroke, round joins. Add here rather than inlining SVG elsewhere. */
const paths = {
  search: "M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM14 14l-3.1-3.1",
  "sort-asc": "M8 13V3M4 7l4-4 4 4",
  "sort-desc": "M8 3v10M4 9l4 4 4-4",
  check: "M3 8.5l3.2 3.2L13 5",
  close: "M4 4l8 8M12 4l-8 8",
  plus: "M8 3v10M3 8h10",
  copy: "M6 6h7v7H6zM10 6V3H3v7h3",
  external: "M9 3h4v4M13 3 7 9M11 9v4H3V5h4",
  warning: "M8 2.5l6.5 11H1.5L8 2.5ZM8 6.5v3M8 11.5h.01",
  "chevron-down": "M4 6l4 4 4-4",
  sun: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1",
  moon: "M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7Z",
  spinner: "M14 8A6 6 0 1 1 8 2",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16, label, className }: { name: IconName; size?: number; /** Only when the icon stands alone; otherwise it is decorative. */ label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0", className)}
    >
      <path d={paths[name]} />
    </svg>
  );
}
