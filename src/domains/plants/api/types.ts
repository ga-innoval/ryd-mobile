export interface RemotePlant {
  id: string;
  variedad: RemoteVariedad;
  portainjerto: string;
  campo: string;
  cuadro: string;
  anio: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlantsResponse {
  server_time: string;
  results: RemotePlant[];
}

interface RemoteVariedad {
  id: string;
  name: string;
  code: string;
  color: string;
  programa: RemotePrograma;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RemotePrograma {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
