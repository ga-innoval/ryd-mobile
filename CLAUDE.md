@AGENTS.md

# VitEval — Captura Experimental

App de tablet (tablet only) para evaluadores de campo en viñedos. Los usuarios descargan
"plantaciones" (antes llamadas "evaluaciones") asignadas a su usuario y
capturan encuestas de tratamiento en campo, con guardado progresivo y
sincronización manual.

## Stack

- **Cliente**: Expo SDK 57 (React Native 0.86, New Architecture/Fabric),
  Expo Router, TypeScript
- **Estilos**: NativeWind v4 (Tailwind), componentes tipo shadcn/RNR
  (`@/components/ui/*`: Text, Icon, Button, Badge, Input, Label, Alert,
  Separator, Select, Popover, Tooltip, Avatar, IconButton)
- **Animaciones**: react-native-reanimated 4, react-native-keyboard-controller
  (NO usar `useAnimatedKeyboard`, está deprecado — usar
  `useReanimatedKeyboardAnimation` de keyboard-controller)
- **Estado servidor-local**: TanStack Query sobre expo-sqlite (SQLite es la
  fuente de verdad local, TanStack Query cachea/orquesta lecturas y
  mutaciones)
- **Estado de cliente puro**: Zustand — SOLO para estado que no vive en
  SQLite (ej. `lastDownloadAt`). Persistirlo con `persist` + `AsyncStorage`
  es una decisión aparte: se añade cuando el valor debe sobrevivir al cierre
  de la app, no por defecto. NO duplicar ahí estado que ya vive en TanStack
  Query (isPending, error, etc. vienen de la mutation/query directamente)
- **DB local**: expo-sqlite, migraciones vía `PRAGMA user_version`
- **Backend**: Django REST Framework + SQL Server
- **Testing**: Jest + `@testing-library/react-native`, factories en
  `src/test-utils/factories/`

## Estado actual del schema (v9) — leer antes de tocar la DB

`src/lib/db/migrations.ts` crea **seis tablas**:

- `plants` (`id, name, campo, cuadro, programa, portainjerto, anio, syncStatus`)
- `tratamientos` (`id, plantId, name, description, temporada, isActive`), con
  `FOREIGN KEY (plantId) REFERENCES plants(id) ON DELETE CASCADE` e índice en
  `plantId`
- `respuestas` (`tratamientoId, seccion, payload, syncStatus, updatedAtLocal,
syncedAt, hasError, progress`), con PK compuesta `(tratamientoId, seccion)`, CASCADE
  contra `tratamientos`, índice en `syncStatus` e índice parcial sobre las filas
  con `hasError = 1`. Su repositorio es
  `lib/db/respuestas.repository.ts` y el porqué de la forma está en **Guardado y
  sincronización de respuestas**

- `respuesta_fotos` (`clientId, tratamientoId, categoria, fileName, capturedAt,
syncStatus, syncedAt`), una fila por fotografía, CASCADE contra `tratamientos`
  e índice en `(tratamientoId, categoria)`. Su repositorio es
  `lib/db/respuesta-fotos.repository.ts` y los archivos viven aparte, en
  `lib/photo-files.ts`

- `postcosecha_fotos` (`clientId, plantId, evalId, categoria, fileName,
capturedAt, syncStatus, syncedAt`), lo mismo para post-cosecha, con CASCADE
  contra `plants` e índice en `(plantId, evalId, categoria)`. **El dueño es
  otro**: allí un tratamiento, aquí la plantación más cuál de las cuatro
  evaluaciones del catálogo, que no vive en SQLite

- `postcosecha_respuestas` (`plantId, evalId, seccion, payload, syncStatus,
updatedAtLocal, syncedAt, hasError, progress, empacada`), con PK compuesta
  `(plantId, evalId, seccion)` y CASCADE contra `plants`. **Sin índices
  todavía**: el autoíndice de la PK cubre por prefijo la única lectura caliente,
  y el parcial de `hasError` y el de `syncStatus` entran el día que exista su
  consulta. Su repositorio es `lib/db/postcosecha-respuestas.repository.ts` y el
  porqué está en **Captura de post-cosecha**

**NO existe todavía**: la VIEW `plantaciones_with_progress`. No escribas SELECT
contra nada que no esté en la migración v9.

## Modelo de dominio

> **Plantación** y **tratamiento** ya viven en SQLite (ver el schema arriba).
> **Respuesta** y el cálculo de `progress` siguen siendo diseño objetivo: úsalos
> para diseñar, nunca para asumir que puedes consultarlos.

**Plantación** (solo lectura desde el cliente, se descarga del servidor):
`id, name, campo, cuadro, programa, portainjerto, anio, syncStatus`.
`progress` y el conteo de tratamientos NO se guardarán como columna — se leerán
desde una VIEW de SQLite calculada a partir de `tratamientos`/`respuestas`,
para evitar que se desincronice.

**Tratamiento** (solo lectura desde el cliente, ya implementado): es
`EvaluacionTratamiento` aplanado por el serializer —
`id, plantId, name, description, temporada, isActive`. Relación N:1 con
plantación. Dos trampas de nombre: el campo es `description` (en inglés; el
backend corrigió el typo `descripcion`), y **no existe `estado`** — se quitó del
serializer porque el `is_active` del catálogo `Tratamiento` no le importa a la
app. `isActive` es el de la fila `EvaluacionTratamiento` y es el que decide si
la fila local se conserva o se poda.

**Respuesta** (se crea/edita localmente, es lo que se sincroniza):
se relaciona con el `id` de "tratamiento" tal como el cliente lo recibe
(ver arriba). Representa la captura progresiva de la encuesta (solo
algunos campos obligatorios al inicio, el resto se completa con el
tiempo). Tiene su propio ciclo de sync: `sync_status`
(`pending | syncing | synced | error`), `updated_at_local`, `synced_at`.
La unidad es la **sección**, no la evaluación entera, y su identidad es la
llave natural `(tratamiento, sección)` — no hace falta generar un UUID: las
dos partes ya existen en los dos lados, así que un reenvío no puede duplicar.
Ver **Guardado y sincronización de respuestas** más abajo.

**Reglas de sync clave**:

- Pull de plantaciones/tratamientos y push de respuestas son pipelines
  **completamente separados**.
- Pull usa `updated_since` (watermark) — el cliente guarda `server_time`
  que el backend devuelve en la respuesta (`{ server_time, results }`),
  NUNCA el reloj del dispositivo, para evitar drift de reloj entre tablets.
- El pull incremental devuelve la plantación **también cuando solo cambian sus
  tratamientos**: el viewset añade `pk__in=EvaluacionTratamiento...` al filtro
  de `updated_since`. No hay que pedir los hijos aparte.
- **Las bajas llegan como lápida, no como ausencia.** El `Prefetch` del viewset
  NO filtra por `is_active`, así que el array de `tratamientos` incluye los
  dados de baja con `is_active: false`. Regla única para ambas entidades: si el
  remoto lo desactiva se borra del local, **salvo que haya trabajo local sin
  sincronizar** — el remoto rechaza actualizaciones mientras esté inactivo, así
  que la fila debe sobrevivir hasta que lo reactiven. Implementado en
  `syncPlantsBatch` / `syncPlantTratamientos`.
- Cuando exista `respuestas`, un tratamiento inactivo con respuestas sin
  sincronizar debe conservarse en vez de podarse, y hay que revisar la CASCADE
  de `tratamientos` (borrar uno destruiría sus respuestas). Los
  `TODO(respuestas)` del repositorio marcan los dos puntos exactos.
- El admin puede cerrar una encuesta — el push de respuestas debe manejar el
  rechazo como un estado distinguible (`rejected_closed`), no como error
  genérico. **Ojo: `encuesta_abierta` no existe en el backend.** Se revisó
  `apps/ryd/` entero y el nombre solo aparece en su CLAUDE.md como pendiente;
  de qué campo de `Plantacion` depende está sin decidir.
- Batch push/pull debe devolver resultado granular por registro, no
  todo-o-nada.

## Errores de captura frente a avisos

> Implementado: `lib/evaluation-errors.ts` (con tests), el rojo en Criba y
> Rendimiento, y el estado `invalid` de la cabecera. **Falta** el chip de la
> tarjeta de plantación y que el error impida de verdad dar el tratamiento por
> terminado.

**Un error es un dato que no puede ser cierto; un aviso, uno que se sale de lo
habitual.** Esa es toda la diferencia, y decide el color: rojo contra ámbar.

**El negocio fijó sus números**, así que lo que antes eran avisos sobre rangos
inventados hoy son errores. Son seis, repartidos en tres secciones:

- **Brix**: una lectura fuera de **14.5–30 °Brix** (`BRIX_VALID_RANGE`).
- **Criba**: el promedio por baya mayor que el peso total de su calibre —una
  baya no pesa más que todo lo que cayó en él—, un calibre que pasa de **4 kg**
  (`CRIBA_MAX_CALIBRE_WEIGHT`) y un promedio por baya fuera de **0.5–30 g**
  (`CRIBA_AVERAGE_RANGE`).
- **Rendimiento**: kilogramos cosechados con el conteo de racimos en cero, un
  conteo de más de **500** racimos y un peso que no esté **entre 0 y 500 kg**,
  los dos extremos excluidos.

Que un dato esté **sin capturar** no marca nada en ninguna: es un dato que falta,
no uno imposible, y de eso habla el avance de la sección.

**Un corte sin fruta es la excepción de Rendimiento**: 0 kg con 0 racimos es un
corte que se cosechó y no dio nada, y tiene que poder registrarse, así que queda
fuera de los dos rangos. El error salta en cuanto uno de los dos tiene valor y el
otro no cuadra. Tiene test, porque es justo lo que se pierde leyendo la regla al
pie de la letra.

Los **dos que siguen siendo avisos** son los que no dependen de un número del
negocio: la muestra que no pesa ni 1.5 ni 2.5 kg y el promedio que rompe la
progresión de calibres. Como error bloquearían capturas legítimas — una muestra
que de verdad pesó 1.7 kg.

**Un error no impide guardar.** SQLite es la libreta del evaluador y ahí cabe
todo: bloquear la escritura no protegería el reporte, destruiría trabajo, y
además estos estados aparecen a media captura —por eso existe la pausa de
tecleo—. Lo que el error impide es dar el tratamiento por terminado y mandarlo.
Guardar y dar por bueno son dos cosas distintas.

Dónde se ve: el campo y la alerta de la sección, el **botón flotante**
`EvaluationErrorButton` —«Ir al error de captura»—, que aparece cuando la sección
que lo tiene se queda fuera de la pantalla y lleva hasta ella, y el **chip de la
tarjeta de plantación**, después del de estatus y sin sustituirlo: una plantación
iniciada también puede traer un dato inválido.

Y dentro de la tarjeta, **el chip del tratamiento que falla lleva el borde
rojo**: el de la plantación dice que hay algo, y el borde dice cuál de los
cuatro. Por eso `usePlants` devuelve `tratamientosWithError` —los ids— y no un
booleano: la lista vacía ya significa «sin errores».

**La marca va guardada en la columna `hasError` de `respuestas`, no calculada al
leer.** La pone `saveRespuesta` al escribir la sección y el listado solo la
consulta: `SELECT DISTINCT tratamientoId ... WHERE hasError = 1`, sin abrir un
solo payload. Que baste con la sección, sin reconstruir la evaluación del
tratamiento, es porque **cada regla de error cabe dentro de su propia sección**
(`ERROR_SECTIONS`).

Se probó antes calculándolo al leer y se cambió por esto: abrir los payloads de
todas las plantaciones crecía con los datos —medido sobre payloads llenos, 400
filas 3 ms, 1 600 filas 9 ms y 8 000 filas 40 ms en V8, y Hermes es varias veces
más lento—, y eso es bloqueo del hilo de JS justo al entrar al listado.

Es un dato derivado, con el riesgo que eso trae, y **lo que lo hace seguro es que
lo calcula el propio `saveRespuesta`**: no hay forma de escribir una fila cuyo
`hasError` no corresponda con su `payload`. Si algún día hace falta otra marca
derivada, ese es el sitio. El índice es parcial —solo las filas marcadas—, porque
uno normal sobre una columna de dos valores no sirve de nada.

**Ojo con las capturas anteriores a la migración v4**: nacen con `hasError = 0`
aunque su payload traiga el error, y no se marcan hasta que esa sección se vuelva
a guardar. No se hizo backfill porque no hay datos en producción; si algún día
hiciera falta, es recorrer las filas de `ERROR_SECTIONS` una vez.

**En la cabecera no va.** Se probó y se quitó: allí el error competía con el
estado de guardado y acababa tapando el "Guardando…" justo cuando había algo sin
escribir, que es cuando más falta hace verlo. La cabecera responde «¿está a
salvo mi trabajo?» y el botón «¿hay algo que revisar y dónde?»; mezclarlas dejaba
las dos peor.

## Fotografías

**Cada fotografía es una fila en `respuesta_fotos` y un archivo en disco, y se
guarda en cuanto se captura**, sin esperar al guardado del formulario: lo que
devuelve `expo-image-picker` vive en la caché del sistema, que puede purgarse.

El reparto por capas no es estilo, es lo que mantiene los tests en pie: **el
repositorio no puede importar `expo-file-system`** o dejarían de arrancar contra
`createInMemoryDb`.

| Dónde                                  | Qué                                     |
| -------------------------------------- | --------------------------------------- |
| `lib/db/respuesta-fotos.repository.ts` | filas, cero disco                       |
| `lib/photo-files.ts`                   | el único que importa `expo-file-system` |
| `lib/photo-file-name.ts`               | derivar el nombre, puro y con test      |
| `hooks/use-respuesta-fotos.ts`         | el pegamento y las mutations            |

Lo que no es obvio:

- **API nueva de Expo 57**: `File`, `Directory` y `Paths`. La vieja
  (`FileSystem.copyAsync`) **lanza en runtime** desde el entry principal; vive en
  `expo-file-system/legacy`. `create`, `delete` y `exists` son síncronos,
  `copy` no.
- **En SQLite se guarda el nombre del archivo, nunca la ruta.** El contenedor de
  la app cambia de UUID entre instalaciones en iOS, así que una ruta absoluta
  guardada hoy apunta a la nada mañana aunque el archivo siga ahí. La reconstruye
  `photoUri`.
- **El nombre sale del `clientId`**, que es la PK: es lo que impide que la fila y
  el archivo se desacoplen, y de paso evita las colisiones de nombres del picker.
- **Al añadir, archivo primero y fila después; al borrar, al revés.** El
  invariante que queda es _toda fila tiene archivo, algún archivo puede no tener
  fila_, y es justo el que la barrida asume. En el orden contrario quedaría una
  celda rota para siempre y un push intentando subir lo que no está.
- **La CASCADE no toca el disco.** Podar un tratamiento borra sus filas y deja
  los archivos, así que `sweepOrphanPhotos` los recoge por diferencia al final de
  la descarga —fuera de su transacción, y con su propio `catch`: no recuperar
  espacio no puede tumbar una descarga correcta—. La operación inversa, borrar
  filas cuyo archivo falta, **no se hace**: es destructiva ante un fallo temporal
  de lectura.
- **La cuadrícula identifica por `clientId`, no por posición.** Antes borraba por
  índice, lo cual obligaba a hacerlo en lote para que no se desplazaran; ahora lo
  marcado sobrevive a que la lista se refresque por detrás.
- `File.createUploadTask(url, { uploadType: UploadType.MULTIPART, onProgress })`
  cubre el contrato el día del push, sin `axios` ni `FormData` a mano.

Pendiente y anotado: **borrar una foto ya sincronizada necesitará lápida** —el
contrato borra por `client_id` y borrar la fila pierde el id que había que
mandar—, no hay tope ni política de retención, y una foto de galería en iOS puede
llegar en HEIC, que el `ImageField` de Django solo acepta con `pillow-heif`.

## Guardado y sincronización de respuestas

> **Qué hay de esto:** el guardado local funciona de punta a punta —migración
> v3, `lib/db/respuestas.repository.ts`, el volcado al formulario y la barra de
> guardado—. **Falta todo el push y todo el lado servidor**, y las fotografías
> siguen sin persistir. El contrato completo —payload de cada sección,
> endpoints, códigos de error y modelos propuestos para Django— está en
> [`docs/contrato-respuestas.md`](docs/contrato-respuestas.md). Aquí solo van las
> decisiones y su porqué, para no volver a discutirlas.

**La tablet y el servidor guardan formas distintas a propósito.** La forma de
una tabla la dictan sus lectores: los de la tablet son el formulario —que
rehidrata la sección entera de golpe— y el conteo de progreso, sin una sola
consulta analítica; los del servidor son los reportes y los dashboards, que
preguntan cosas como la distribución de calibres por portainjerto y eso es
`GROUP BY` sobre filas. Por eso la tablet guarda JSON y el servidor
**desempaqueta ese JSON en tablas normalizadas**. Lo que une a los dos lados es
el contrato del payload, no una réplica de tablas.

**La unidad es la sección**, no la evaluación entera, porque la evaluación no se
captura de una sentada: Rendimiento guarda una fecha por corte y los cortes
ocurren en días distintos, y las post-cosecha son a 15 y 30 días. Una evaluación
vive semanas. Con la sección como unidad, lo terminado se sincroniza y queda a
salvo sin arrastrar lo que falta. Efecto lateral que encaja con el resto del
modelo: **sin fila no es lo mismo que fila vacía** —una sección que nadie tocó
no existe; una capturada y vaciada, sí—, el mismo "vacío no es cero" de Brix,
Criba y Rendimiento un nivel más arriba.

La tabla local, en la migración v3:

```sql
CREATE TABLE IF NOT EXISTS respuestas (
  tratamientoId TEXT NOT NULL,
  seccion TEXT NOT NULL,                      -- EvaluationSectionId
  payload TEXT NOT NULL,                      -- la sección, tal como se capturó
  syncStatus TEXT NOT NULL DEFAULT 'pending',
  updatedAtLocal TEXT NOT NULL,
  syncedAt TEXT,
  PRIMARY KEY (tratamientoId, seccion),
  FOREIGN KEY (tratamientoId) REFERENCES tratamientos(id) ON DELETE CASCADE
);
```

**El guardado es automático por sección, y el botón "Guardar" hace lo mismo ya.**
La pantalla escribe sola cuando el evaluador lleva dos segundos sin tocar nada
(`EvaluationAutosave`), porque en campo la app puede morir sin aviso y nadie se
acuerda de un botón; el botón existe igualmente porque ver "Guardado" después de
pulsarlo es lo que deja tranquilo a quien capturó media hora, y por eso pulsarlo
sin nada pendiente también enciende el "Guardado" en vez de no hacer nada. Solo
viajan a SQLite las secciones que cambiaron —`lib/evaluation-snapshot.ts` las
compara—, para que guardar comentarios no devuelva a la cola del push una criba
ya sincronizada. Esa comparación ordena las claves y descarta las `undefined`:
react-hook-form reconstruye objetos por su cuenta y un reordenamiento contaría
como cambio. **Las fotografías no entran en ese guardado.**

**El estado vive en la cabecera, y llega ahí por un store**
(`store/evaluation-save-store.ts`). El motivo no es preferencia: la cabecera es
el `header` del navigator, se pinta **fuera** del árbol de la pantalla y no ve el
`FormProvider`, así que no puede preguntar por sí misma si hay algo sin guardar
—mismo caso que `photos-store`—. Quien calcula y escribe es `EvaluationAutosave`,
que no pinta nada: mira el formulario entero con `useWatch`, de modo que el
re-render de cada tecla se queda en él y no repinta las seis secciones. Los dos
botones van al store como **funciones y no como una señal que un efecto atienda**:
pulsar es un evento, y pasándolo por un efecto el guardado a mano tendría que
cambiar estado en mitad de un render —que es justo lo que prohíbe
`react-hooks/set-state-in-effect`—. Los estados salen del artifact «Estado de
guardado en la cabecera», con un ajuste probado en tablet: **«hay cambios» y
«escribiendo» se enseñan igual**, los dos como "Guardando…" con la rueda
girando. Escribir en SQLite dura milisegundos, así que un indicador atado solo a
la escritura no llegaba a dibujarse; juntos, la rueda gira desde el primer cambio
y se queda hasta que termina. Eso deja fuera el «Cambios por guardar» del
diseño, que avisaba de un problema que se arregla solo. Quedan tres: nada al
abrir, "Guardando…", "Guardado" en verde, y rojo si falla. La distinción interna
sigue viva porque decide qué se bloquea: solo la escritura de verdad apaga
volver, descartar y guardar.

**Al salir de la pantalla se vacía lo pendiente** (la limpieza de
`EvaluationAutosave`). Sin eso se perdía lo último tecleado en los dos segundos
antes de salir, porque el temporizador del autoguardado moría con el componente:
se veía clarísimo con un aviso delante —sale a los 900 ms, así que daba tiempo de
leerlo y salir antes de que nada se hubiera escrito—, pero pasaba con cualquier
dato. El vaciado llama al repositorio directamente y no a la mutation, que no
llega viva al final del desmontaje. **Sigue sin cubrir que el sistema mate la
app**: para eso haría falta engancharse a `AppState`.

De ahí sale `MANUAL_FEEDBACK_MS`: **al pulsar «Guardar» la rueda se queda un
momento aunque la escritura acabe antes**. Sin eso el botón parecía roto, porque
lo normal es pulsarlo cuando ya está todo guardado y reconfirmar un estado no se
ve en pantalla. No es una espera artificial —el guardado ocurre igual de
rápido—, es que la respuesta se vea. El autoguardado no lo necesita: ahí la
rueda ya lleva girando los dos segundos.

**El volcado al abrir es de una sola vez por tratamiento**
(`buildEvaluationFromRespuestas` + el `loadedFor` de la pantalla): la query de
respuestas no se invalida al guardar y el volcado no se repite, o un refetch
pisaría lo que se está escribiendo. Una sección cuyo payload no encaje con el
esquema se muestra en blanco y **su fila no se toca**, así que el dato sigue en
SQLite.

**En SQLite se guarda lo capturado (`z.input`), no lo validado (`z.output`)** —
los dos tipos ya están separados en `evaluation-schema.ts`. Reabrir la pantalla
tiene que enseñar exactamente lo que se tecleó: si se guardara el número, `"14."`
a medio escribir no existiría y al rehidratar habría que decidir si un `14` se
pinta `"14"` o `"14.0"`. El parseo a números es un paso del push, en un mapper de
`lib/` con test, no del guardado.

**Las fotografías no van en `respuestas`** aunque sean una sección en pantalla:
son archivos. Van en `respuesta_fotos`, una fila por archivo, con UUID de
cliente —ahí sí, porque un archivo no tiene llave natural— y su subida será
multipart, una petición por foto. Cómo se guardan está en **Fotografías** más
abajo.

**El progreso se calcula en TypeScript al guardar**, donde los valores ya están
en memoria y tipados, y se escribe como columna en esa misma fila; la VIEW de
plantación solo agrega. Así la regla de "qué cuenta como completo" vive una sola
vez, en `lib/` con tests, en vez de reescrita en SQL, y el diseño no depende de
las funciones JSON de SQLite. No contradice el "progress no se guarda como
columna" de arriba: aquel es el de plantación, que se alimenta de otras tablas y
por eso puede desincronizarse; este es un derivado de la misma fila, escrito en
la misma transacción por el único escritor. Esa columna todavía no puede nacer:
**cuándo cuenta una sección como completa sigue sin definir** —Brix no tiene un
número fijo de cortes—.

### Lo que hay que construir en Django

El punto de partida real, verificado leyendo `apps/ryd/` entero:
`RespuestaTratamiento` **existe pero está vacío** (`models.py:155`) —OneToOne
contra `EvaluacionTratamiento` con `primary_key=True`, `evaluador`, las dos
fechas, y un comentario `# respuestas here` donde irían las columnas—. La tabla
no tiene filas, así que es modificable sin migrar datos. No hay serializer de
escritura, no hay endpoint de escritura (`PlantacionViewSet` es un
`ReadOnlyModelViewSet` y es la única vista), y no hay ni un `ImageField` en todo
el módulo.

Lo que el servidor tiene que hacer, con el detalle en el contrato:

- **Aceptar escritura por sección** (`PUT .../respuesta/{seccion}/` y su versión
  en lote), creando el ancla al primer envío con `get_or_create`.
- **Reemplazar dentro del alcance de la sección**, nunca mezclar: el payload es
  el estado completo de esa sección, y mezclando, "descarté el corte 3" sería
  inexpresable y el corte borrado viviría para siempre en el reporte.
- **No rechazar por contenido.** Valida forma y guarda; los rechazos se reservan
  para encuesta cerrada, tratamiento inactivo, auth y JSON malformado. Un
  rechazo por contenido deja el dato encerrado en la tablet.
- **Guardar el payload crudo** en una columna además de desempaquetarlo. Es lo
  que hace segura la regla anterior: una pregunta que la app ya manda y el
  servidor todavía no tiene columna para ella no se pierde, se reprocesa.
- **`DecimalField`, no `FloatField`**, en pesos y lecturas: los reportes los
  suman por miles de filas y el error binario acaba descuadrando el dashboard
  contra la tablet.
- **Los derivados no se guardan**: R1–R5, los promedios, el peso de la muestra y
  la distribución por calibre se calculan al consultar.
- **`null` no es `0`** al desempaquetar. Es la regla que atraviesa todo el
  formulario y coalescerla corrompe todos los promedios del reporte.

## Reglas de negocio

- **Avance de un tratamiento** (`lib/evaluation-progress.ts`, con tests): el
  promedio de **seis** secciones, un sexto cada una — fotografías, exterior,
  interior, brix, criba y rendimiento. **Comentarios no reparte**: sus tres
  notas son libres y ninguna obligatoria, así que contarlas haría que el 100 %
  exigiera escribir texto que el negocio no pide. Lo que no es obvio:
  - **En Brix y Rendimiento el denominador es siempre el primer corte**, no los
    que haya. Solo se agrega uno cuando el anterior está terminado, así que el
    mínimo capturable es uno y los demás son trabajo extra que no mueve la
    barra. Con el denominador creciendo, **agregar un corte haría retroceder el
    avance**, que es lo único que una barra no puede hacer. Tiene test.
  - **Va guardado por sección**, en la columna `progress` de `respuestas`, por lo
    mismo que `hasError`: el listado lo pregunta de todas las plantaciones a la
    vez y calcularlo al leer obligaba a abrir cada payload. El del tratamiento
    sale en SQL, sumando sus filas y dividiendo entre las seis secciones; las que
    no tienen fila cuentan cero, que es lo correcto.
  - **El chip de la tarjeta enseña el porcentaje de la plantación** («45 %»), y
    su color sigue separando lo empezado de lo que no —que es lo que preguntan
    los filtros «Sin iniciar» / «Iniciadas»—. Antes enseñaba esa palabra; el
    número resume la plantación entera —los dos bloques, ver el 50/50 aquí
    abajo— y cuánto lleva cada captura ya lo dice su propia tarjeta. El filtro por estatus nunca tuvo lógica rota: miraba
    `progress`, que estaba clavado a `0` en `index.tsx`. «Pendientes» sigue
    esperando a la sincronización.
  - **Dónde se ve**: en la pantalla de captura, una barra fina a ancho completo
    al pie del bloque de la cabecera, y en el chip de cada tratamiento del
    listado. La barra **no se esconde al scrollear** aunque los datos de la
    plantación y los chips sí: comparte el `hidden` de `useHideOnScroll` pero se
    desplaza su alto menos el propio, así que sube hasta quedarse pegada bajo el
    header en vez de irse con el bloque. Lleva su propio fondo verde porque una
    vez arriba, lo que pasa por detrás es el formulario. En las cabeceras de sección **no hay barra**: enseñan el conteo en
    texto («8 de 16 preguntas», «2 de 3 categorías»), igual que Criba y
    Rendimiento, porque lo que el evaluador quiere saber ahí es cuántas faltan.
  - **Las fotografías suman como las demás**, en los dos sitios: la cabecera las
    consulta agrupadas en memoria y el listado las cuenta en SQL
    (`getFotoCategoriaCounts`). La regla vive una sola vez, partida en
    `fotografiasProgress` —la aritmética— y el conteo, que cada uno hace como
    puede.
- **`progress` de plantación** = 50% bloque tratamientos + 50% bloque post-cosecha.
  Cada bloque se prorratea internamente por sus propias unidades:
  3 tratamientos con 1 completo → `(1/3) × 50% = 16.6%`. Una plantación con
  su único tratamiento completo y toda la post-cosecha pendiente va en 50%.
  **Si un bloque no existe, el otro se queda con todo**: una plantación sin
  tratamientos configurados no tiene ahí trabajo pendiente, y repartirle su
  mitad igualmente dejaría la tarjeta con un tope del 50 % que nadie podría
  subir. Es el caso que la regla no contemplaba y está resuelto en
  `plantProgress`, con test.
- **`EVALS_POST_COSECHA`** (`src/domains/plants/lib/evals-post-cosecha.ts`)
  es un **catálogo fijo del negocio**: 15 y 30 días × caja y plástico.
  Es idéntico para toda plantación, así que el denominador de ese bloque
  siempre es 4. No lo parametrices ni lo muevas al servidor sin pedirlo.
- **Brix** (`src/domains/plants/lib/brix.ts`, con tests): por corte se hacen 10
  lecturas de refractómetro en 5 pares, y cada resultado es el promedio de su
  par (R1 = (L1 + L2) / 2 … R5 = (L9 + L10) / 2). Lo que no es obvio:
  - **Un faltante queda vacío, nunca en cero.** Un R sin sus dos lecturas es
    `null` y no entra en ningún promedio; tomarlo como cero hundiría el
    promedio sin que nadie lo notara.
  - **Brix promedio = media de todos los R capturados**, no de los promedios de
    cada corte: promediar promedios le daría a un corte a medias el mismo peso
    que a uno de cinco resultados.
  - **Los cálculos no se redondean.** Solo `formatBrix`, al mostrar: dos
    decimales fijos y la mitad hacia arriba. `toFixed(2)` a secas redondea el
    binario, y 59.725 (guardado como 59.72499…) saldría 59.72.
  - **El rango 5–35 °Brix es un supuesto sin confirmar con agronomía.** Fuera de
    él se avisa, pero la lectura cuenta.
  - Solo se agrega un corte cuando el último tiene sus diez lecturas, y solo
    se descarta el último —nunca el único—, para que la numeración siga siendo
    consecutiva.
  - **Sin definir:** cuándo cuenta Brix como completo para el `progress` del
    tratamiento (no hay un número fijo de cortes), y si el backend guardará las
    10 lecturas o solo R1–R5. Hoy vive en el formulario de la pantalla
    (`brix.cortes`, react-hook-form), igual que las preguntas de exterior e
    interior, y todavía no se guarda en SQLite.
- **Criba** (`src/domains/plants/lib/criba.ts`, con tests): la muestra se pasa
  por la criba y queda repartida en nueve calibres, del 8 al 16. De cada uno se
  captura el peso total y el de una baya promedio. Lo que no es obvio:
  - **Vacío no es cero, y 0 g sí significa algo.** Un calibre sin capturar no
    entra en ninguna cuenta; uno pesado en 0 g no tenía fruta, así que cuenta
    como completo sin promedio —no hay bayas que pesar— y su campo de promedio
    lo dice con «No aplica».
  - **El peso de la muestra es la suma de lo capturado**, no un dato aparte, y
    la distribución de cada calibre es su parte de esa suma. Con la muestra en
    cero no hay nada que repartir: la distribución queda vacía, no en 0 %.
  - **Cuatro reglas que no bloquean el guardado**, igual que el rango de Brix.
    Una de ellas es **error** y las otras tres avisos (ver «Errores de captura
    frente a avisos»). Dos son de coherencia entre pesos: el promedio mayor que
    el peso total del calibre, que es imposible y es el error, y el promedio más
    bajo que el del calibre capturado anterior,
    que es incoherente porque la criba separa por tamaño y la baya de un calibre
    pesa más que la de uno más pequeño. La cadena del segundo salta los calibres
    sin promedio: uno sin capturar, o con 0 g, no rompe la secuencia ni sirve de
    referencia. Los otros dos son de magnitud: 1 kg o más en un solo calibre
    (`CRIBA_MAX_CALIBRE_WEIGHT`), que no cabría ni en la muestra grande, y una
    muestra que no pese exactamente uno de los dos `CRIBA_SAMPLE_WEIGHTS` —1.5
    kg o 2.5 kg, los mismos que explica la nota del pie—.
  - **El de la muestra espera a que ya no pueda arreglarse solo.** La suma crece
    mientras se llenan los calibres y por el camino casi nunca vale ninguno de
    los dos, así que solo avisa si se pasó del mayor o si están los nueve
    pesados. Y calla mientras se teclea **cualquier** calibre, no solo el que
    suma de más: el peso a medio escribir ya va dentro de la suma, así que
    camino de «250» el «2500» intermedio dispararía el aviso.
  - **La comparación con 1.5 / 2.5 kg lleva tolerancia de 0.05 g, y no es
    holgura de báscula: es coma flotante.** Sumar nueve decimales da
    1500.0000000000002 constantemente —probado sobre 200 000 repartos al azar,
    el 44 % no daba 1500 exacto—, así que con `===` la app regañaría en capturas
    correctas.
  - **Se enseña un aviso a la vez**, el más grave, y el siguiente aparece cuando
    se arregla (`firstCribaWarning`, con test del orden). Se arrastran: un
    calibre con un kilo de más desbarata también la suma, así que enseñar las
    dos cosas es contar dos veces el mismo error. El orden va de causa a efecto:
    peso total imposible → muestra que no cuadra → promedio mayor que su calibre
    → promedio que rompe la progresión. En ámbar se ponen solo los campos del
    aviso que se está enseñando; un campo marcado cuyo problema no explica nadie
    deja al evaluador buscando.
  - **El peso de muestra de referencia es una nota fija**: 1.5 kg en plantación
    experimental (primera etapa) y 2.5 kg en semiexperimental (segunda). La
    etapa no se puede obtener desde la app —no está en `plants` ni la manda el
    backend—, así que la nota nombra las dos y el evaluador sabe cuál le toca.
    Es la decisión, no un hueco que haya que tapar.
  - La máscara al teclear, el paso de texto a número y el redondeo al mostrar
    los comparte con Brix (`lib/decimal-text.ts`): es el mismo dato capturado a
    mano, y de dos copias salen cifras distintas en el último decimal.
- **Rendimiento** (`src/domains/plants/lib/rendimiento.ts`, con tests): de una
  plantación se cosechan varios cortes, y de cada uno se captura la fecha, los
  kilogramos y los racimos. **Sin tope de cortes:** el diseño hablaba de cinco,
  pero está sin confirmar con el negocio y de momento se deja abierto. Lo que no
  es obvio:
  - **Vacío no es cero, pero 0 kg sí cuenta.** Un corte sin kilogramos no suma
    ni cuenta como registrado; uno pesado en 0 kg sí, porque se pesó.
  - **0 kg y 0 racimos es un corte sin fruta**: el promedio por racimo dice «No
    aplica» en vez de dividir, que daría un cero con pinta de dato.
  - **Kilogramos con el conteo en cero es error, no aviso** (`zeroRacimos`): la
    fruta salió de algún sitio. Que el conteo esté **sin capturar** no saca
    nada: es un dato que falta, y de eso habla el avance de la sección. Poner
    una alerta por cada hueco sería una alerta permanente — se intentó y se
    quitó. En ninguno de los dos casos hay promedio: la división por cero no es
    la respuesta.
  - **Solo se agrega el corte siguiente cuando el anterior tiene sus tres
    datos**, para que la numeración siga siendo consecutiva. El botón se queda
    deshabilitado con una nota de qué falta —igual que el de Brix— en vez de
    desaparecer, que no explicaría nada. Y solo se descarta el último, nunca el
    único, con la misma confirmación de dos toques que Brix.
  - **Las fechas se guardan en ISO (`2026-08-12`) y se muestran `12/08/2026`**
    (`src/lib/dates.ts`): ISO ordena bien como texto y no depende de cómo tenga
    configurada la tablet el evaluador. El paso de `Date` a ISO va en hora
    local, nunca con `toISOString()`, que de noche guarda el día siguiente.
    Elegirlas es `components/ui/date-field.tsx`, que envuelve las dos formas de
    `@react-native-community/datetimepicker`: diálogo del sistema en Android y
    calendario montado en un modal en iOS.

## Captura de post-cosecha

> **Qué hay de esto:** la pantalla guarda de punta a punta —migración v8,
> `lib/db/postcosecha-respuestas.repository.ts`, autoguardado, guardado a mano,
> limpiar y barra de avance—, y **cada tarjeta de post-cosecha del listado
> enseña la suya** (`getPostcosechaProgress`), que además ya entra en el
> `progress` de la plantación con su mitad. **Falta el push**, igual que en
> tratamiento.

Es la encuesta de tratamiento hecha otra vez, y **deliberadamente aparte**. Lo
que comparten está en `lib/` —el catálogo de comentarios, la mecánica del
snapshot (`section-snapshot.ts`), la barra (`evaluation-progress-bar.tsx`), los
widgets de la cabecera (`evaluation-save-controls.tsx`) y el store
(`evaluation-save-store.ts`)—; lo que no, tiene su hermano: `postcosecha-schema`,
`postcosecha-snapshot`, `postcosecha-progress`, `postcosecha-errors` y
`PostcosechaAutosave`. Juntar los dos autoguardados en uno con seis parámetros
haría más difícil de leer justo la parte delicada, que es la secuencia.

Lo que no es obvio:

- **La identidad es `(plantId, evalId)`, nunca solo la ruta.** Saltar entre las
  cuatro es `setParams`, que **no desmonta la pantalla**: comparar solo el `id`
  deja en pantalla lo de «15 días / caja» al entrar en «30 días / caja», y el
  autoguardado lo escribe en la evaluación equivocada. De ahí el `owner` de la
  pantalla, y el `key={owner}` del autoguardado — sin esa `key`, `written`
  sobrevive al salto con la foto de la anterior y se escribe una dentro de otra.
- **Las secciones del formulario ya no llevan `key` propia**: quien las vacía al
  saltar es el `reset` del volcado. Con las dos cosas habría dos mecanismos para
  lo mismo. El bloque de fotografías sí la conserva: su estado es suyo.
- **El `gcTime: 0` pesa más aquí que en tratamiento.** Allí el riesgo aparece al
  reabrir la pantalla; aquí los cuatro chips son la navegación normal, así que
  volver a una evaluación ya escrita es constante. Su corolario: el formulario se
  vacía **ya** al cambiar de evaluación, sin esperar a SQLite, o se vería un
  instante lo de la anterior.
- **El avance se reparte por unidades y no por secciones**: las once preguntas de
  fruta y la única toma de fotografía, todas pesando lo mismo. Con el reparto de
  tratamiento —cada sección un sexto— adjuntar una foto valdría el 50 %.
  Comentarios no reparte, igual que allí.
- **Los tres porcentajes no se capturan, se calculan** desde cuatro pesos en
  gramos —inicial con empaque, final a los 15 o 30 días, y los de bayas
  reventadas y desgrane—: deshidratación es `(inicial − final) ÷ inicial`, y los
  otros dos son su parte del peso final. Es el mismo movimiento que el peso de
  muestra y la distribución de Criba, y por lo mismo **no se guardan**: son
  derivados de datos que ya están en la fila. Vive en `summarizeFrutaPesos`.
- **Los pesos se guardan como texto**, no como número, igual que Criba y Brix:
  reabrir tiene que enseñar lo tecleado, y un «8002.» a medio escribir no existe
  como número. El paso a número es de quien calcula y, el día del push, del
  mapper.
- **Con un peso imposible el resultado no se calcula.** Un porcentaje salido de
  un dato que no puede ser cierto parece un resultado y no lo es; en su sitio la
  leyenda dice qué revisar o cuál de los cuatro falta.
- **`PercentSlider` ya no lo usa nadie**, y se conserva a propósito: resuelve el
  gesto, el paso, el clamp y el estado «sin capturar» con su manija atenuada, y
  volver a escribirlo costaría más que mantenerlo.
- **Limpiar borra una evaluación, no las cuatro**, y sí se lleva sus
  fotografías. Por eso el texto del diálogo la nombra: con los chips es fácil
  estar en la que no es.
- **La esquina de la tarjeta enseña una sola señal, y en este orden**: la equis
  roja si hay un dato imposible, el check si está al 100 %, y el icono de
  empaque si la caja ya tiene fecha. El de empaque desaparece al completarse
  porque para llegar al 100 % hay que haberla capturado — serían dos iconos
  diciendo lo mismo. Las tres salen de columnas (`hasError`, `progress`,
  `empacada`) escritas al guardar, así que el listado no abre ningún payload.
- **Cuatro errores y un aviso** (`postcosecha-fruta.ts`). Los errores son los
  imposibles: evaluar **antes** del empaque —la caja no se puede abrir antes de
  existir—, un peso final mayor que el inicial —la fruta no sale del cuarto frío
  pesando más de lo que entró— y cada parte de la caja pesando más que la caja
  entera. Los cuatro marcan la columna `hasError`. Que
  la evaluación no caiga a los 15 o 30 días del empaque —según cuál de las
  cuatro se capture— es **aviso**: pudo abrirse un día tarde y el dato sigue
  valiendo. El aviso **calla cuando el error habla**, igual que en Criba: dos
  alertas para la misma fecha sería contarlo dos veces. Y nombra la fecha que
  tocaba, para poder corregirla sin contar días a mano.
- **Sin `resolver` en el formulario**: nada se envía. El papel de
  `postcosechaSchema` es hacer de portero al volcar lo que sale de SQLite y tipar
  el formulario, no validar al capturar.
- **El listado reconstruye el avance desde la columna, y sale exacto.**
  `progress` guarda `round(contestadas / 11 × 100)`, y esos doce valores no se
  pisan, así que `round(progress × 11 / 100)` devuelve el conteo original
  (`postcosechaProgressFromRow`, con test que recorre los doce). Si algún día la
  sección deja de tener once preguntas, eso puede dejar de ser cierto **sin que
  nada avise**: ahí es donde hay que mirar.

## Naming

Identificadores **técnicos en inglés** (tablas, hooks, tipos, query keys,
carpetas de dominio); **campos de negocio en español** y son intocables
(`campo`, `cuadro`, `programa`, `portainjerto`, `anio`), porque así los
nombra el backend y así los dicen los evaluadores. `plants` es la tabla y
el dominio; `["plants"]` la query key.

La regla de fondo es **espejar el nombre que usa el backend**, no "todo en
español": por eso `tratamientos` convive con `description` en inglés (allá se
renombró) y `temporada` en español.

## Convenciones establecidas

- **Toda la navegación pasa por `useAppRouter`** (`src/lib/use-app-router.ts`),
  nunca por el `useRouter` ni el `router` de `expo-router`. Es el mismo router
  con las navegaciones bajo un candado (`lib/navigation-lock.ts`): la primera
  pasa y las que lleguen pegadas a ella se descartan. Sin eso, cada toque manda
  su propia navegación y tocar tres veces una tarjeta apila tres pantallas
  iguales — en una tablet, en el campo, pasa constantemente. Lo fuerza ESLint
  con `no-restricted-imports`, así que un botón nuevo no puede saltárselo por
  descuido. **`<Link>` de Expo Router no está cubierto**: navega por su cuenta,
  así que si algún día se usa hay que envolverlo igual.
- **Antes de escribir un componente de UI, buscarlo en react-native-reusables.**
  RNR trae resueltos el estado, la accesibilidad y el comportamiento web/nativo
  de cada patrón; reimplementarlos a mano hace que dos controles equivalentes se
  comporten distinto. Los primitivos instalados están en `package.json`
  (`@rn-primitives/*`) y sus wrappers en `src/components/ui/`. Si el que hace
  falta no está, casi seguro existe en la misma línea de versión: proponer
  añadirlo — **preguntando antes, porque son dependencias nuevas**— en vez de
  construir uno propio. Bespoke solo cuando RNR no cubra el patrón (ej.
  `pressable-scale`)
- **Estructura**: `domains/<dominio>/{components,hooks,lib,api,store,types.ts}`.
  El repositorio de SQLite va anidado en `lib/db/` (ej.
  `domains/plants/lib/db/plants.repository.ts`), no en un `db/` de primer nivel
- **Componentes de card compuestos** en un solo archivo cuando son
  exclusivos de ese dominio (no fragmentar prematuramente por "un
  componente por archivo" — solo separar cuando algo se reutiliza fuera
  de su contexto original)
- **Lógica pura** (filtros, mappers, cálculos) SIEMPRE en su propio
  archivo bajo `lib/`, testeable sin React
- **Query keys desde una constante exportada** (`PLANTS_QUERY_KEY` en
  `hooks/use-plants.ts`), nunca un array literal suelto en cada hook —
  se desincronizan y la invalidación deja de funcionar en silencio
- **`useCallback`** para funciones invocadas múltiples veces con distintos
  args por el consumidor (`renderItem`, `ItemSeparatorComponent`).
  **`useMemo`** para objetos/elementos ya construidos que se pasan una
  sola vez (`ListEmptyComponent` como elemento, `Stack.Screen options`)
- Nunca envolver en `React.memo()` un componente pasado como
  `ListEmptyComponent`/similar — algunas listas invocan el componente
  directo como función, y `memo()` rompe eso silenciosamente
- Componentes "tontos" (presentacionales, reciben todo por props) vs.
  componentes "inteligentes" (consumen hooks/stores) — separar cuando el
  estado es genuinamente transversal (ej. `SyncBlock`/`DownloadBlock`
  se conectan a su hook internamente porque se usan en múltiples
  pantallas); mantener presentacional cuando el dato es local a una
  pantalla (ej. empty states reciben todo por props)
- `EmptyState` es genérico (`icon`, `title`, `body`, `renderAction`),
  reutilizable en toda la app
- **Un campo marcado se marca con la variante del `Input`**, nunca con clases
  sueltas: `warn` para el dato fuera de lo habitual y `destructive` para el
  imposible. Estaban escritas a mano en Brix, Criba y Rendimiento, y cambiar el
  ámbar obligaba a tocar los tres. Las variantes llevan también el color del
  cursor y de la selección, que son props del `TextInput` y no salen del
  `className`: sus hex son los tokens `warn` y `destructive` de
  `tailwind.config.js`, copiados en `input.tsx` porque desde JS no hay forma de
  leerlos.
- **Los atajos flotantes entran y salen con `useAppearAnimation`**
  (`src/lib/use-appear-animation.ts`): 200 ms de opacidad y 20 px de subida. Lo
  usan el botón de volver arriba del listado y el de ir al error de captura, y
  los números viven ahí y no en cada uno porque dos atajos que aparecen distinto
  se leerían como dos cosas distintas de la app. `appearTo` es un worklet para
  que dé igual si la decisión se toma en el hilo de la interfaz —el listado la
  resuelve dentro de su `useAnimatedScrollHandler`— o desde JS.
- **Las animaciones van con Reanimated manual, nunca con las clases
  `animate-*` de NativeWind** (ver el gotcha). El pulso de skeletons y dots de
  estado está en `usePulseAnimation` (`src/lib/use-pulse-animation.ts`): sus
  defaults replican el `animate-pulse` de Tailwind y acepta `minOpacity`,
  `cycleMs` y `enabled`. Las `animate-in` que quedan en `components/ui/*` son
  de `tailwindcss-animate` y viven dentro de `Platform.select({ web })`, así
  que no afectan a nativo

## Convenciones de test

- Carpeta `__tests__` (plural) junto al código que prueba, y sufijo
  `.test.ts` / `.test.tsx` obligatorio en el archivo
- Factories en `src/test-utils/factories/`, importadas como
  `@/test-utils/factories/<x>.factory`. **El único alias que existe es `@/*`**
  (`tsconfig.json`); no hay alias `@test-utils/*`
- **Lógica pura siempre lleva test** (mappers, filtros, cálculos,
  repositorios). Componentes y hooks solo cuando se pidan explícitamente
- **Los repositorios se prueban contra SQLite de verdad**, no mockeado:
  `createInMemoryDb()` (`src/test-utils/in-memory-db.ts`) adapta el `node:sqlite`
  built-in de Node a la superficie de `SQLiteDatabase`, sin dependencias nuevas.
  Ejemplo en `lib/db/__tests__/plants.repository.test.ts`. Ojo: `DatabaseSync`
  activa las foreign keys por defecto, así que esos tests validan que la CASCADE
  esté bien declarada, **no** el `PRAGMA` de `runMigrations`.
- Preferir `getByText`/`getByRole` sobre snapshots o selección por
  className — los tests deben sobrevivir cambios visuales menores
- El CI (`.github/workflows/test.yml`) corre `npx jest --ci --coverage` y
  `npx tsc --noEmit` en cada PR a `main`. Reproducir ambos localmente antes de
  dar algo por terminado
- **ESLint** (`npm run lint`, que es `expo lint`) con la config plana de Expo.
  Hoy sale en cero errores; lo que queda son avisos de antes —dependencias de
  hooks omitidas a propósito, `no-redeclare` de tipos con el nombre de su
  componente, y los de `axios`—. **Todavía no corre en CI**, así que hay que
  pasarlo a mano. Dos reglas están tocadas en `eslint.config.js` y ahí está el
  porqué: `no-restricted-imports` prohíbe el router de Expo fuera de
  `use-app-router.ts`, y `react-hooks/immutability` se apaga porque lee las
  escrituras en `sharedValue.value` de Reanimated como mutar algo inmutable

## Gotchas conocidos (no volver a perder tiempo en esto)

- **"Tratamiento" no es una sola tabla del lado Django** — lo que este
  cliente descarga como "tratamiento" es `EvaluacionTratamiento` (la
  combinación tratamiento + plantación + temporada) aplanada con `source=` en
  el serializer, no una tabla 1:1. **No hay `CLAUDE.md` en el repo de Django**:
  si necesitas el detalle, lee
  `Projects/django/altatech-api/apps/ryd/{models,serializers,views}.py`
  directamente en vez de asumir la forma interna.
- **`PRAGMA foreign_keys` es por conexión y NO persiste.** Va antes del
  early-return de `runMigrations`, nunca junto a las migraciones: si se pone
  abajo, las instalaciones que ya están en la última versión abren la DB sin
  integridad referencial y la CASCADE no corre. `journal_mode = WAL` sí
  persiste, por eso ese sí puede quedarse después del return.
- **`ON CONFLICT DO UPDATE` en `upsertPlant` es invariante, no estilo.** Con la
  FK activa, un `INSERT OR REPLACE` haría DELETE + INSERT, dispararía la CASCADE
  y borraría los tratamientos en cada sincronización. Hay un test que lo cubre.

- **En `package-lock.json` hay dos entradas puestas a mano: NO las borres.**
  `node_modules/@emnapi/core` y `node_modules/@emnapi/runtime`, en `1.11.3`.
  Son las `peerDependencies` de `@napi-rs/wasm-runtime` —el respaldo WASM del
  resolver de ESLint— y npm no las escribe al resolver en macOS, porque ahí se
  instala el binario nativo y esa rama no se evalúa. En el linux del CI sí, y
  `npm ci` se planta con `Missing: @emnapi/core@1.11.3 from lock file`. La
  versión importa: la 1.11.3 empareja con el `@emnapi/wasi-threads@1.2.3` que ya
  está en la raíz; la 1.10.0 exige la 1.2.1 y obligaría a anidar.

  **Regenerar el lockfile no lo arregla, lo empeora.** Se probó: borrarlo y
  reinstalar rellena ese hueco pero abre otro —`ajv`, `json-schema-traverse`—
  que hace fallar `npm ci` **también en macOS**, o sea que `npm install` produce
  un árbol que `npm ci` rechaza acto seguido. De paso mueve 114 versiones.

  **Las borra cualquier `npm install`**, aunque sea para añadir un paquete sin
  relación: pasó al instalar `@rn-primitives/slider` y tumbó el build de EAS
  (`npm ci` en su linux). Después de tocar dependencias, comprobar y reponerlas
  —el commit `c0aee44` tiene las entradas buenas, con sus `integrity`—.

  Para comprobar si el lockfile está sano, sin esperar al CI: recorrer
  `packages` buscando `peerDependencies` **no opcionales** —las que no están
  marcadas en `peerDependenciesMeta`— que no resuelvan subiendo por los
  `node_modules` hasta la raíz. Con el árbol de hoy tienen que salir **cero**.
  Las dos precisiones importan: sin descartar las opcionales salen 148 falsos
  positivos, y sin subir hasta la raíz salen 504. `npm ci --dry-run` en macOS
  **no vale** para esto: ahí npm ni siquiera evalúa esa rama —de hecho propone
  quitar `@emnapi/wasi-threads`—, así que pasa en verde con el hueco puesto.

- **`react-native-css-interop` va pineada exacta a lo que pida `nativewind`**,
  hoy `0.2.7`. No se puede quitar aunque `src/` no la importe nunca: el preset
  de Jest la resuelve desde la raíz (`mockNativeComponent.js`) y sin ella caen
  las 35 suites. Y si flota con `^`, npm anida una segunda copia bajo
  `nativewind/node_modules/` y Jest intenta transformar su JSX sin pasar por
  babel — "Unexpected token '<'" en todo lo que importe `icon.tsx`. Al subir
  `nativewind`, este pin va detrás.

- **`useAnimatedKeyboard` está deprecado** en reanimated 4 (lo dice el propio
  typing: "Please use react-native-keyboard-controller instead"). Usar
  `useReanimatedKeyboardAnimation`, como ya hace
  `domains/auth/hooks/use-login-animations.ts`.
- **Clases de Tailwind inexistentes fallan en SILENCIO** en NativeWind: no hay
  error de compilación ni warning, el estilo simplemente no se aplica. Ya pasó
  con un `animate-pulse-soft` que nunca existió y dejó el skeleton estático.
  Al escribir una clase custom (`animate-*`, colores del tema), verificar que
  esté en `tailwind.config.js`.
- **`tabular-nums` es de Tailwind pero no hace nada en nativo**: el mismo fallo
  silencioso con una clase que sí existe. react-native-css-interop traduce
  `font-variant-caps` pero no `font-variant-numeric`, así que se ignora sin
  avisar. Para cifras de ancho fijo, `style` con `fontVariant: ["tabular-nums"]`,
  como `styles.tabular` en `eval-brix.tsx`.
- **`ScrollView` en NativeWind**: `className` controla el propio
  ScrollView (flex, tamaño); `contentContainerClassName` controla el
  contenido interno. Confundirlos rompe layouts flex con hermanos.
- **Animar `flex`/layout con Reanimated es costoso** (fuerza re-layout de
  Yoga en cada frame, aún peor con `<Image>` dentro por el re-crop).
  Preferir `transform`/`opacity` sobre tamaño fijo.
- **Las clases `animate-*` de NativeWind disparan el warning de Reanimated**
  ("Writing to `value` during component render"): NativeWind las implementa
  sobre shared values y los escribe **durante el render**. Con un className
  constante puede pasar desapercibido; en cuanto depende de props, el warning
  es continuo. Por eso ya no queda ninguna en código nativo — usar
  `usePulseAnimation` o el patrón de `sync-button.tsx` (`useSharedValue` +
  `useEffect` + `withTiming`).
- **No superpongas Reanimated y NativeWind sobre el mismo componente.** El
  estilo animado va en un `Animated.View` **envolvente** y el `className` en el
  hijo. Envolver con `createAnimatedComponent` un componente que ya usa
  `cssInterop` hace que ambos se disputen la prop `style`: pasó con `Icon`
  —que usa `nativeStyleToProp` para derivar `size` del className— y el icono
  desaparecía al descansar en un ángulo distinto de 0. Se ve solo cuando la
  animación no termina en su valor neutro, así que puede quedar latente.
- **FlashList v2 trae `maintainVisibleContentPosition` activado por defecto**
  (lo dice su propio typing en `FlashListProps.d.ts`; es solo New Arch). Ancla
  el ítem visible y sigue su posición cuando el contenido cambia — está pensado
  para chats. En una lista que se reordena o filtra, eso hace que la lista
  **persiga al ítem anclado** hasta su nuevo índice y deje al usuario en un
  punto del scroll que no pidió. Parece un bug de caché o de reciclado y no lo
  es. `list.tsx` lo apaga con `maintainVisibleContentPosition={{ disabled: true }}`.
- **`ListHeader` renderiza sus hijos tres veces**: un medidor invisible
  (`left: -9999`, `opacity: 0`) para decidir si el contenido cabe en una línea,
  y después la rama que cabe o la del `ScrollView`. Por eso `ListFilter` y
  `ListOrderBy` son presentacionales puros: con estado interno, cada copia
  tendría el suyo y el medidor competiría con el visible. Todo hijo nuevo de
  ese header recibe su estado por props, y la copia del medidor recibe
  callbacks vacíos.
- **Testear el componente `List` (FlashList) es territorio no explorado.**
  `list.test.tsx` prueba `PlantCard` directo, nunca la lista. Si lo intentas,
  empieza por `require("@shopify/flash-list/jestSetup")` — sí existe en la
  v2.0.2 instalada y mapea `FlashList → RecyclerView` + mockea `measureLayout`.
  Si falla, documenta aquí el error real. NO sigas recetas con
  `estimatedListSize`: esa prop es de FlashList v1 y no existe en v2.
- **`useDebouncedValue`** ya existe en
  `src/domains/plants/hooks/use-debounced-value.ts` — usarlo para cualquier
  filtro de búsqueda antes de tocar SQLite/filtrado pesado.
- **Jest + paquetes ESM**: si aparece "Cannot use import statement outside a
  module", ver el skill `debug-jest-expo` y los comentarios de `jest.config.js`
  (la decisión es `moduleNameMapper` si el paquete trae build CJS,
  `transformIgnorePatterns` si no).

## Deuda conocida (no es diseño, es pendiente)

- **`sync-store.ts`** guarda `isSyncing`/`lastSyncError` en Zustand con un
  `delay(3_000)` simulado. Debe migrar al patrón de `usePlantsMutation`:
  mutation de TanStack Query para el ciclo de vida, store persistido solo para
  el timestamp. No copiar el patrón de `sync-store` en código nuevo.
- **El botón de dirección de `ListOrderBy`** todavía no emite nada: el criterio
  de orden ya funciona (`usePlantsOrder` + `sortPlants`), pero el toggle
  asc/desc y su animación están pendientes. El `ORDER BY name ASC` de
  `plants.repository.ts` dejó de ser el orden final y pasó a ser el desempate:
  `sortPlants` usa un `sort` estable, así que los empates conservan ese orden.
- **El formulario en 2 columnas al girar a horizontal está intentado y
  revertido.** `EvaluacionExteriorForm` es de una sola columna a propósito. El
  layout en sí no era el problema: se probó con dos pilas independientes y
  después con un flujo que envuelve (zigzag), y ambos se ven bien al **abrir**
  la pantalla ya en horizontal. Lo que falla es la rotación — en concreto
  volver a horizontal después de pasar por vertical: se queda en una columna y
  ya no se recupera. Descartado por lectura de código: la lógica del reparto,
  `"orientation": "default"` en `app.json` y la implementación de
  `useWindowDimensions` (sí se resuscribe). Se reescribió
  `useScreenOrientation` sobre `useSyncExternalStore` para que un evento
  perdido deje de ser permanente, y **no bastó**. Antes de reintentar el
  layout, confirmar de dónde viene el fallo instrumentando la orientación en
  el render; si `Dimensions` resulta poco fiable aquí, `expo-screen-orientation`
  ya está como plugin en `app.json` y nadie lo usa todavía.
- **`app.json`** tiene placeholders sin resolver (`"scheme": "your-app-scheme"`).
- **`src/domains/navigation/`** tiene su componente en la raíz del dominio, sin
  subcarpeta `components/`, a diferencia de `plants` y `auth`.

## Cómo trabajar conmigo en este proyecto

- **Plan antes de editar, siempre** — sin importar el tamaño del cambio.
  Enséñame qué vas a tocar y por qué antes de aplicarlo.
- Prefiero soluciones concisas y pragmáticas — señala over-engineering
  si lo ves (abstracciones prematuras, memoización innecesaria fuera de
  listas virtualizadas, etc.)
- Cuando propongas una librería/API que pueda haber cambiado
  recientemente (Reanimated, FlashList, Expo SDK), confírmalo antes de
  asumir comportamiento de memoria. Lee los typings instalados en
  `node_modules` o los docs versionados de `AGENTS.md`
- Explica el porqué de una recomendación, no solo el qué — me interesa
  entender el mecanismo (ej. por qué `flex` es costoso de animar, por
  qué `ON CONFLICT DO UPDATE` es mejor que `INSERT OR REPLACE` aquí)
- No documentes como convención algo que solo aparece una vez en el código,
  ni como existente algo que no puedas abrir y leer
