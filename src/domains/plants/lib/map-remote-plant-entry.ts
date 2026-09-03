import type { RemotePlant } from "../api/types";
import type { PlantSyncEntry } from "../types";
import { mapRemotePlant } from "./map-remote-plant";
import { mapRemoteTratamiento } from "./map-remote-tratamiento";

export const mapRemotePlantEntry = (remote: RemotePlant): PlantSyncEntry => ({
  plant: mapRemotePlant(remote),
  tratamientos: remote.tratamientos.map((tratamiento) =>
    mapRemoteTratamiento(tratamiento, remote.id),
  ),
  isActive: remote.is_active,
});
