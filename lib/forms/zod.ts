import { z } from "zod";

/**
 * A number field that may be left blank. Empty means `null`, which every caller reads as
 * "not set" rather than zero. `min` is 0 where zero carries its own meaning (never, unlimited).
 */
export function optionalInt({ min = 0, max }: { min?: number; max: number }) {
  return z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(min).max(max).nullable());
}
