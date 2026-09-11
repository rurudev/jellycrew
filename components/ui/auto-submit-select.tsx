"use client";

import type { ComponentProps } from "react";
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
