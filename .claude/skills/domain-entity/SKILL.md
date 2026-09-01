---
name: domain-entity
description: Agrega una entidad de dominio que se descarga del servidor y vive en SQLite (migración → repositorio → mapper → hook de query/mutation → test). Úsalo al implementar tratamientos, respuestas, o cualquier tabla nueva que se sincronice con el backend.
---

# Entidad de dominio nueva (SQLite + pull del servidor)

La cadena completa, en orden. Cada paso tiene un precedente real en el repo:
ábrelo y cópiale la forma en vez de inventar una nueva.

Antes de empezar, confirma si la entidad es **solo lectura desde el cliente**
(plantaciones, tratamientos) o **se captura localmente y se sincroniza**
(respuestas). Cambia las reglas de upsert, que es donde se pierden datos.

## 1. Migración — `src/lib/db/migrations.ts`

Una migración es un bloque `if (currentVersion === N)` que sube
`currentVersion` al final; `DATABASE_VERSION` se incrementa arriba. El
archivo ya tiene el hueco comentado para la siguiente.

- **Nunca edites una migración ya publicada.** Las tablets en campo ya
  corrieron la v1; cambiarla no re-ejecuta nada y deja schemas divergentes.
  Siempre suma una migración nueva.
- Nombres de tabla y columna técnicas en inglés; campos de negocio en español
  (`campo`, `cuadro`, `programa`, `portainjerto`, `anio`).
- Índices para las columnas por las que vas a filtrar/ordenar (`plantId` en
  una tabla hija, por ejemplo). SQLite no los crea solo.

## 2. Repositorio — `domains/<dominio>/lib/db/<entidad>.repository.ts`

Precedente: `domains/plants/lib/db/plants.repository.ts`.

Funciones sueltas exportadas que reciben `db: SQLiteDatabase` como primer
parámetro. Sin clases, sin singleton: el `db` viene de `useSQLiteContext()` y
así el repositorio queda testeable con una DB en memoria.

**La decisión de upsert es la parte cara de equivocarse:**

- **Entidad de solo lectura sin respuestas locales asociadas** (plantaciones,
  tratamientos nuevos) → `ON CONFLICT(id) DO UPDATE SET ...`. Preferible a
  `INSERT OR REPLACE` porque REPLACE hace DELETE + INSERT: dispara
  `ON DELETE CASCADE` en las tablas hijas y te borra respuestas capturadas,
  además de perder los valores de las columnas que no listaste.
- **Entidad que ya puede tener respuestas locales** → `INSERT OR IGNORE`.
  Nunca pises progreso capturado en campo con datos del servidor.

Batch siempre dentro de `db.withTransactionAsync()`: N inserts sueltos en
SQLite son N fsyncs, y en tablet se nota.

## 3. Mapper puro — `domains/<dominio>/lib/map-remote-<entidad>.ts`

Precedente: `map-remote-plant.ts`.

El shape remoto (`api/types.ts`) casi nunca coincide con el local: el backend
anida (`variedad.programa.name`) y el cliente aplana. Ese aplanado va en una
función pura, fuera de React.

**Lleva test siempre** (`lib/__tests__/map-remote-<entidad>.test.ts`), sin
renderizar nada: solo input remoto → output local. Es la regla del repo para
toda lógica pura.

## 4. API — `domains/<dominio>/api/<entidad>.api.ts`

Precedente: `plants.api.ts`. Una función por endpoint, con `apiClient`
(que ya inyecta el Bearer y maneja el refresh 401 con cola).

El pull incremental usa `updated_since`, y el watermark sale del
**`server_time` que devuelve el backend**, nunca de `Date.now()`: las tablets
tienen drift de reloj entre sí y con el servidor, y perderías registros.

## 5. Hook — `domains/<dominio>/hooks/use-<entidad>.ts`

Precedentes: `use-plants.ts` (query) y `use-download-plants.ts` (mutation).

- Exporta la query key como constante (`PLANTS_QUERY_KEY`). Nunca un literal
  suelto: se desincroniza y la invalidación deja de funcionar sin dar error.
- Lectura → `useQuery` con `queryFn` que llama al repositorio.
- Pull → `useMutation` cuyo `mutationFn` hace request + mapper + upsert batch,
  y en `onSuccess` invalida la query y guarda el watermark.
- **El estado del ciclo de vida (`isPending`, `isError`, `error`) sale de la
  mutation.** Zustand es solo para lo que debe sobrevivir a la sesión y no vive
  en SQLite — el timestamp, y poco más. `sync-store.ts` viola esto y es deuda
  conocida: no lo tomes como modelo.
- Al llamar `mutate`, las callbacks por invocación van en el **segundo**
  argumento: `mutate(undefined, { onSuccess, onError })`. En el primero se
  vuelven `variables` y nunca corren.

## 6. Verificación

```bash
npx jest --ci && npx tsc --noEmit
```

Y en dispositivo: la migración solo corre una vez por instalación. Para
probarla de nuevo hay que desinstalar la app del simulador o borrar el
archivo `.db` — si "no pasó nada", casi siempre es que `user_version` ya
estaba arriba.
