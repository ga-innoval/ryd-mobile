import { env } from "@/lib/env";
import { useAuthStore } from "@/domains/auth/store/auth-store";
import { photoMimeType } from "../lib/photo-mime";
import { uploadPhotoFile } from "../lib/photo-files";
import { uploadOutcome, type UploadOutcome } from "../lib/upload-outcome";

/**
 * La subida de fotografías: **una petición multipart por archivo**, no un array.
 *
 * Cada foto tiene su propio ciclo y una que falle no puede bloquear a las demás
 * ni al texto — es la razón por la que el contrato lo pide así.
 *
 * **Esto no pasa por `apiClient`**, así que no hereda ni el bearer ni su
 * reintento del 401: el token se pone a mano aquí. De ahí que el envío mande
 * primero el lote de texto por axios, que es quien refresca el token si estaba
 * vencido. Invertir los dos pasos rompe el refresco en silencio.
 */
const authHeaders = (): Record<string, string> => {
  const { accessToken } = useAuthStore.getState();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
};

/** `client_id` es la llave de idempotencia: un reintento no duplica la fila. */
const parameters = (clientId: string, categoria: string) => ({
  client_id: clientId,
  categoria,
});

export const uploadFoto = async (foto: {
  tratamientoId: string;
  clientId: string;
  categoria: string;
  fileName: string;
}): Promise<UploadOutcome> =>
  uploadOutcome(
    await uploadPhotoFile(
      foto.fileName,
      `${env.apiBaseUrl}/api/ryd/evaluaciones/${foto.tratamientoId}/respuesta/fotografias/`,
      {
        parameters: parameters(foto.clientId, foto.categoria),
        headers: authHeaders(),
        mimeType: photoMimeType(foto.fileName),
      },
    ),
  );

export const uploadPostcosechaFoto = async (foto: {
  plantId: string;
  evalId: string;
  clientId: string;
  categoria: string;
  fileName: string;
}): Promise<UploadOutcome> =>
  uploadOutcome(
    await uploadPhotoFile(
      foto.fileName,
      `${env.apiBaseUrl}/api/ryd/plantaciones/${foto.plantId}/postcosecha/${foto.evalId}/fotografias/`,
      {
        parameters: parameters(foto.clientId, foto.categoria),
        headers: authHeaders(),
        mimeType: photoMimeType(foto.fileName),
      },
    ),
  );
