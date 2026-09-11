"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Jump list for the editor's groups. It follows the scroll position so the operator can tell
 * where they are in a long form; below 1024px it lies on its side above the fields.
 */
export function GroupIndex({ groups }: { groups: Array<{ id: string; title: string; count: number }> }) {
  const [active, setActive] = useState<string | null>(null);
  const ids = groups.map((g) => g.id).join(",");
  useEffect(() => {
    const sections = ids
      .split(",")
      .map((id) => document.getElementById(`g-${id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    // The crossings are only the trigger; which group is current is then measured, so the
    // answer is the same whether you scrolled there or jumped.
    const pick = () => {
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 96) current = section;
      }
      if (current) setActive(current.id.slice(2));
    };
    const observer = new IntersectionObserver(pick, { rootMargin: "-80px 0px -70% 0px" });
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [ids]);

  return (
    <nav aria-label="Field groups" className="min-w-0 lg:sticky lg:top-12">
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible">
        {groups.map((g) => (
          <li key={g.id} className="shrink-0">
            <a
              href={`#g-${g.id}`}
              onClick={() => setActive(g.id)}
              aria-current={active === g.id ? "true" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-r-md border-l-2 px-2 py-1 whitespace-nowrap hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:whitespace-normal",
                active === g.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              <span className="lg:flex-1">{g.title}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{g.count}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
