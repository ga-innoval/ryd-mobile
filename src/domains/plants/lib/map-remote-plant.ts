import { PlantRecord, SyncStatus } from "../types";
import type { RemotePlant } from "../api/types";

export function mapRemotePlant(remote: RemotePlant): PlantRecord {
  return {
    id: remote.id,
    name: remote.variedad.name,
    campo: remote.campo,
    campoId: remote.campo_id,
    cuadro: remote.cuadro,
    programa: remote.variedad.programa.name,
    portainjerto: remote.portainjerto,
    anio: remote.anio,
    syncStatus: SyncStatus.synced,
  };
}
