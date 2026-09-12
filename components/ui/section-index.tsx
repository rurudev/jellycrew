"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface IndexedSection {
  /** The DOM id of the section this entry jumps to. */
  id: string;
  title: string;
  /** Optional tally, such as how many fields a group holds. */
  count?: number;
}

/**
 * Jump list for a long page of sections. It follows the scroll position so the operator can
 * tell where they are; below 1024px it lies on its side above the content.
 */
export function SectionIndex({ sections }: { sections: IndexedSection[] }) {
  const [active, setActive] = useState<string | null>(null);
  // A click says where the operator meant to go; scrolling only takes over again afterwards.
  const jumpedAt = useRef(0);
  const ids = sections.map((s) => s.id).join(",");
  useEffect(() => {
    const elements = ids
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    // The crossings are only the trigger; which group is current is then measured, so the
    // answer is the same whether you scrolled there or jumped.
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (Date.now() - jumpedAt.current < 700) return;
      // A short last section can never reach the top of the viewport, so reaching the bottom
      // of a page that actually scrolls is what makes it current.
      const scrollable = document.documentElement.scrollHeight > window.innerHeight + 2;
      const atBottom = scrollable && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      let current = atBottom ? elements[elements.length - 1] : elements[0];
      if (!atBottom) {
        for (const element of elements) {
          if (element.getBoundingClientRect().top <= 96) current = element;
        }
      }
      if (current) setActive(current.id);
    };
    // Scroll events outpace layout, so measuring happens once per frame.
    const pick = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // Crossings alone miss the last stretch of a scroll, so the scroll itself is watched too.
    const observer = new IntersectionObserver(pick, { rootMargin: "-80px 0px -70% 0px" });
    for (const element of elements) observer.observe(element);
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, [ids]);

  return (
    <nav aria-label="Sections" className="min-w-0 lg:sticky lg:top-12">
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible">
        {sections.map((section) => (
          <li key={section.id} className="shrink-0">
            <a
              href={`#${section.id}`}
              onClick={() => {
                jumpedAt.current = Date.now();
                setActive(section.id);
              }}
              aria-current={active === section.id ? "true" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-r-md border-l-2 px-2 py-1 whitespace-nowrap hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:whitespace-normal",
                active === section.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              <span className="lg:flex-1">{section.title}</span>
              {section.count === undefined ? null : <span className="text-xs tabular-nums text-muted-foreground">{section.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
