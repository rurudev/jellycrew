"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ComponentProps } from "react";

type SubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>;

/** The `name` of the field that had focus when the form last submitted; the remounted form gives it focus back. */
let focusAfterNavigation: string | null = null;

function rememberFocus(form: HTMLFormElement) {
  const active = document.activeElement;
  focusAfterNavigation = active instanceof HTMLElement && form.contains(active) && active.getAttribute("name") ? active.getAttribute("name") : null;
}

function restoreFocus(form: HTMLFormElement) {
  if (!focusAfterNavigation) return;
  const el = form.elements.namedItem(focusAfterNavigation);
  focusAfterNavigation = null;
  if (el instanceof HTMLElement) el.focus();
}

/**
 * A GET form for list filters. With JavaScript it navigates client-side and drops empty
 * fields so URLs stay clean (`/users?status=enabled`, not `/users?q=&status=enabled&…`);
 * without it, the browser submits the same form natively. Callers key the form on the query
 * so fields never keep stale values; focus is handed back to the field that submitted.
 */
export function FilterForm({ action, onSubmit, ...props }: Omit<ComponentProps<"form">, "method" | "action"> & { action: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (ref.current) restoreFocus(ref.current);
  }, []);
  const submit: SubmitHandler = (e) => {
    onSubmit?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    rememberFocus(e.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget)) {
      if (typeof value === "string" && value.trim() !== "") params.set(key, value.trim());
    }
    const query = params.toString();
    router.push(query ? `${action}?${query}` : action);
  };
  return <form ref={ref} method="get" action={action} onSubmit={submit} {...props} />;
}
