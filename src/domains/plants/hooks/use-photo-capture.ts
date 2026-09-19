import { useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { toast } from "@/lib/toast";
import type { PhotoSource } from "../types";

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  // El array nuevo de SDK 57; `MediaTypeOptions` sigue aceptándose pero está
  // deprecado en los typings instalados.
  mediaTypes: "images",
  // Estas fotos acaban subiéndose desde el campo y una tablet moderna saca
  // varios MB por disparo. 0.7 es JPEG de sobra para juzgar forma y color, y
  // divide por varias veces lo que habrá que sincronizar.
  quality: 0.7,
};

/**
 * Captura fotografías de evidencia del origen que se le pida y devuelve sus
 * URIs.
 *
 * **Devuelve un array y no una URI**: de la galería se pueden elegir varias de
 * una vez. Vacío significa "no hay nada que añadir" —cancelar o quedarse sin
 * permiso—, así que quien lo llama no distingue entre esos casos ni tiene que
 * atrapar nada.
 *
 * Solo la cámara pide permiso por adelantado. El selector de la galería lo
 * resuelve el sistema desde Android 13 e iOS 14, y pedirlo a mano sacaría un
 * diálogo de más antes del que ya va a salir.
 */
export function usePhotoCapture() {
  return useCallback(async (source: PhotoSource): Promise<string[]> => {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        toast.error({
          title: "Sin acceso a la cámara",
          description: "Actívalo en los ajustes del sistema para tomar fotos.",
        });
        return [];
      }

      const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
      return result.canceled ? [] : result.assets.map((asset) => asset.uri);
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      ...PICKER_OPTIONS,
      allowsMultipleSelection: true,
    });

    return result.canceled ? [] : result.assets.map((asset) => asset.uri);
  }, []);
}
