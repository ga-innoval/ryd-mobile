import { SyncStatus } from "../types";

export const MOCK_PLANTS_DATA = [
  {
    id: "fc2b4dc2-acc8-44a0-b583-84501e9ddae7",
    name: "02-6",
    campo: "Pozo Manuel",
    cuadro: "5C",
    programa: "Vitis",
    portainjerto: "Own Root",
    anio: 2013,
    progress: 1,
    tratamientos: [
      {
        name: "Testigo",
      },
      {
        name: "20 ppm",
      },
      {
        name: "5 ppm",
      },
    ],
    syncStatus: SyncStatus.synced,
  },
];
