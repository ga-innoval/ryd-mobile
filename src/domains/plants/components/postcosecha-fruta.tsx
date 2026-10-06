import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useController, useWatch } from "react-hook-form";
import {
  ArrowRightIcon,
  CircleAlertIcon,
  GrapeIcon,
  TriangleAlertIcon,
} from "lucide-react-native";
import {
  CollapsibleBody,
  CollapsibleHeader,
} from "@/components/collapsible-section";
import { DateField } from "@/components/ui/date-field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OptionPicker, type PickerOption } from "@/components/ui/option-picker";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatISODate } from "@/lib/dates";
import type { PostcosechaFormValues } from "../lib/postcosecha-schema";
import {
  evaluacionAntesDelEmpaque,
  evaluacionFueraDePeriodo,
  formatResultado,
  sanitizePesoInput,
  summarizeFrutaPesos,
  type FrutaPesosSummary,
  fechaEsperada,
  frutaAnswered,
  FRUTA_TOTAL_PREGUNTAS,
  NIVEL_FEMENINO,
  NIVEL_FEMENINO_PLURAL,
  NIVEL_MASCULINO,
  periodoDias,
  type FrutaValues,
} from "../lib/postcosecha-fruta";

const styles = StyleSheet.create({
  // Cifras de ancho fijo, para que los cuatro pesos queden en columna. En
  // `style` y no como clase: react-native-css-interop no traduce
  // `font-variant-numeric`, así que `tabular-nums` fallaría en silencio.
  tabular: { fontVariant: ["tabular-nums"] },
});

/**
 * Los cinco grados, como opciones.
 *
 * `OptionPicker` trabaja con `string` —se apoya en `toggle-group`, y ahí el
 * valor seleccionado es texto—, pero **lo que se guarda sigue siendo número**:
 * la conversión vive en `EscalaPicker` y no sale de este archivo. Guardar "4" en
 * vez de 4 obligaría al servidor a parsear una escala que ya es numérica.
 */
const ESCALA_OPTIONS: PickerOption<string>[] = [1, 2, 3, 4, 5].map((grado) => ({
  label: String(grado),
  value: String(grado),
}));

/**
 * Una de las tres escalas de 1 a 5.
 *
 * Existe para que la conversión número↔texto se escriba una vez y no tres, y
 * para que la nota de los extremos vaya pegada al control: es lo único que dice
 * hacia dónde crece la escala, y hoy además es el recordatorio de que el negocio
 * no ha definido qué significan (ver el TODO de arriba).
 */
function EscalaPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <View className="gap-2">
      <OptionPicker
        label={label}
        options={ESCALA_OPTIONS}
        // Cinco dígitos no necesitan un cuarto de fila cada uno, y además en
        // `extended` el quinto se iría a la línea de abajo.
        variant="compressed"
        value={value === undefined ? undefined : String(value)}
        onChange={(next) =>
          onChange(next === undefined ? undefined : Number(next))
        }
      />
    </View>
  );
}

/**
 * Un peso en gramos.
 *
 * Mismo control que los de Criba —es el mismo dato capturado a mano—: teclado
 * decimal, la máscara que solo deja dígitos y un separador, alineado a la
 * derecha y con cifras de ancho fijo para que los cuatro queden en columna. La
 * «g» va dentro del campo, superpuesta, que es como la pinta el artboard.
 *
 * **El error marca el campo**, no solo el texto de abajo: un mensaje sin saber
 * cuál de los cuatro pesos mira obliga a releerlos todos.
 */
function PesoField({
  label,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="flex-1 gap-2">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text variant="muted">{label}</Text>
        {!!hint && (
          <Text className="text-[13px] text-muted-foreground">{hint}</Text>
        )}
      </View>

      <View className="relative justify-center">
        <Input
          value={value}
          onChangeText={(text) => onChange(sanitizePesoInput(text))}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="0"
          aria-label={label}
          keyboardType="decimal-pad"
          // Corregir un peso es reescribirlo entero, no editar un dígito.
          selectTextOnFocus
          variant={error ? "destructive" : "default"}
          className={cn(
            "pr-8 text-right text-lg font-medium leading-6",
            isFocused && !error && "border-primary",
          )}
          style={styles.tabular}
        />
        <Text className="absolute right-3 text-[13px] text-muted-foreground">
          g
        </Text>
      </View>

      {!!error && (
        <View className="flex-row items-start gap-1.5">
          <Icon
            as={TriangleAlertIcon}
            size={14}
            className="mt-0.5 text-destructive"
          />
          <Text className="flex-1 text-[13px] font-medium text-destructive">
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Los tres resultados.
 *
 * **No son campos**: salen de los cuatro pesos y no se guardan, igual que el
 * peso de la muestra y la distribución de Criba.
 *
 * Y se enseñan **con el mismo lenguaje que los R1–R5 de Brix**: el resultado
 * vive en una píldora oscura y el campo que se teclea es claro, así que de un
 * vistazo se distingue lo que escribió el evaluador de lo que sacó la app. Sin
 * poder calcular, la píldora se apaga y enseña «—», igual que un par de lecturas
 * incompleto.
 *
 * Cada uno lleva su leyenda, que es la que explica por qué falta cuando falta:
 * una raya sin motivo deja al evaluador buscando cuál de los cuatro pesos es.
 */
function FrutaResultados({ pesos }: { pesos: FrutaPesosSummary }) {
  const resultados = [
    { label: "Deshidratación", ...pesos.deshidratacion },
    { label: "Bayas reventadas", ...pesos.bayasReventadas },
    { label: "Desgrane", ...pesos.desgrane },
  ];

  return (
    <View
      role="group"
      aria-label="Porcentajes calculados"
      className="flex-row items-start gap-2"
    >
      {resultados.map((resultado) => (
        <View key={resultado.label} className="flex-1 gap-2">
          <Text className="text-[13px] font-semibold text-muted-foreground">
            {resultado.label}
          </Text>

          <View
            className={cn(
              "h-10 flex-row items-center justify-center gap-1.5 rounded-lg",
              resultado.value === null ? "bg-background" : "bg-foreground/90",
            )}
          >
            <Text
              className={cn(
                "text-lg font-bold text-white",
                resultado.value === null && "text-muted-foreground",
              )}
              style={styles.tabular}
            >
              {formatResultado(resultado.value)}
            </Text>
            {resultado.value !== null && (
              <Text className="text-sm font-semibold text-white/70">%</Text>
            )}
          </View>

          <Text className="text-[13px] text-muted-foreground -mt-0.5 mb-2">
            {resultado.caption}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Lo que la cabecera de la sección enseña en su hueco de resumen. */
export function PostcosechaFrutaHeaderSummary() {
  const values = useWatch<PostcosechaFormValues, "fruta">({ name: "fruta" });

  return (
    <Text variant="muted">
      {`${frutaAnswered(values)} de ${FRUTA_TOTAL_PREGUNTAS} preguntas`}
    </Text>
  );
}

/**
 * La sección «Evaluación fruta» de post-cosecha: once preguntas y cuatro formas
 * de capturar —fecha, píldoras, estrellas y porcentaje—.
 *
 * Lee y escribe del formulario de la pantalla, que es quien lo vuelca desde
 * SQLite y quien lo guarda.
 */
export function PostcosechaFrutaForm({
  evalId,
}: {
  /** Cuál de las cuatro: de ahí salen los días que se suman al empaque. */
  evalId: string;
}) {
  // Un solo controlador para las once y no uno por campo: aquí no se teclea
  // nada —son fechas, píldoras, estrellas y barras—, así que repintar la
  // sección al cambiar una no le cuesta nada a nadie. En comentarios sí van por
  // campo, porque allí cada tecla repintaría las tres cajas.
  const { field } = useController<PostcosechaFormValues, "fruta">({
    name: "fruta",
  });
  const values = field.value;

  const set = <K extends keyof FrutaValues>(key: K, value: FrutaValues[K]) =>
    field.onChange({ ...values, [key]: value });

  const dias = periodoDias(evalId);
  const esperada = fechaEsperada(values.fecha_empaque, dias);
  const sugerir = !values.fecha_evaluacion && !!esperada;
  const fechaImposible = evaluacionAntesDelEmpaque(
    values.fecha_empaque,
    values.fecha_evaluacion,
  );
  // Nunca a la vez que el error: lo decide la propia regla, no este render.
  const pesos = summarizeFrutaPesos(values);
  const fechaFueraDePeriodo = evaluacionFueraDePeriodo(
    values.fecha_empaque,
    values.fecha_evaluacion,
    dias,
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-start gap-4">
        <View className="flex-1 gap-2">
          <Text variant="muted">Fecha de empaque</Text>
          <DateField
            value={values.fecha_empaque}
            onChange={(value) => set("fecha_empaque", value)}
            accessibilityLabel="Fecha de empaque"
          />
          <Text className="text-[13px] text-muted-foreground">
            La fecha que trae la caja.
          </Text>
        </View>

        <View className="flex-1 gap-2">
          <Text variant="muted">Fecha de evaluación</Text>
          <DateField
            value={values.fecha_evaluacion}
            onChange={(value) => set("fecha_evaluacion", value)}
            accessibilityLabel="Fecha de evaluación"
          />

          {/* La esperada se ofrece, no se impone: el evaluador puede abrir la
              caja un día después y la fecha real es la que vale.

              Sin pie debajo, al revés que el empaque: lo que habría que decir
              ahí —cuántos días van— solo importa cuando la fecha no cuadra, y
              entonces ya lo dice el aviso con la fecha concreta. Un recordatorio
              permanente para una regla que casi siempre se cumple es ruido. */}
          {sugerir && (
            <PressableScale
              onPress={() => set("fecha_evaluacion", esperada)}
              role="button"
              className="flex-row items-center gap-1.5 self-start rounded-full border border-dashed border-primary/40 px-2.5 py-1"
            >
              <Icon as={ArrowRightIcon} size={12} className="text-primary" />
              <Text className="text-[13px] font-semibold text-primary">
                {`Usar ${formatISODate(esperada)}`}
              </Text>
            </PressableScale>
          )}
        </View>
      </View>

      {/* Imposible, no raro: la caja no se puede evaluar antes de existir. */}
      {fechaImposible && (
        <Alert icon={TriangleAlertIcon} variant="destructive">
          <AlertDescription>
            La fecha de evaluación no puede ser anterior a la de empaque.
          </AlertDescription>
        </Alert>
      )}

      {/* Raro, no imposible: la caja pudo abrirse un día tarde y el dato sigue
          valiendo, así que **no impide guardar**. Dice la fecha esperada en vez
          de solo señalar el fallo, que es lo que deja arreglarlo sin contar días
          a mano. */}
      {fechaFueraDePeriodo && (
        <Alert icon={CircleAlertIcon} variant="warning">
          <AlertDescription>
            {`La evaluación se debe realizar ${dias} días después del empaque: tocaba el ${formatISODate(esperada)}.`}
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      {/* En el orden en que se pesa: la caja entera al entrar y al salir del
          cuarto frío, y después lo que se separa de ella. */}
      <View className="flex-row gap-4">
        <PesoField
          label="Peso inicial"
          hint="Con empaque"
          value={values.peso_inicial}
          onChange={(value) => set("peso_inicial", value)}
        />
        <PesoField
          label="Peso final"
          hint={dias === null ? "" : `A los ${dias} días`}
          value={values.peso_final}
          onChange={(value) => set("peso_final", value)}
          error={
            pesos.errors.peso_final
              ? "No puede ser mayor que el peso inicial."
              : undefined
          }
        />
      </View>

      <View className="flex-row gap-4">
        <PesoField
          label="Peso de bayas reventadas"
          value={values.peso_bayas_reventadas}
          onChange={(value) => set("peso_bayas_reventadas", value)}
          error={
            pesos.errors.peso_bayas_reventadas
              ? "No puede ser mayor que el peso final."
              : undefined
          }
        />
        <PesoField
          label="Peso de desgrane"
          value={values.peso_desgrane}
          onChange={(value) => set("peso_desgrane", value)}
          error={
            pesos.errors.peso_desgrane
              ? "No puede ser mayor que el peso final."
              : undefined
          }
        />
      </View>

      <FrutaResultados pesos={pesos} />

      <Separator />

      <OptionPicker
        label="Acidez"
        options={NIVEL_FEMENINO}
        value={values.acidez}
        onChange={(value) => set("acidez", value)}
      />

      <Separator />
      <EscalaPicker
        label="Calidad de tallo"
        value={values.tallo}
        onChange={(value) => set("tallo", value)}
      />

      <Separator />
      <OptionPicker
        label="Daño por azufre"
        options={NIVEL_MASCULINO}
        value={values.dano_azufre}
        onChange={(value) => set("dano_azufre", value)}
      />

      <Separator />
      <OptionPicker
        label="Manchas cafés"
        options={NIVEL_FEMENINO_PLURAL}
        value={values.manchas_cafes}
        onChange={(value) => set("manchas_cafes", value)}
      />

      <Separator />

      <EscalaPicker
        label="Calidad de consumo"
        value={values.calidad_consumo}
        onChange={(value) => set("calidad_consumo", value)}
      />

      <Separator />
      <EscalaPicker
        label="Calidad de sabor"
        value={values.sabor}
        onChange={(value) => set("sabor", value)}
      />
    </View>
  );
}

/**
 * La sección entera —cabecera plegable y cuerpo—, con su estado.
 *
 * Junta las dos porque la cabecera enseña el conteo de contestadas y el cuerpo
 * es quien lo cambia: separarlas obligaría a subir el estado a la pantalla, que
 * no tiene nada que hacer con él.
 *
 * **Sin `key` por evaluación**, al revés que antes: ahora quien vacía la sección
 * al saltar entre las cuatro es el `reset` del volcado de la pantalla. Con las
 * dos cosas a la vez habría dos mecanismos para lo mismo, y acabarían
 * discrepando.
 */
export function PostcosechaFrutaSection({ evalId }: { evalId: string }) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <View className="bg-background pt-4">
        <CollapsibleHeader
          icon={GrapeIcon}
          title="Evaluación fruta"
          description="Estado de la fruta al abrir la caja, con las fechas de empaque y de evaluación."
          summary={<PostcosechaFrutaHeaderSummary />}
          open={open}
          onToggle={() => setOpen((value) => !value)}
        />
      </View>
      <CollapsibleBody open={open}>
        <PostcosechaFrutaForm evalId={evalId} />
      </CollapsibleBody>
    </>
  );
}
