import type { SQLiteDatabase } from "expo-sqlite";
import { useSQLiteContext } from "expo-sqlite";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { haptics } from "@/lib/haptics";
import { uploadFoto, uploadPostcosechaFoto } from "../api/foto-upload.api";
import {
  getPendingPostcosechaFotos,
  markPostcosechaFotoRejected,
  markPostcosechaFotoSynced,
  type PostcosechaFotoRecord,
} from "../lib/db/postcosecha-fotos.repository";
import {
  getPendingPostcosechaRespuestas,
  getPostcosechaIdsWithErrors,
  type PostcosechaRespuestaRecord,
} from "../lib/db/postcosecha-respuestas.repository";
import {
  getPlantsById,
  hasUnsyncedWorkForPlant,
} from "../lib/db/plants.repository";
import {
  getPendingFotos,
  markFotoRejected,
  markFotoSynced,
  type RespuestaFotoRecord,
} from "../lib/db/respuesta-fotos.repository";
import {
  getPendingRespuestas,
  getTratamientoIdsWithErrors,
} from "../lib/db/respuestas.repository";
import { getTratamientoPlantIds } from "../lib/db/tratamientos.repository";
import { isNetworkError } from "../lib/is-network-error";
import type { PushAllReport, SyncUnit } from "../lib/sync-progress";
import { postcosechaKey } from "../lib/postcosecha-progress";
import type { RespuestaRecord } from "../types";
import { PLANTS_QUERY_KEY } from "./use-plants";
import { SYNC_STATE_QUERY_KEY } from "./use-item-sync-state";
import {
  ahora,
  pushPostcosechaRows,
  pushRespuestaRows,
  subirFotos,
} from "./use-sync-item";

/**
 * Permite leer el estado en vuelo desde la caché, igual que la descarga. Es
 * también el motivo de que `syncing` no se escriba en SQLite: una fila marcada
 * así cuando el sistema mata la app se queda ahí para siempre.
 *
 * **Este módulo no importa ningún store a propósito.** Los que hay persisten en
 * AsyncStorage, que es un módulo nativo, y con uno aquí dentro `pushAll` no se
 * podría probar sin montar su mock — y `pushAll` es justo lo que hay que probar.
 * Lo que necesita estado lo recibe por callback.
 */
export const SYNC_ALL_MUTATION_KEY = ["plants", "sync", "all"];

/**
 * Lo que el aviso necesita saber en cada momento: por cuál plantación va y qué
 * está pasando con cada renglón de su lista.
 */
export type SyncTick = {
  done: number;
  total: number;
  units: SyncUnit[];
};

/** Lo que le falta por mandar a una plantación, ya repartido. */
type PlantWork = {
  filas: RespuestaRecord[];
  pcFilas: PostcosechaRespuestaRecord[];
  fotos: RespuestaFotoRecord[];
  pcFotos: PostcosechaFotoRecord[];
};

const emptyWork = (): PlantWork => ({
  filas: [],
  pcFilas: [],
  fotos: [],
  pcFotos: [],
});

/**
 * Manda **todo lo que queda sin sincronizar**, plantación por plantación.
 *
 * **Una tanda por plantación y no dos lotes grandes**, aunque signifique más
 * peticiones: es lo que hace cierto el «plantación 3 de 10» del aviso, y de paso
 * acota el daño de un corte de red —lo que ya salió se queda marcado y la
 * siguiente vez se manda solo el resto—. Dentro de cada plantación sí se agrupa:
 * sus seis secciones de tratamiento van en un lote, no en seis peticiones.
 *
 * **Lo que trae un dato imposible se queda fuera entero** —secciones y
 * fotografías—, y las demás plantaciones viajan igual: un error en una no puede
 * impedir que lleguen las otras nueve.
 *
 * **Sin red se corta la tanda.** Seguir con las nueve restantes serían noventa
 * segundos de `timeout` para acabar igual; quien llama lo distingue con
 * `isNetworkError` y lo cuenta como «sin conexión» en vez de como «a medias».
 */
export const pushAll = async (
  db: SQLiteDatabase,
  onProgress?: (tick: SyncTick) => void,
): Promise<PushAllReport> => {
  const [conError, pcConError, plantIdOf, plants] = await Promise.all([
    getTratamientoIdsWithErrors(db),
    getPostcosechaIdsWithErrors(db),
    getTratamientoPlantIds(db),
    getPlantsById(db),
  ]);
  const [filas, pcFilas, fotos, pcFotos] = await Promise.all([
    getPendingRespuestas(db),
    getPendingPostcosechaRespuestas(db),
    getPendingFotos(db),
    getPendingPostcosechaFotos(db),
  ]);

  // Los dueños que se quedan fuera, para contarlos una sola vez aunque tengan
  // seis secciones y tres fotografías esperando.
  const bloqueados = new Set<string>();
  // Las plantaciones con algo fuera, para que su renglón lo diga en vez de
  // desaparecer de la lista. Basta con saber **si** las tiene: el renglón es por
  // plantación y no baja a distinguir de qué captura venía.
  const bloqueadoEn = new Set<string>();
  const porPlantacion = new Map<string, PlantWork>();

  const work = (plantId: string) => {
    const existing = porPlantacion.get(plantId);
    if (existing) return existing;

    const fresh = emptyWork();
    porPlantacion.set(plantId, fresh);
    return fresh;
  };

  for (const fila of filas) {
    const plantId = plantIdOf.get(fila.tratamientoId);
    if (conError.has(fila.tratamientoId)) {
      bloqueados.add(fila.tratamientoId);
      if (plantId) bloqueadoEn.add(plantId);
      continue;
    }
    if (plantId) work(plantId).filas.push(fila);
  }
  for (const foto of fotos) {
    const plantId = plantIdOf.get(foto.tratamientoId);
    if (conError.has(foto.tratamientoId)) {
      bloqueados.add(foto.tratamientoId);
      if (plantId) bloqueadoEn.add(plantId);
      continue;
    }
    if (plantId) work(plantId).fotos.push(foto);
  }
  for (const fila of pcFilas) {
    if (pcConError.has(postcosechaKey(fila.plantId, fila.evalId))) {
      bloqueados.add(postcosechaKey(fila.plantId, fila.evalId));
      bloqueadoEn.add(fila.plantId);
      continue;
    }
    work(fila.plantId).pcFilas.push(fila);
  }
  for (const foto of pcFotos) {
    if (pcConError.has(postcosechaKey(foto.plantId, foto.evalId))) {
      bloqueados.add(postcosechaKey(foto.plantId, foto.evalId));
      bloqueadoEn.add(foto.plantId);
      continue;
    }
    work(foto.plantId).pcFotos.push(foto);
  }

  // Las bloqueadas también cuentan como plantación a sincronizar: si no, una
  // tanda donde todo está bloqueado diría «0 de 0 sincronizadas» y parecería que
  // no había nada que hacer.
  for (const plantId of plantsOf(bloqueados, plantIdOf)) work(plantId);

  const total = porPlantacion.size;

  // **La lista nace entera**, con lo que falta en gris: así el aviso no crece
  // renglón a renglón mientras sincroniza —que haría saltar su alto— y se ve de
  // entrada cuánto hay por delante.
  const units: SyncUnit[] = [];
  const unitOf = new Map<string, SyncUnit>();

  for (const [plantId, pendiente] of porPlantacion) {
    const plant = plants.get(plantId);
    if (!plant) continue;

    const unit: SyncUnit = {
      id: plantId,
      plant,
      // Bloqueada solo si no le queda **nada** limpio que mandar. Con dos
      // tratamientos y uno con error, lo limpio sale y quien señala al otro es
      // el chip de su tarjeta: esta lista va por plantación y no baja a
      // distinguir cuál de sus capturas falla.
      status:
        pendiente.filas.length +
          pendiente.pcFilas.length +
          pendiente.fotos.length +
          pendiente.pcFotos.length ===
          0 && bloqueadoEn.has(plantId)
          ? "blocked"
          : "pending",
    };
    units.push(unit);
    unitOf.set(plantId, unit);
  }

  // Copia en cada aviso: quien lo pinta compara por referencia, y mutando los
  // mismos objetos no vería ningún cambio.
  let done = 0;
  const tick = () =>
    onProgress?.({ done, total, units: units.map((unit) => ({ ...unit })) });

  tick();

  let sincronizadas = 0;

  for (const [plantId, pendiente] of porPlantacion) {
    const unit = unitOf.get(plantId);

    if (unit?.status === "pending") {
      unit.status = "running";
      tick();
    }

    try {
      // El texto primero y las fotografías después, por el refresco del 401:
      // ver `pushTratamientoRespuestas`.
      await pushRespuestaRows(db, pendiente.filas);
      await pushPostcosechaRows(db, pendiente.pcFilas);

      await subirFotos(
        pendiente.fotos,
        uploadFoto,
        (clientId) => markFotoSynced(db, clientId, ahora()),
        (clientId) => markFotoRejected(db, clientId),
      );
      await subirFotos(
        pendiente.pcFotos,
        uploadPostcosechaFoto,
        (clientId) => markPostcosechaFotoSynced(db, clientId, ahora()),
        (clientId) => markPostcosechaFotoRejected(db, clientId),
      );
    } catch (error) {
      if (isNetworkError(error)) {
        // Lo que se quedó a medias se marca antes de salir: si no, el renglón
        // se quedaría girando para siempre.
        if (unit?.status === "running") unit.status = "failed";
        tick();
        throw error;
      }
      // Cualquier otro fallo se queda en esta plantación: las demás lo intentan
      // igual, y esta sale en el recuento como no sincronizada.
    }

    done += 1;

    // Se pregunta a SQLite en vez de sumar lo que devolvieron los envíos: es la
    // misma pregunta que contestan el chip de la tarjeta y el guard de la poda,
    // así que las tres no pueden discrepar. Y cuenta lo rechazado, que es
    // precisamente lo que el aviso tiene que poder decir.
    const limpia = !(await hasUnsyncedWorkForPlant(db, plantId));
    if (limpia) sincronizadas += 1;
    if (unit?.status === "running") unit.status = limpia ? "done" : "failed";

    tick();
  }

  return { plantaciones: total, sincronizadas, bloqueadas: bloqueados.size };
};

/** Las plantaciones de unos dueños bloqueados, sean tratamientos o evaluaciones. */
const plantsOf = (
  bloqueados: ReadonlySet<string>,
  plantIdOf: ReadonlyMap<string, string>,
): Set<string> => {
  const plants = new Set<string>();

  for (const owner of bloqueados) {
    // Una clave de post-cosecha es `plantId:evalId`; una de tratamiento, su id.
    const [plantId] = owner.split(":");
    plants.add(plantIdOf.get(owner) ?? plantId);
  }

  return plants;
};

export function useSyncAllMutation(onProgress?: (tick: SyncTick) => void) {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: SYNC_ALL_MUTATION_KEY,
    mutationFn: () => pushAll(db, onProgress),
    onSettled: () => {
      // Pase lo que pase: aunque la tanda se cortara, lo que alcanzó a salir ya
      // está marcado y el listado tiene que enterarse.
      queryClient.invalidateQueries({
        queryKey: PLANTS_QUERY_KEY,
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: SYNC_STATE_QUERY_KEY });
    },
    onSuccess: (report) => {
      // El aviso flotante es quien cuenta el resultado; aquí solo el háptico.
      // Un `toast` encima diría lo mismo dos veces.
      if (report.sincronizadas === report.plantaciones) haptics.success();
      else haptics.error();
    },
    onError: () => haptics.error(),
  });
}
