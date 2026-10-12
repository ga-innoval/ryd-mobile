# Contrato de respuestas — tablet ⇄ backend

Qué manda la app de campo cuando el evaluador guarda una evaluación de
tratamiento, y qué se espera del lado de Django.

> **Estado: el lado tablet existe, el lado servidor no.** Las cuatro tablas
> locales —`respuestas`, `postcosecha_respuestas` y sus dos de fotografías— se
> escriben de punta a punta, y el cliente ya sabe armar estos cuerpos y
> reconciliar las respuestas. Lo que falta es entero del lado Django: no hay
> columnas de respuesta, ni serializer de escritura, ni endpoint, ni manejo de
> imágenes. Este documento es lo que hay que implementar allá.
>
> **De los cuatro endpoints de tratamiento, el cliente solo usa dos**: el
> `batch` y la subida de fotografías. El `PUT` por sección y el `DELETE` de una
> fotografía están especificados y **no se ejercitan desde la app**, así que
> nadie debe darlos por probados.

## Punto de partida del backend

En `apps/ryd/models.py:155` ya existe `RespuestaTratamiento`, pero está vacío:
tiene `tratamiento` (OneToOne contra `EvaluacionTratamiento`, con
`primary_key=True`), `evaluador`, `created_at` y `updated_at`, y un comentario
`# respuestas here` donde irían las columnas. La tabla física tiene esas cuatro
columnas y ninguna fila: se creó antes de saber cómo quedaría el formulario, así
que **es modificable sin migrar datos**.

No existe nada más: ni columnas de respuesta, ni tablas hijas, ni
`RespuestaTratamientoSerializer`, ni endpoints de escritura —`PlantacionViewSet`
es un `ReadOnlyModelViewSet` y es la única vista del módulo—, ni el campo
`encuesta_abierta`, ni manejo de imágenes en `apps/ryd/`.

## El reparto: dos almacenes con trabajos distintos

**La tablet es un buffer de captura.** Sus únicos lectores son el formulario
—que rehidrata la sección entera de golpe— y el conteo de progreso. Cero
consultas analíticas. Por eso guarda cada sección como JSON: normalizar ahí se
pagaría con una migración de SQLite por cada cambio de diseño y no compraría
ninguna consulta que la app vaya a hacer.

**El servidor es el almacén analítico.** De ahí salen los reportes y los
dashboards, y esas preguntas —distribución de calibres por portainjerto,
rendimiento promedio por programa— son `GROUP BY` sobre filas. Por eso el
servidor **desempaqueta el payload en tablas normalizadas** y no lo guarda como
llegó.

Las dos formas difieren a propósito. Lo que las une es este contrato, no una
réplica de tablas.

## Identidad e idempotencia

Una respuesta se identifica por **`(evaluacion_tratamiento_id, seccion)`**. Las
dos partes existen en los dos lados antes del primer envío —el id del
tratamiento llega en el pull—, así que no hace falta generar ningún UUID y un
reenvío no puede duplicar nada, ni aunque la fila local se haya recreado.

Las seis secciones son las claves del formulario (`EvaluationSectionId` en
`src/domains/plants/lib/evaluation-schema.ts`):

`exterior` · `interior` · `brix` · `criba` · `rendimiento` · `comentarios`

Las fotografías son una sección en pantalla pero **no viajan por aquí**: son
archivos y tienen su propio endpoint.

## Endpoints

```
PUT    /api/ryd/evaluaciones/{evaluacion_id}/respuesta/{seccion}/
POST   /api/ryd/respuestas/batch/
POST   /api/ryd/evaluaciones/{evaluacion_id}/respuesta/fotografias/   (multipart)
DELETE /api/ryd/evaluaciones/{evaluacion_id}/respuesta/fotografias/{client_id}/
```

Cuerpo del `PUT`:

```json
{
  "capturado_en": "2026-09-24T14:03:00-07:00",
  "payload": {}
}
```

`capturado_en` es la hora **local de la tablet** en la que se guardó, con
offset. No sustituye a `updated_at` del servidor: sirve para saber cuándo se
capturó en campo, que puede ser días antes de que haya señal para sincronizar.

El `batch` es el mismo contenido en lote, que es como sincroniza la app al
volver del campo:

```json
{
  "respuestas": [
    {
      "evaluacion_id": "…",
      "seccion": "criba",
      "capturado_en": "…",
      "payload": {}
    },
    {
      "evaluacion_id": "…",
      "seccion": "brix",
      "capturado_en": "…",
      "payload": {}
    }
  ]
}
```

Y **devuelve un resultado por registro, nunca todo-o-nada**: un rechazo no puede
arrastrar al resto del lote.

```json
{
  "results": [
    { "evaluacion_id": "…", "seccion": "criba", "status": "ok" },
    {
      "evaluacion_id": "…",
      "seccion": "brix",
      "status": "error",
      "code": "encuesta_cerrada"
    }
  ]
}
```

## Reglas de escritura

1. **El ancla se crea al primer envío.** `RespuestaTratamiento` sale de un
   `get_or_create` sobre la evaluación, con `evaluador` = usuario autenticado.
   No hay un paso previo de "abrir la respuesta".

2. **Reemplazo dentro del alcance de la sección.** Un `PUT` de `criba` reescribe
   las nueve filas de criba y no toca Brix. El payload es el estado completo de
   esa sección, así que **no se mezcla**: si se mezclara, "descarté el corte 3"
   sería inexpresable y el corte borrado en la tablet viviría para siempre en el
   reporte.

3. **`null` no es `0`.** Es la regla que atraviesa todo el formulario: un dato en
   `null` no se capturó y no entra en ninguna cuenta; un `0` se midió y vale
   cero —un calibre pesado sin fruta, un corte de 0 kg—. Coalescer `null` a `0`
   al guardar corrompería todos los promedios del reporte.

4. **El servidor no rechaza por contenido.** Valida forma (tipos, secciones
   conocidas) y guarda. Los rechazos se reservan para encuesta cerrada,
   tratamiento inactivo, autenticación y JSON malformado. El motivo es de campo:
   un rechazo por contenido deja el dato encerrado en la tablet y al evaluador
   sin forma de arreglarlo desde el viñedo.

5. **Guardar el payload crudo.** Una columna `payload_raw` (texto) con lo que
   llegó, tal cual, además de las columnas desempaquetadas. Es lo que hace segura
   la regla anterior: una pregunta que la app ya manda y el servidor todavía no
   tiene columna para ella no se pierde —se ignora al desempaquetar y se
   reprocesa cuando exista—. También salva el día que el desempaquetado tenga un
   bug, sin pedirle al evaluador que vuelva al viñedo.

## El payload de cada sección

### `exterior` · `interior`

Selección única por pregunta. La clave es el `id` de la pregunta y el valor es
el `value` de la opción —un slug, nunca la etiqueta visible: traducir un texto no
puede invalidar lo ya capturado—. Una pregunta sin contestar va en `null`.

```json
{
  "susceptibilidad_quemaduras_sol": "high",
  "forma_racimo": "conical",
  "densidad_racimo": null
}
```

Los catálogos completos están en `src/domains/plants/lib/evals-exterior.ts`
(16 preguntas) y `evals-interior.ts` (10). Los `id` son únicos entre las dos
secciones. Estos son los slugs que hay que confirmar contra lo que el negocio
espera ver en el reporte, porque hoy solo existen del lado de la app.

### `brix`

Diez lecturas de refractómetro por corte, en cinco pares. El array trae siempre
diez posiciones y la posición importa: `null` es una lectura que falta.

```json
{
  "cortes": [
    {
      "numero": 1,
      "lecturas": [14.5, 14.2, 15.1, 14.9, null, null, null, null, null, null]
    }
  ]
}
```

Unidad: grados Brix. Sin tope de cortes. `numero` es consecutivo desde 1.

**Los promedios no viajan.** R1–R5 son la media de cada par y el promedio del
corte es la media de los R capturados; se calculan al leer, no se guardan. Un
par incompleto no tiene R y no entra en ningún promedio — tomarlo como cero
hundiría la cifra sin que nadie lo notara.

### `criba`

Los nueve calibres siempre, del 8 al 16, capturados o no, más los calibres
grandes que se hayan agregado.

```json
{
  "calibres": [
    { "calibre": 8, "peso_total": 350.5, "peso_promedio": 6.2 },
    { "calibre": 9, "peso_total": 0, "peso_promedio": null },
    { "calibre": 10, "peso_total": null, "peso_promedio": null }
  ]
}
```

Unidad: **gramos**, los dos pesos. El calibre 9 del ejemplo se pesó y no tenía
fruta —por eso no hay promedio: no hay bayas que pesar—; el 10 no se capturó.

**`calibre` es el numerador sobre dieciseisavos**, que es la escala real de la
criba: los nueve de siempre son 8/16 a 16/16 y viajan como 8..16. Es la misma
lectura que la tablet enseña en su columna, que pinta el 8 como «8/16».

**Y por eso los tres calibres grandes caben en el mismo entero.** La app permite
agregar hasta tres (`CRIBA_EXTRA_CALIBRES`), y están en la misma escala pasando
de la unidad: **1 1/8 es 18/16, 1 1/4 es 20/16 y 1 1/2 es 24/16**. Así que viajan
en el mismo array, como 18, 20 y 24. No hace falta una segunda lista ni cambiar
el entero por texto, el `GROUP BY` del reporte sigue ordenando bien, y el día que
el negocio agregue otro calibre es otro numerador y ninguna migración.

Son hasta doce posiciones, entonces, no nueve. **Y los tres grandes tienen que
viajar**: suman al peso de la muestra, y como ese peso se **deriva** de los
calibres recibidos, dejarlos fuera haría que el dashboard diera un peso distinto
al de la tablet sin que nada avisara.

**El peso de la muestra no viaja**: es la suma de los pesos totales, y la
distribución de cada calibre es su parte de esa suma. Derivarlo en el reporte
evita que un día discrepe de sus insumos.

### `rendimiento`

Un corte por cosecha. Los cortes ocurren en fechas distintas, así que esta
sección se reenvía a lo largo de semanas.

```json
{
  "cortes": [
    { "numero": 1, "fecha": "2026-08-12", "kilogramos": 120.5, "racimos": 240 },
    { "numero": 2, "fecha": null, "kilogramos": null, "racimos": null }
  ]
}
```

`fecha` en ISO `YYYY-MM-DD`, sin hora ni zona: es el día del corte, no un
instante. `kilogramos` en **kilogramos** (decimal); `racimos` es un conteo
entero. Sin tope de cortes. El promedio por racimo se deriva al leer.

### `comentarios`

```json
{
  "positivos": "Buena uniformidad de color.",
  "negativos": "",
  "observaciones": ""
}
```

Texto libre, las tres siempre presentes. Cadena vacía = se escribió y se borró;
que la sección no se haya enviado nunca es lo que significa "sin capturar".

## Fotografías

Una petición **multipart por archivo**, no un array: cada foto tiene su propio
ciclo de subida y una que falle no puede bloquear a las demás ni al texto.

```
POST /api/ryd/evaluaciones/{evaluacion_id}/respuesta/fotografias/
  categoria: racimo | corte-vertical | corte-horizontal
  client_id: <uuid generado en la tablet>
  imagen:    <archivo>
```

Aquí sí hace falta un UUID de cliente: un archivo no tiene llave natural, y es
lo que hace idempotente un reintento a media subida —mismo `client_id`, misma
fila, sin duplicar—. Debe ser `unique` en el modelo.

Borrar una fotografía que ya se subió es el `DELETE` por `client_id`. Sin él,
una foto que el evaluador quitó de la tablet seguiría en el reporte.

Las categorías son el catálogo de `src/domains/plants/lib/photo-categories.ts`,
y su `id` es parte del contrato: cambiarlo no es un cambio de texto.

**HEIC: resuelto, y convierte el cliente.** El servidor valida con
`serializers.ImageField()`, o sea con Pillow, que no trae HEIC registrado: un
`.heic` da **400**. Y como 400 no es un código terminal, esa fotografía se
reintentaría en cada envío para siempre. Así que el cliente **convierte antes de
subir**, y conserva la extensión original solo para saber cuándo hace falta.

**Encuesta cerrada en la subida: 409 con `{"code": "encuesta_cerrada"}`.** No
estaba en este contrato —solo definía `code` para el `batch`— y el servidor lo
añadió para que el cliente pueda marcar la fotografía terminal igual que marca
una sección. **Aceptado**: es lo que hace falta, y el alternativo —un 400
genérico— la dejaría reintentándose sin fin.

## Lo que el servidor guarda

El ancla ya existe; alrededor, una tabla hija por cada cosa que se repite.

```python
class RespuestaTratamiento(models.Model):   # ya existe, 1:1 con EvaluacionTratamiento
    # exterior/interior: una columna por pregunta, null=True
    # comentarios: positivos / negativos / observaciones
    # capturado_en por sección, si se quiere saber cuándo se capturó cada una
    payload_raw = models.TextField(null=True)

class RespuestaCribaCalibre(models.Model):      # 9 a 12 filas por respuesta
    respuesta = FK(RespuestaTratamiento, related_name="calibres", on_delete=CASCADE)
    calibre = IntegerField()                    # dieciseisavos: 8..16, y 18/20/24
    peso_total = DecimalField(null=True)        # gramos
    peso_promedio = DecimalField(null=True)     # gramos
    # UniqueConstraint(respuesta, calibre)

class RespuestaBrixCorte(models.Model):         # N filas
    respuesta = FK(..., related_name="brix_cortes", on_delete=CASCADE)
    numero = IntegerField()
    l1 … l10 = DecimalField(null=True)          # diez fijas por regla de negocio
    # UniqueConstraint(respuesta, numero)

class RespuestaRendimientoCorte(models.Model):  # N filas
    respuesta = FK(..., related_name="rendimiento_cortes", on_delete=CASCADE)
    numero = IntegerField()
    fecha = DateField(null=True)
    kilogramos = DecimalField(null=True)
    racimos = IntegerField(null=True)
    # UniqueConstraint(respuesta, numero)

class RespuestaFoto(models.Model):
    respuesta = FK(..., related_name="fotos", on_delete=CASCADE)
    categoria = CharField(choices=…)
    imagen = ImageField(…)
    client_id = UUIDField(unique=True)
```

Cuatro reglas de modelado que se agradecen después:

- **`DecimalField`, no `FloatField`.** Son pesos y lecturas que los reportes
  suman por miles de filas; el binario acumula error y el número del dashboard
  deja de cuadrar con el de la tablet.
- **Los derivados no se guardan**: R1–R5, el promedio del corte, el peso de la
  muestra, la distribución por calibre y el promedio por racimo se calculan en
  la consulta o en una vista. Guardarlos es garantizar que un día discrepen de
  sus insumos.
- **Columnas de pregunta siempre `null=True, blank=True`**, por la convención
  del repo de Django: corre sobre SQL Server, donde agregar una columna
  `NOT NULL` sin default a una tabla con filas existentes falla.
- **`on_delete=CASCADE` en las hijas**, aunque el ancla cuelgue de la evaluación
  con `PROTECT`: borrar una respuesta debe llevarse sus calibres y sus cortes,
  no dejarlos huérfanos.

## Post-cosecha

La otra encuesta, y **deliberadamente aparte** por lo mismo que en la tablet: lo
que comparte con tratamiento son las reglas, no las tablas.

### Identidad

**`(plantacion_id, eval_id, seccion)`**, de tres partes y no de dos. El dueño no
es un tratamiento: es la plantación más cuál de las cuatro evaluaciones del
catálogo del negocio. Las tres partes existen en los dos lados antes del primer
envío —`plantacion_id` llega en el pull y las otras dos son catálogos fijos—, así
que tampoco hace falta UUID y un reenvío no puede duplicar.

- `eval_id` ∈ `15caja` · `15plastico` · `30caja` · `30plastico`. Es
  `EVALS_POST_COSECHA` (`src/domains/plants/lib/evals-post-cosecha.ts`): 15 y 30
  días × caja y liner. **Catálogo fijo del negocio, idéntico para toda
  plantación**, así que no se parametriza ni se mueve al servidor, y el
  denominador del avance siempre es 4.
- `seccion` ∈ `fruta` · `comentarios`. Las fotografías son una sección en
  pantalla pero no viajan por aquí.

### Endpoints

```
PUT    /api/ryd/plantaciones/{plantacion_id}/postcosecha/{eval_id}/respuesta/{seccion}/
POST   /api/ryd/postcosecha/respuestas/batch/
POST   /api/ryd/plantaciones/{plantacion_id}/postcosecha/{eval_id}/fotografias/   (multipart)
DELETE /api/ryd/plantaciones/{plantacion_id}/postcosecha/{eval_id}/fotografias/{client_id}/
```

Mismo cuerpo `{ capturado_en, payload }`, mismo `results` por registro y nunca
todo-o-nada, y las **cinco reglas de escritura de arriba valen enteras**: el
ancla se crea al primer envío, se reemplaza dentro del alcance de la sección,
`null` no es `0`, el servidor no rechaza por contenido, y se guarda el
`payload_raw`.

El lote lleva la llave de tres partes, y el cliente **solo usa este**:

```json
{
  "respuestas": [
    {
      "plantacion_id": "…",
      "eval_id": "15caja",
      "seccion": "fruta",
      "capturado_en": "…",
      "payload": {}
    }
  ]
}
```

La fotografía va igual que en tratamiento —una petición multipart por archivo,
con su `client_id` de cliente como llave de idempotencia—, con una sola
`categoria`: `racimos`
(`src/domains/plants/lib/postcosecha-photo-categories.ts`).

### El payload de `fruta`

```json
{
  "fecha_empaque": "2026-08-12",
  "fecha_evaluacion": "2026-08-27",
  "acidez": "medium",
  "tallo": 4,
  "peso_inicial": 8002.5,
  "peso_final": 7890,
  "peso_bayas_reventadas": 120.4,
  "peso_desgrane": 35,
  "dano_azufre": "zero",
  "manchas_cafes": null,
  "calidad_consumo": 5,
  "sabor": 4
}
```

Doce campos, los nombres tal como los dice la hoja de empaque:

- **Las dos fechas** en ISO `YYYY-MM-DD`, sin hora ni zona, o `null`. La de
  empaque es cuando la caja entró al cuarto frío; la de evaluación, cuando se
  abrió.
- **Los cuatro pesos en gramos**, decimales, o `null`. En el orden en que se
  pesan: la caja entera al entrar (`peso_inicial`) y al salir (`peso_final`), y
  después lo que se separa de ella.
- **Cuatro niveles** (`acidez`, `dano_azufre`, `manchas_cafes` y el resto de su
  familia) por el `value` del catálogo —un slug, nunca la etiqueta visible—:
  `zero` · `low` · `medium` · `high`, o `null`.
- **Tres escalas** (`tallo`, `calidad_consumo`, `sabor`) como entero de 1 a 5, o
  `null`.

**Los tres porcentajes no viajan.** Deshidratación, bayas reventadas y desgrane
**no se capturan, se calculan** desde los cuatro pesos: la deshidratación es
`(inicial − final) ÷ inicial`, y los otros dos son la parte que les toca del peso
final. Es el mismo caso que el peso de la muestra de Criba y que los R de Brix, y
se resuelve igual: derivarlos al consultar evita que un día discrepen de sus
insumos.

`comentarios` es idéntico al de tratamiento: las tres notas, siempre presentes.

### Qué guarda el servidor

Un ancla por `(plantacion, eval_id)` y las doce columnas de `fruta`, con las
mismas cuatro reglas de modelado: `DecimalField` en los pesos, derivados no
guardados, columnas de pregunta `null=True, blank=True`, y `CASCADE` en las
hijas.

```python
class RespuestaPostcosecha(models.Model):
    plantacion = FK(Plantacion, related_name="postcosecha", on_delete=PROTECT)
    eval_id = CharField(choices=…)              # 15caja | 15plastico | 30caja | 30plastico
    evaluador = FK(...)
    # las dos fechas, los cuatro pesos (DecimalField), los cuatro niveles
    # (CharField) y las tres escalas (IntegerField), todas null=True
    # comentarios: positivos / negativos / observaciones
    payload_raw = models.TextField(null=True)
    # UniqueConstraint(plantacion, eval_id)

class RespuestaPostcosechaFoto(models.Model):
    respuesta = FK(..., related_name="fotos", on_delete=CASCADE)
    categoria = CharField(choices=…)            # racimos
    imagen = ImageField(…)
    client_id = UUIDField(unique=True)
```

**`eval_id` sin tabla de catálogo**, como en la tablet: son cuatro valores que el
negocio no cambia, y una tabla para ellos solo añade un `JOIN` a cada reporte.

## Preguntas abiertas

- **Los slugs de exterior e interior** solo existen hoy del lado de la app.
  Confirmar que son los que el negocio espera en el reporte antes de crear las
  columnas.
- **`encuesta_abierta` no existe.** Hay que decidir de qué campo de `Plantacion`
  depende que una encuesta esté cerrada, y devolver ese rechazo con un `code`
  distinguible (`encuesta_cerrada`), no como error genérico.
- **`evaluador`** sale del usuario autenticado en el momento del push. Si una
  tablet se comparte entre evaluadores y una captura puede sobrevivir al cierre
  de sesión, hay que sellarlo en la tablet y mandarlo en el payload.
- **Qué cuenta como sección completa** para el progreso sigue sin definir —Brix
  no tiene un número fijo de cortes—, y de eso depende el `progress` que la app
  muestra en el listado.
- **Borrar lo que ya se subió no deja rastro.** Limpiar un tratamiento o una
  evaluación en la tablet borra sus filas, así que si ya se habían sincronizado,
  el servidor se queda con ellas y el reporte las sigue contando. Lo mismo con
  una fotografía: el `DELETE` por `client_id` existe aquí, pero borrar la fila
  local pierde el id que había que mandar. Hace falta una lápida y todavía no
  está decidido dónde vive.
- **`status: "error"` sin `code` está sobrecargado, y un caso no se arregla
  nunca.** El servidor lo devuelve para tres cosas distintas: un registro con
  forma inválida, un dueño fuera de alcance y un fallo inesperado al guardar. Los
  dos últimos pueden dejar de pasar —un pull trae el dueño, el fallo era
  transitorio—, pero el primero no: ese registro se reintentaría en cada envío
  para siempre. Los dos lados ya lo saben (`unpack.py` lo dice de los `numero`
  repetidos). No debería ocurrir, porque el payload lo genera el cliente; la
  salida, el día que ocurra, es un código terminal propio o un tope de
  reintentos.
- **Los códigos de rechazo son una lista cerrada, y hoy tiene un elemento.** El
  cliente solo saca una fila de la cola si el `code` está en su lista de
  terminales (hoy `encuesta_cerrada`); cualquier otro código, y cualquier
  `status: "error"` sin código, lo reintenta. Así un código nuevo del servidor no
  puede enterrar una captura en un estado del que nadie la saca — pero significa
  que **añadir un rechazo terminal es un cambio en los dos lados**, no solo en
  Django.

## Apéndice: un servidor de mentira para probar

El camino de éxito no se puede probar sin algo que conteste. Esto es lo más
barato que sirve, y de paso es la especificación ejecutable que los dos lados
pueden mirar: sin dependencias, con `node:http`, y apuntando
`EXPO_PUBLIC_API_URL` a él.

```js
// scripts/push-stub.mjs — node scripts/push-stub.mjs
import { createServer } from "node:http";

const leer = (req) =>
  new Promise((ok) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => ok(raw));
  });

createServer(async (req, res) => {
  const body = await leer(req);
  console.log(req.method, req.url, body.slice(0, 400));
  res.setHeader("Content-Type", "application/json");

  // Las fotografías son multipart y contestan vacío.
  if (req.url.includes("/fotografias/")) return res.end("{}");

  const { respuestas = [] } = body.startsWith("{") ? JSON.parse(body) : {};

  res.end(
    JSON.stringify({
      results: respuestas.map((r) => ({
        ...(r.evaluacion_id ? { evaluacion_id: r.evaluacion_id } : {}),
        ...(r.plantacion_id
          ? { plantacion_id: r.plantacion_id, eval_id: r.eval_id }
          : {}),
        seccion: r.seccion,
        // Una sección contesta rechazo a propósito: es la única forma de ver
        // ese estado en pantalla antes de que Django exista.
        ...(r.seccion === "comentarios"
          ? { status: "error", code: "encuesta_cerrada" }
          : { status: "ok" }),
      })),
    }),
  );
}).listen(8000, () => console.log("stub en http://localhost:8000"));
```

Lo que **no** hay que hacer es un modo falso dentro de la app. Eso es otra vez el
`delay(3_000)` de `sync-store.ts`, y es código que miente y que acaba enviándose.
