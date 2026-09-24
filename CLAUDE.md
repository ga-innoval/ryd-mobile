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

## Estado actual del schema (v2) — leer antes de tocar la DB

`src/lib/db/migrations.ts` crea **dos tablas**:

- `plants` (`id, name, campo, cuadro, programa, portainjerto, anio, syncStatus`)
- `tratamientos` (`id, plantId, name, description, temporada, isActive`), con
  `FOREIGN KEY (plantId) REFERENCES plants(id) ON DELETE CASCADE` e índice en
  `plantId`

**NO existen todavía**: la tabla `respuestas` ni la VIEW
`plantaciones_with_progress`. `src/app/(app)/index.tsx` sigue inyectando
`progress: 0` a mano (los tratamientos ya salen del repositorio). No escribas
SELECT contra nada que no esté en la migración v2.

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
Usa UUID como PK, generable en cliente para push idempotente.

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
- El admin puede cerrar una encuesta (`encuesta_abierta`/`is_active` a
  nivel plantación) — el push de respuestas debe manejar el rechazo como
  un estado distinguible (`rejected_closed`), no como error genérico.
- Batch push/pull debe devolver resultado granular por registro, no
  todo-o-nada.

## Reglas de negocio

- **`progress`** = 50% bloque tratamientos + 50% bloque post-cosecha.
  Cada bloque se prorratea internamente por sus propias unidades:
  3 tratamientos con 1 completo → `(1/3) × 50% = 16.6%`. Una plantación con
  su único tratamiento completo y toda la post-cosecha pendiente va en 50%.
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
  - **Dos avisos que no bloquean**, igual que el rango de Brix —el esquema es lo
    que impedirá guardar y ninguno de los dos entra en él—: el promedio mayor
    que el peso total del calibre, que es imposible, y el promedio más bajo que
    el del calibre capturado anterior, que es incoherente porque la criba separa
    por tamaño y la baya de un calibre pesa más que la de uno más pequeño. La
    cadena del segundo salta los calibres sin promedio: uno sin capturar, o con
    0 g, no rompe la secuencia ni sirve de referencia.
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
  - **Kilogramos sin racimos se avisa, no se promedia**: lo que falta es el
    conteo, y la división por cero no es la respuesta.
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
- **Los filtros "Sin iniciar" e "Iniciadas" no funcionan.** Ambos miran
  `progress`, que sigue hardcodeado a `0` en `index.tsx`: uno hace match con
  todo y el otro con nada, hasta que exista `respuestas`.
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
