import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 7;

export async function runMigrations(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA foreign_keys = ON");

  // Va aquí arriba por lo mismo que `foreign_keys`, y no abajo junto a
  // `journal_mode`: **`synchronous` es por conexión y no persiste**. Puesto
  // después del early-return, las instalaciones que ya están en la última
  // versión abrirían la base sin él y no serviría de nada. `journal_mode = WAL`
  // sí persiste —vive en el archivo—, por eso ese sí puede quedarse abajo.
  //
  // `FULL` y no `NORMAL`: con WAL, `NORMAL` solo sincroniza al hacer
  // checkpoint, así que un commit sobrevive a que muera la app pero puede
  // perderse si se va la corriente. Esto es una libreta de campo en una tablet
  // que se queda sin batería, y lo que hay en juego es una captura que no se
  // puede repetir: una evaluación no se vuelve a hacer. El coste es un `fsync`
  // por commit, y aquí se escribe como mucho cada dos segundos.
  await db.execAsync("PRAGMA synchronous = FULL");

  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  await db.execAsync("PRAGMA journal_mode = WAL");

  if (currentVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS plants (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        campo TEXT NOT NULL,
        cuadro TEXT NOT NULL,
        programa TEXT NOT NULL,
        portainjerto TEXT NOT NULL,
        anio INTEGER NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'synced'
      );
    `);
    currentVersion = 1;
  }

  if (currentVersion === 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tratamientos (
        id TEXT PRIMARY KEY NOT NULL,
        plantId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        temporada INTEGER NOT NULL,
        isActive INTEGER NOT NULL,
        FOREIGN KEY (plantId) REFERENCES plants(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_tratamientos_plantId
        ON tratamientos(plantId);
    `);
    currentVersion = 2;
  }

  if (currentVersion === 2) {
    // Una fila por sección capturada, y no una por evaluación: la evaluación
    // vive semanas —los cortes de rendimiento son de días distintos—, así que
    // lo terminado se sincroniza sin arrastrar lo que falta. Sin fila no es lo
    // mismo que fila vacía: la sección que nadie tocó no existe.
    //
    // La PK es la llave natural y no un UUID: las dos partes ya existen en los
    // dos lados antes del primer envío, así que un reenvío no puede duplicar.
    //
    // `payload` es el JSON de la sección tal como se capturó (texto, no
    // números): al reabrir la pantalla hay que enseñar exactamente lo tecleado.
    // El contrato con el backend está en `docs/contrato-respuestas.md`.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS respuestas (
        tratamientoId TEXT NOT NULL,
        seccion TEXT NOT NULL,
        payload TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending',
        updatedAtLocal TEXT NOT NULL,
        syncedAt TEXT,
        PRIMARY KEY (tratamientoId, seccion),
        FOREIGN KEY (tratamientoId) REFERENCES tratamientos(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_respuestas_syncStatus
        ON respuestas(syncStatus);
    `);
    currentVersion = 3;
  }

  if (currentVersion === 3) {
    // Si esa captura trae un dato imposible, calculado al escribirla (ver
    // `seccionHasError`). Es un dato derivado del `payload`, y lo que lo hace
    // seguro es que lo pone el propio `saveRespuesta`: no hay forma de escribir
    // una fila con la marca desfasada.
    //
    // Está aquí y no calculado al leer porque el listado lo pregunta de todas
    // las plantaciones a la vez, y abrir cada payload para responder crecía con
    // los datos: 8 000 filas eran 40 ms de bloqueo del hilo de JS.
    //
    // El índice es parcial —solo las filas marcadas— porque un índice sobre una
    // columna de dos valores no sirve de nada: lo que se consulta siempre es el
    // 1, y así ocupa lo que ocupen los errores, que deberían ser pocos.
    await db.execAsync(`
      ALTER TABLE respuestas ADD COLUMN hasError INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_respuestas_hasError
        ON respuestas(tratamientoId) WHERE hasError = 1;
    `);
    currentVersion = 4;
  }

  if (currentVersion === 4) {
    // Cuánto lleva capturado esa sección, de 0 a 100, calculado al escribirla
    // (ver `seccionProgress`). Entero y no fracción porque es lo que se enseña.
    //
    // Guardado por la misma razón que `hasError`: el avance del tratamiento es
    // la suma de sus secciones, y el listado lo pregunta de todas las
    // plantaciones a la vez. Calcularlo al leer obligaba a abrir cada payload.
    await db.execAsync(
      `ALTER TABLE respuestas ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;`,
    );
    currentVersion = 5;
  }

  if (currentVersion === 5) {
    // Una fila por fotografía de evidencia. El archivo vive en disco
    // (`lib/photo-files.ts`); aquí solo está su ficha.
    //
    // Cuelga de `tratamientos` y no de `respuestas`: `fotografias` no es una
    // sección del formulario —no existe en `EvaluationSectionId`—, así que
    // darle fila allí ensuciaría la cola del push y el volcado al formulario
    // con una sección que el esquema no conoce.
    //
    // `clientId` es la PK y no un autoincremental: un archivo no tiene llave
    // natural, y ese UUID es lo que hace idempotente un reintento de subida y
    // lo que direcciona el borrado del contrato. Siendo PK, el `unique` que
    // exige el modelo del servidor sale gratis.
    //
    // **`fileName` y nunca la ruta completa.** El contenedor de la app cambia
    // de UUID entre instalaciones en iOS, así que una ruta absoluta guardada
    // hoy apunta a la nada mañana aunque el archivo siga ahí. La ruta se
    // reconstruye al leer.
    //
    // Sin `CHECK` sobre `categoria` —congelaría el catálogo en el esquema— y
    // sin columna `progress`: aquí el avance es un `COUNT` barato y no hay
    // payload que abrir, que es lo que la justificaba en `respuestas`.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS respuesta_fotos (
        clientId TEXT PRIMARY KEY NOT NULL,
        tratamientoId TEXT NOT NULL,
        categoria TEXT NOT NULL,
        fileName TEXT NOT NULL,
        capturedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending',
        syncedAt TEXT,
        FOREIGN KEY (tratamientoId) REFERENCES tratamientos(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_respuesta_fotos_tratamiento
        ON respuesta_fotos(tratamientoId, categoria);
    `);
    currentVersion = 6;
  }

  if (currentVersion === 6) {
    // Las fotografías de post-cosecha, en su propia tabla y no como filas de
    // `respuesta_fotos`.
    //
    // **El dueño es otro**: allí un tratamiento, aquí la plantación más cuál de
    // las cuatro evaluaciones (`EVALS_POST_COSECHA`, catálogo fijo que no vive
    // en SQLite). Meterlas en la misma tabla obligaría a hacer nulable el
    // `tratamientoId` y con ello a perder la FK, que es lo que hace segura la
    // poda de la descarga.
    //
    // `evalId` es texto suelto y sin `CHECK` a propósito, como `categoria`:
    // congelar el catálogo en el esquema obligaría a migrar para añadir una
    // evaluación.
    //
    // **Ojo con la barrida de huérfanos**: los archivos de las dos tablas
    // comparten carpeta, así que `sweepOrphanPhotos` tiene que mirar las dos o
    // borrará estas en la siguiente descarga. Tiene test.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS postcosecha_fotos (
        clientId TEXT PRIMARY KEY NOT NULL,
        plantId TEXT NOT NULL,
        evalId TEXT NOT NULL,
        categoria TEXT NOT NULL,
        fileName TEXT NOT NULL,
        capturedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending',
        syncedAt TEXT,
        FOREIGN KEY (plantId) REFERENCES plants(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_postcosecha_fotos_owner
        ON postcosecha_fotos(plantId, evalId, categoria);
    `);
    currentVersion = 7;
  }

  // Próxima migración. ej:
  // if (currentVersion === 7) {
  //   await db.execAsync(`CREATE TABLE IF NOT EXISTS newTable (...)`);
  //   currentVersion = 8;
  // }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}
