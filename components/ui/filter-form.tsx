"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type SubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>;

/**
 * A GET form for list filters. With JavaScript it navigates client-side and drops empty
 * fields so URLs stay clean (`/users?status=enabled`, not `/users?q=&status=enabled&…`);
 * without it, the browser submits the same form natively.
 */
export function FilterForm({ action, onSubmit, ...props }: Omit<ComponentProps<"form">, "method" | "action"> & { action: string }) {
  const router = useRouter();
  const submit: SubmitHandler = (e) => {
    onSubmit?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget)) {
      if (typeof value === "string" && value.trim() !== "") params.set(key, value.trim());
    }
    const query = params.toString();
    router.push(query ? `${action}?${query}` : action);
  };
  return <form method="get" action={action} onSubmit={submit} {...props} />;
}
