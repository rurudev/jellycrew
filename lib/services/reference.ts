import { fetchMediaFolders, fetchParentalRatings } from "@/lib/jellyfin";
import { listDevices, type DeviceView } from "./devices";

export interface FolderRef {
  id: string;
  name: string;
  collectionType: string | null;
}

export interface RatingRef {
  name: string;
  value: number | null;
}

/** Names for the ids that appear in policies. Fetched fresh on every use. */
export interface ReferenceData {
  folders: FolderRef[];
  folderById: Map<string, FolderRef>;
  ratings: RatingRef[];
  devices: DeviceView[];
  deviceById: Map<string, DeviceView>;
}

export async function getReferenceData(): Promise<ReferenceData> {
  const [rawFolders, rawRatings, devices] = await Promise.all([fetchMediaFolders(), fetchParentalRatings(), listDevices()]);
  const folders = rawFolders.map((f) => ({ id: f.Id, name: f.Name ?? f.Id, collectionType: f.CollectionType ?? null }));
  const ratings = rawRatings.map((r) => ({ name: r.Name, value: r.Value ?? null }));
  return {
    folders,
    folderById: new Map(folders.map((f) => [f.id, f])),
    ratings,
    devices,
    deviceById: new Map(devices.map((d) => [d.id, d])),
  };
}
