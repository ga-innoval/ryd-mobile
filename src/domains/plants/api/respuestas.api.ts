import { apiClient } from "@/lib/api-client";
import type {
  BatchResponse,
  WirePostcosechaRespuesta,
  WireRespuesta,
} from "./types";

/**
 * El push de capturas: **siempre el lote, nunca el `PUT` por sección**.
 *
 * Mandar un solo tratamiento y mandarlo todo se diferencian solo en qué entra
 * en la lista, así que no hacen falta dos formas de petición. En campo lo
 * escaso es la conexión, y seis `PUT` por tratamiento multiplican por seis el
 * `timeout` de 10 s de `apiClient`, que es el único detector de «sin red» que
 * hay. El contrato ya obliga a un resultado por registro, que es lo que la
 * reconciliación necesita, así que el lote da el mismo avance parcial con una
 * petición y un solo decodificador de rechazos.
 *
 * El `PUT` por sección está especificado y **no está implementado en el
 * servidor**; el `DELETE` de una fotografía, tampoco. No darlos por probados.
 *
 * Por `apiClient` y no por `fetch` porque ahí viven el bearer y el reintento
 * del 401 — y de eso depende que las fotografías, que no pasan por aquí, salgan
 * después con un token fresco.
 */
export const pushRespuestasBatch = (respuestas: WireRespuesta[]) =>
  apiClient
    .post<BatchResponse>("/api/ryd/respuestas/batch/", { respuestas })
    .then((r) => r.data);

export const pushPostcosechaBatch = (respuestas: WirePostcosechaRespuesta[]) =>
  apiClient
    .post<BatchResponse>("/api/ryd/postcosecha/respuestas/batch/", {
      respuestas,
    })
    .then((r) => r.data);
