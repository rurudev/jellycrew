"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

/** A native select that submits its form as soon as a value is chosen, so filter rows need no Apply button. */
export function AutoSubmitSelect({ onChange, ...props }: ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect
      onChange={(e) => {
        onChange?.(e);
        if (!e.defaultPrevented) e.currentTarget.form?.requestSubmit();
      }}
      {...props}
    />
  );
}

/**
 * The same for an input whose value is picked rather than typed, such as a date: the native
 * picker fires `change` and then blurs the field, so there is no Enter to submit on.
 */
export function AutoSubmitInput({ onChange, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      onChange={(e) => {
        onChange?.(e);
        if (!e.defaultPrevented) e.currentTarget.form?.requestSubmit();
      }}
      {...props}
    />
  );
}
