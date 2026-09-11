import { PolicyFormError, parseGroupedPolicyForm, parseRawPolicyJson } from "./form";
import type { PolicyScope } from "./fields";

export interface EditorSubmission {
  baseHash: string;
  base?: Record<string, unknown>;
  edit: Record<string, unknown>;
  mode: "grouped" | "raw";
  confirm: boolean;
}

/** Shared server-side parsing of a PolicyEditor form submission. */
export function parseEditorSubmission(formData: FormData, scope: PolicyScope | "all"): EditorSubmission {
  const baseHash = String(formData.get("baseHash") ?? "");
  if (!baseHash) throw new PolicyFormError("Missing base hash; reload the editor.");
  let base: Record<string, unknown> | undefined;
  const rawBase = formData.get("base");
  if (typeof rawBase === "string" && rawBase) {
    try {
      base = JSON.parse(rawBase) as Record<string, unknown>;
    } catch {
      base = undefined;
    }
  }
  const mode = formData.get("mode") === "raw" ? "raw" : "grouped";
  const edit = mode === "raw" ? parseRawPolicyJson(String(formData.get("raw") ?? "")) : parseGroupedPolicyForm(formData, scope);
  return { baseHash, base, edit, mode, confirm: formData.get("confirm") === "1" };
}
