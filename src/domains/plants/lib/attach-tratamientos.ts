import type {
  PlantRecord,
  PlantWithTratamientos,
  TratamientoRecord,
} from "../types";

/**
 * Cuelga cada tratamiento de su plantación. Se agrupa aquí y no con un JOIN
 * porque un JOIN repetiría las columnas de la plantación por cada hijo.
 *
 * Respeta el orden de entrada de `tratamientos`, que ya viene ordenado por el
 * `ORDER BY` del repositorio. Un tratamiento cuyo `plantId` no esté en
 * `plants` simplemente no aparece.
 */
export const attachTratamientos = (
  plants: PlantRecord[],
  tratamientos: TratamientoRecord[],
): PlantWithTratamientos[] => {
  const byPlant = new Map<string, TratamientoRecord[]>();

  for (const tratamiento of tratamientos) {
    const current = byPlant.get(tratamiento.plantId);

    if (current) {
      current.push(tratamiento);
    } else {
      byPlant.set(tratamiento.plantId, [tratamiento]);
    }
  }

  return plants.map((plant) => ({
    ...plant,
    tratamientos: byPlant.get(plant.id) ?? [],
  }));
};
