import type { RemoteTrat } from "../api/types";
import type { TratamientoRecord } from "../types";

export function mapRemoteTratamiento(
  remote: RemoteTrat,
  // No viene dentro del tratamiento: sale de la plantación que lo contiene.
  plantId: string,
): TratamientoRecord {
  return {
    id: remote.id,
    plantId,
    name: remote.name,
    description: remote.description,
    temporada: remote.temporada,
    isActive: remote.is_active,
  };
}
