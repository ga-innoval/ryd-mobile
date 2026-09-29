import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { useAppRouter } from "@/lib/use-app-router";
import { usePhotoCapture } from "../hooks/use-photo-capture";
import type { PhotoSource } from "../types";
import {
  EMPTY_POSTCOSECHA_FOTOS,
  useAddPostcosechaFotos,
  usePostcosechaFotos,
} from "../hooks/use-postcosecha-fotos";
import { POSTCOSECHA_PHOTO_CATEGORIES } from "../lib/postcosecha-photo-categories";
import { EvalPhotos } from "./eval-photos";

type Owner = { plantId: string; evalId: string };

/** Lo que la cabecera de la sección enseña en su hueco de resumen. */
export function PostcosechaPhotosHeaderSummary({ plantId, evalId }: Owner) {
  const { data: fotos } = usePostcosechaFotos(plantId, evalId);
  const total = fotos?.length ?? 0;

  return (
    <View className="flex-row items-baseline justify-between gap-4">
      <Text variant="muted">
        {total === 0 ? "Sin fotografías" : "1 de 1 categorías"}
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text variant="muted">Adjuntas</Text>
        <Text className="font-semibold">{total}</Text>
      </View>
    </View>
  );
}

/**
 * La sección de fotografías de una evaluación de post-cosecha.
 *
 * Hermana de `EvalPhotosForm` y con el mismo reparto: la fila la pinta
 * `EvalPhotos`, que no sabe de dónde salen las fotos, y quién las guarda lo
 * decide quien la monta. Lo que cambia es la tabla —`postcosecha_fotos`, con la
 * plantación y la evaluación como dueño— y que el catálogo tiene una sola toma.
 *
 * **Se guarda al capturar, no al guardar un formulario.** Lo que devuelve el
 * picker vive en la caché del sistema, que puede purgarse; por eso esta sección
 * no necesita ni store ni autoguardado para ser correcta.
 */
export function PostcosechaPhotosForm({ plantId, evalId }: Owner) {
  const router = useAppRouter();
  const { data: fotos } = usePostcosechaFotos(plantId, evalId);
  const { mutate: addFotos } = useAddPostcosechaFotos(plantId, evalId);
  const capturePhoto = usePhotoCapture();

  const porCategoria = useMemo(() => {
    const todas = fotos ?? EMPTY_POSTCOSECHA_FOTOS;

    // Se recorre el catálogo y no las fotos, para que lo guardado bajo una
    // categoría retirada no aparezca en ninguna fila.
    return Object.fromEntries(
      POSTCOSECHA_PHOTO_CATEGORIES.map((category) => [
        category.id,
        todas.filter((foto) => foto.categoria === category.id),
      ]),
    );
  }, [fotos]);

  // Llegan varias de golpe al elegir de la galería, y ninguna al cancelar o
  // quedarse sin permiso — que es el caso normal, no un error.
  const handleCapture = useCallback(
    async (categoria: string, source: PhotoSource) => {
      const uris = await capturePhoto(source);
      if (uris.length === 0) return;

      addFotos({ categoria, uris });
    },
    [capturePhoto, addFotos],
  );

  return (
    <View>
      {POSTCOSECHA_PHOTO_CATEGORIES.map((category, index) => (
        <View key={category.id}>
          {index > 0 && <Separator className="my-3" />}
          <EvalPhotos
            label={category.label}
            photos={porCategoria[category.id] ?? EMPTY_POSTCOSECHA_FOTOS}
            onCapture={(source) => handleCapture(category.id, source)}
            onOpenPhotos={() =>
              // La cuadrícula consulta por su cuenta, así que necesita saber de
              // quién son: aquí la plantación y la evaluación, no un
              // tratamiento.
              router.push({
                pathname: "/photos",
                params: { categoryId: category.id, plantId, evalId },
              })
            }
          />
        </View>
      ))}
    </View>
  );
}
