/** Invisible until focused: the first Tab stop on every console page jumps past the header. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-foreground"
    >
      Skip to content
    </a>
  );
}
