@AGENTS.md

# VitEval — Captura Experimental

App de tablet para evaluadores de campo en viñedos. Los usuarios descargan
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
  SQLite y que necesita persistir entre sesiones (ej. `lastDownloadAt`).
  Con `persist` + `AsyncStorage`. NO duplicar ahí estado que ya vive en
  TanStack Query (isPending, error, etc. vienen de la mutation/query
  directamente)
- **DB local**: expo-sqlite, migraciones vía `PRAGMA user_version`
- **Backend**: Django REST Framework + SQL Server
- **Testing**: Jest + `@testing-library/react-native`, factories en
  `src/test-utils/factories/`

## Estado actual del schema (v1) — leer antes de tocar la DB

`src/lib/db/migrations.ts` crea **una sola tabla**: `plants`
(`id, name, campo, cuadro, programa, portainjerto, anio, syncStatus`).

**NO existen todavía**: las tablas `tratamientos` y `respuestas`, ni la VIEW
`plantaciones_with_progress`. La pantalla de lista inyecta `tratamientos: []`
y `progress: 0` a mano en `src/app/(app)/index.tsx`. No escribas SELECT contra
nada que no esté en la migración v1.

## Modelo de dominio (DISEÑO OBJETIVO — NO implementado aún)

> Esta sección describe hacia dónde va el schema, no lo que existe hoy.
> Úsala para diseñar, nunca para asumir que puedes consultar estas tablas.

**Plantación** (solo lectura desde el cliente, se descarga del servidor):
`id, name, campo, cuadro, programa, portainjerto, anio, syncStatus`.
`progress` y el conteo de tratamientos NO se guardarán como columna — se leen
desde una VIEW de SQLite calculada a partir de `tratamientos`/`respuestas`,
para evitar que se desincronice.

**Tratamiento** (solo lectura desde el cliente, se descarga junto con o
como parte del pull de plantaciones, ej. "azul", "naranja", "testigo"):
es el encabezado de una encuesta — relación N:1 con plantación (varios
tratamientos por plantación). El nombre y demás metadata del tratamiento
NUNCA se editan localmente, igual que plantación.

**Respuesta** (se crea/edita localmente, es lo que se sincroniza):
cada respuesta pertenece a un tratamiento (relación directa
respuesta→tratamiento) y representa la captura progresiva de la encuesta
para ese tratamiento (solo algunos campos obligatorios al inicio, el resto
se completa con el tiempo). Tiene su propio ciclo de sync:
`sync_status` (`pending | syncing | synced | error`), `updated_at_local`,
`synced_at`. Usa UUID como PK, generable en cliente para push idempotente.

**Reglas de sync clave**:

- Pull de plantaciones/tratamientos y push de respuestas son pipelines
  **completamente separados**.
- Pull usa `updated_since` (watermark) — el cliente guarda `server_time`
  que el backend devuelve en la respuesta (`{ server_time, results }`),
  NUNCA el reloj del dispositivo, para evitar drift de reloj entre tablets.
- Al hacer upsert de `tratamientos` desde un pull, usar
  `INSERT OR IGNORE` si ya existen respuestas locales asociadas (nunca
  pisar progreso capturado). Para `plantaciones` y `tratamientos` sin
  respuestas locales sí es seguro `ON CONFLICT DO UPDATE` (solo lectura).
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

## Naming

Identificadores **técnicos en inglés** (tablas, hooks, tipos, query keys,
carpetas de dominio); **campos de negocio en español** y son intocables
(`campo`, `cuadro`, `programa`, `portainjerto`, `anio`), porque así los
nombra el backend y así los dicen los evaluadores. `plants` es la tabla y
el dominio; `["plants"]` la query key.

## Convenciones establecidas

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
- Animación custom `animate-pulse-deep` en `tailwind.config.js`
  (min opacity 0.15) para skeletons y dots de estado

## Convenciones de test

- Carpeta `__tests__` (plural) junto al código que prueba, y sufijo
  `.test.ts` / `.test.tsx` obligatorio en el archivo
- Factories en `src/test-utils/factories/`, importadas como
  `@/test-utils/factories/<x>.factory`. **El único alias que existe es `@/*`**
  (`tsconfig.json`); no hay alias `@test-utils/*`
- **Lógica pura siempre lleva test** (mappers, filtros, cálculos,
  repositorios). Componentes y hooks solo cuando se pidan explícitamente
- Preferir `getByText`/`getByRole` sobre snapshots o selección por
  className — los tests deben sobrevivir cambios visuales menores
- El CI (`.github/workflows/test.yml`) corre `npx jest --ci --coverage` y
  `npx tsc --noEmit` en cada PR a `main`. Reproducir ambos localmente antes de
  dar algo por terminado

## Gotchas conocidos (no volver a perder tiempo en esto)

- **`useAnimatedKeyboard` está deprecado** en reanimated 4 (lo dice el propio
  typing: "Please use react-native-keyboard-controller instead"). Usar
  `useReanimatedKeyboardAnimation`, como ya hace
  `domains/auth/hooks/use-login-animations.ts`.
- **Clases de Tailwind inexistentes fallan en SILENCIO** en NativeWind: no hay
  error de compilación ni warning, el estilo simplemente no se aplica. Ya pasó
  con un `animate-pulse-soft` que nunca existió y dejó el skeleton estático.
  Al escribir una clase custom (`animate-*`, colores del tema), verificar que
  esté en `tailwind.config.js`.
- **`ScrollView` en NativeWind**: `className` controla el propio
  ScrollView (flex, tamaño); `contentContainerClassName` controla el
  contenido interno. Confundirlos rompe layouts flex con hermanos.
- **Animar `flex`/layout con Reanimated es costoso** (fuerza re-layout de
  Yoga en cada frame, aún peor con `<Image>` dentro por el re-crop).
  Preferir `transform`/`opacity` sobre tamaño fijo.
- **NativeWind `animate-*` condicional por estado** puede disparar el warning
  de Reanimated ("Writing to `value` during component render"). El repo tiene
  ambos patrones vivos: `status-dot.tsx` usa clase condicional y funciona;
  `sync-button.tsx` usa Reanimated manual (`useSharedValue` + `useEffect`)
  para la rotación. Si aparece el warning, migrar ese caso a Reanimated manual.
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
  `delay(3_000)` simulado. Debe migrar al patrón de `useDownloadPlants`:
  mutation de TanStack Query para el ciclo de vida, store persistido solo para
  el timestamp. No copiar el patrón de `sync-store` en código nuevo.
- **`ListOrderBy`** es decorativo: no recibe props ni emite selección. El orden
  real es fijo (`ORDER BY name ASC` en `plants.repository.ts`).
- **Error de descarga** solo hace `console.log` (`use-download-plants.ts`); falta
  la alerta al usuario.
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
