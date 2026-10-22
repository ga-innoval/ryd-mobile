/**
 * Lo que es de cada usuario de la tablet: su base de datos, sus fotografías y
 * lo que persisten sus stores.
 *
 * **Una tablet se comparte, y los datos no.** El usuario B no debe ver lo que
 * capturó el A aunque los dos tengan el mismo campo, así que cada uno tiene su
 * propio archivo de SQLite en vez de una columna `userId` en cada tabla. El
 * motivo es de alcance: con columnas, cada consulta de la cola del push, de la
 * poda, de los conteos y de los recordatorios tendría que acordarse de
 * filtrar —y olvidar una es enseñar o mandar datos ajenos, en silencio—; con
 * un archivo por usuario no hay nada que recordar. La regla de «el primero que
 * sincroniza gana» no vive aquí sino en el servidor.
 *
 * Puro y con test: de estos nombres cuelgan archivos en disco, y uno mal
 * construido mezclaría a dos usuarios.
 */

/** Deja solo lo que es seguro en un nombre de archivo o de carpeta. */
const safe = (userId: string): string => userId.replace(/[^A-Za-z0-9_-]/g, "_");

/** El archivo de SQLite del usuario. */
export const databaseNameFor = (userId: string): string =>
  `plantaciones-${safe(userId)}.db`;

/** La subcarpeta de fotografías del usuario. */
export const photosFolderFor = (userId: string): string => safe(userId);

/**
 * La clave con que un store persistido guarda sus datos **para este usuario**.
 * Sin usuario no hay clave, y quien la use no escribe ni lee nada.
 */
export const scopedStorageKey = (
  userId: string | null,
  name: string,
): string | null => (userId === null ? null : `${safe(userId)}:${name}`);
