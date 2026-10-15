import type { SQLiteDatabase } from "expo-sqlite";
import { getPostcosechaReminderCandidates } from "@/domains/plants/lib/db/postcosecha-respuestas.repository";
import { buildDesiredReminders } from "./reminder-plan";
import { syncReminders } from "./reminders";

/**
 * La cola de repasos. **Uno detrás de otro, nunca dos a la vez**: guardar y
 * salir de la pantalla disparan el repaso casi juntos, y dos repasos
 * simultáneos ven los dos «falta este» y lo programan dos veces. Encadenados,
 * el segundo ya encuentra lo del primero.
 */
let chain: Promise<void> = Promise.resolve();

/**
 * Repasa los recordatorios de post-cosecha contra lo que hay en SQLite y deja
 * el sistema como debe estar.
 *
 * **Se repasa entero, no por eventos.** Programar y cancelar según lo que
 * acaba de pasar deja avisos huérfanos en cuanto algo cambia por otro camino —
 * la poda de una descarga borra una plantación y su aviso seguía vivo; editar
 * la fecha dejaba el viejo—. Recalcular lo que debería existir desde la fuente
 * y diferenciarlo de lo programado no tiene ese hueco, y es barato: una consulta
 * sobre las cajas ya empacadas.
 *
 * **Nunca lanza y nunca bloquea**: guardar una captura no puede fallar porque
 * un aviso no se pudo programar. Quien llama no espera el resultado.
 *
 * Se llama desde cada sitio que cambia lo que lo alimenta —guardar y limpiar
 * una evaluación, la descarga que poda— y al abrir la app, que es la red de
 * seguridad y la que rellena lo que el tope de iOS dejó fuera.
 */
export function refreshPostcosechaReminders(db: SQLiteDatabase): Promise<void> {
  chain = chain.then(async () => {
    try {
      const candidates = await getPostcosechaReminderCandidates(db);

      await syncReminders(buildDesiredReminders(candidates, Date.now()));
    } catch (error) {
      console.warn("No se pudieron actualizar los recordatorios", error);
    }
  });

  return chain;
}
