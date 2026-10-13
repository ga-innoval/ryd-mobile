import type { PlantRecord } from "../types";

/**
 * En qué punto está «sincronizar todo», tal como lo cuenta su diálogo.
 *
 * Cinco momentos y no un booleano porque el diálogo dice cosas distintas en cada
 * uno, incluido lo que promete su botón de salir.
 */
export type SyncProgress =
  | { kind: "idle" }
  | {
      kind: "running";
      /** Plantaciones ya resueltas, de `total`. */
      done: number;
      total: number;
    }
  /** Salió todo. */
  | { kind: "done"; total: number }
  /** Algo se quedó: rechazado, con un dato por revisar, o sin poder salir. */
  | { kind: "partial"; sincronizadas: number; total: number }
  /** Ni siquiera empezó: no hay red. */
  | { kind: "offline" };

export type PushAllReport = {
  /** Plantaciones que tenían algo que mandar. */
  plantaciones: number;
  /** De esas, las que quedaron sin nada que el servidor no tenga. */
  sincronizadas: number;
  /** Capturas que no se intentaron porque traen un dato imposible. */
  bloqueadas: number;
};

/**
 * Una línea de la lista desplegable del aviso: qué le falta por mandar a cada
 * plantación.
 *
 * **Una por plantación, con lo que lleva dentro resumido.** Se probó con dos
 * —el texto por un lado y las fotografías por otro— y la lista se hacía el doble
 * de larga para decir lo mismo: lo que el evaluador quiere saber es por cuál
 * plantación va, y cuánto hay dentro cabe en una frase.
 */
export type SyncUnit = {
  /** El `id` de la plantación. */
  id: string;
  /**
   * La plantación entera, no solo su nombre: el renglón la identifica con los
   * mismos cinco datos que el encabezado de su tarjeta —campo, cuadro,
   * programa, patrón y año—, porque un nombre de variedad se repite entre
   * cuadros y por sí solo no dice cuál es.
   */
  plant: PlantRecord;
  status: "pending" | "running" | "done" | "failed" | "blocked";
};

/** Lo que el diálogo pinta, ya resuelto. `null` cuando no hay nada que enseñar. */
export type SyncDialogView = {
  /** De qué color va la barra. */
  tone: "primary" | "warn";
  title: string;
  detail: string;
  /** De 0 a 100, o `null` para no pintar barra. */
  percent: number | null;
  retry: boolean;
  /**
   * Qué dice el botón de cerrar.
   *
   * **Mientras sincroniza no cierra nada, aparta**: la tanda sigue en marcha y
   * el evaluador vuelve al listado. Decirle «Cerrar» ahí prometería que algo se
   * detiene.
   */
  dismissLabel: string;
};

const plantaciones = (n: number) =>
  n === 1 ? "1 plantación" : `${n} plantaciones`;

export function syncDialogView(progress: SyncProgress): SyncDialogView | null {
  switch (progress.kind) {
    case "idle":
      return null;

    case "running":
      return {
        tone: "primary",
        // El total y no «la 3 de 10»: por cuál va lo dice la lista, que está
        // justo debajo, y repetirlo arriba sería contarlo dos veces.
        title: `Sincronizando ${plantaciones(progress.total)}`,
        detail:
          "Se están mandando las capturas que estaban guardadas en la tablet.",
        percent: percent(progress.done, progress.total),
        retry: false,
        dismissLabel: "Seguir en segundo plano",
      };

    case "done":
      return {
        tone: "primary",
        title: `${plantaciones(progress.total)} ${
          progress.total === 1 ? "sincronizada" : "sincronizadas"
        }`,
        detail: "El servidor ya tiene todo lo que estaba guardado.",
        percent: 100,
        retry: false,
        dismissLabel: "Cerrar",
      };

    case "partial":
      return {
        tone: "warn",
        title: `${progress.sincronizadas} de ${progress.total} sincronizadas`,
        // No dice cuál ni por qué: eso ya está en su tarjeta, marcado, y
        // repetirlo aquí obligaría a listar plantaciones dos veces.
        detail: "Lo que falta sigue marcado en su tarjeta.",
        percent: percent(progress.sincronizadas, progress.total),
        retry: true,
        dismissLabel: "Cerrar",
      };

    case "offline":
      return {
        tone: "warn",
        title: "Sin conexión",
        detail: "Lo capturado está a salvo; se manda en cuanto vuelva.",
        // Sin barra: no es que fuera poco, es que no empezó.
        percent: null,
        retry: false,
        dismissLabel: "Cerrar",
      };
  }
}

const percent = (done: number, total: number) =>
  total === 0 ? 0 : Math.round((done / total) * 100);

/**
 * En qué acabó una tanda, según lo que devolvió.
 *
 * Que una plantación cuente como sincronizada lo decide SQLite, no la suma de
 * los envíos: `pushAll` le pregunta a `hasUnsyncedWorkForPlant`, que es la misma
 * pregunta que contestan el chip de la tarjeta y el guard de la poda. Así el
 * diálogo no puede decir «10 de 10» sobre una tarjeta que sigue marcada.
 */
export function progressFromReport(report: PushAllReport): SyncProgress {
  // Sin nada que mandar no hubo tanda. No debería pasar —el botón está apagado—
  // pero decir «0 plantaciones sincronizadas» sería peor que callar.
  if (report.plantaciones === 0) return { kind: "idle" };

  if (report.sincronizadas === report.plantaciones) {
    return { kind: "done", total: report.plantaciones };
  }

  return {
    kind: "partial",
    sincronizadas: report.sincronizadas,
    total: report.plantaciones,
  };
}
