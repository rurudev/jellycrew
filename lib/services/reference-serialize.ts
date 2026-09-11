import type { EditorRefData } from "@/components/policy/policy-editor";
import type { ReferenceData } from "./reference";

/** Plain-object subset of ReferenceData that can cross into a client component. */
export function toEditorRefData(ref: ReferenceData): EditorRefData {
  return {
    folders: ref.folders.map((f) => ({ id: f.id, name: f.name })),
    devices: ref.devices.map((d) => ({ id: d.id, name: d.name, appName: d.appName })),
    ratings: ref.ratings,
  };
}
