import { useEffect, useRef, useState, type Ref } from "react";
import { StyleSheet, View, type TextInput } from "react-native";
import { CircleAlertIcon } from "lucide-react-native";
import { useController, useWatch } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input, type InputVariant } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  CRIBA_CALIBRES,
  CRIBA_MAX_CALIBRE_WEIGHT,
  CRIBA_SAMPLE_WEIGHTS,
  firstCribaWarning,
  isCribaError,
  formatGrams,
  formatShare,
  sanitizeCribaInput,
  summarizeCriba,
  type CribaWarning,
} from "../lib/criba";
import { formatGrouped } from "../lib/decimal-text";
import type { EvaluationFormValues } from "../lib/evaluation-schema";

/**
 * Cuánto espera el aviso a que se deje de teclear. El mismo criterio y el mismo
 * tiempo que el aviso de rango de Brix (`RANGE_WARNING_DELAY_MS` en
 * `eval-brix.tsx`): lo que se está tecleando no avisa.
 */
const WARNING_DELAY_MS = 900;

/**
 * Las dos columnas de captura de cada calibre, en el orden en que se llenan.
 * De aquí salen también el recorrido del teclado y las etiquetas que lee el
 * lector de pantalla.
 */
const CRIBA_FIELDS = [
  { key: "total", label: "peso total" },
  { key: "average", label: "peso promedio por baya" },
] as const;

const FIELDS_PER_CALIBRE = CRIBA_FIELDS.length;

/**
 * Cómo se marca el campo según lo que pase con él: `destructive` para el dato
 * imposible y `warn` para lo que solo se sale de lo habitual. Es la misma
 * distinción que hace `isCribaError` y la que usan las variantes del `Alert`.
 */
type FieldTone = Extract<InputVariant, "warn" | "destructive">;

/** Qué dice cada aviso. Cuál toca lo decide `firstCribaWarning`, que es donde
 *  vive el orden y lo que tiene test. */
const WARNING_TEXT: Record<CribaWarning, string> = {
  totalOutOfRange: `Hay un peso total fuera del rango habitual: ${formatGrouped(CRIBA_MAX_CALIBRE_WEIGHT, 0)} g o más en un solo calibre. ¿Faltó el punto decimal?`,
  sampleOutOfRange: `El peso de la muestra está fuera de lo habitual: la criba se hace con ${CRIBA_SAMPLE_WEIGHTS.map((weight) => `${weight / 1000} kg`).join(" o con ")}.`,
  overTotal:
    "El peso promedio no puede ser mayor que el peso total del calibre.",
  belowPrevious:
    "El peso promedio por baya tiene que aumentar con el calibre; hay uno más bajo que el del calibre anterior.",
};

const styles = StyleSheet.create({
  // Cifras de ancho fijo, para que los pesos queden en columna. En `style` y no
  // como clase: react-native-css-interop solo traduce `font-variant-caps`, así
  // que `tabular-nums` fallaría en silencio.
  tabular: { fontVariant: ["tabular-nums"] },
});

/** Ancho de la columna del calibre y de cada campo, compartidos con la cabecera
 *  de columnas y con la fila del total para que todo caiga en su sitio. */
const CALIBRE_CN = "w-12";
const FIELD_CN = "w-[168px]";
const COLUMN_LABEL_CN = "text-xs font-semibold text-muted-foreground";

/**
 * Lo que la cabecera de la sección muestra en lugar de la barra de progreso:
 * cuántos calibres llevan su peso y cuánto pesa la muestra.
 *
 * Lee los pesos del formulario por su cuenta, como `BrixHeaderSummary`: al
 * teclear se re-renderiza este resumen y no la cabecera entera.
 */
export function CribaHeaderSummary() {
  const calibres = useWatch<EvaluationFormValues, "criba.calibres">({
    name: "criba.calibres",
  });
  const { sampleWeight, completeCount } = summarizeCriba(calibres);

  return (
    <View className="flex-row items-baseline justify-between gap-4">
      <Text variant="muted">
        {completeCount > 0
          ? `${completeCount} de ${CRIBA_CALIBRES.length} calibres`
          : ""}
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text variant="muted">Peso de la muestra</Text>
        <Text
          className={cn(
            "text-xl font-bold",
            sampleWeight === null && "text-muted-foreground",
          )}
          style={styles.tabular}
        >
          {formatGrams(sampleWeight)}
        </Text>
        {sampleWeight !== null && <Text variant="muted">g</Text>}
      </View>
    </View>
  );
}

/**
 * Criba: el peso de la muestra repartido en los nueve calibres.
 *
 * Los pesos viven en el formulario de la pantalla (`criba.calibres`), como las
 * respuestas y las lecturas de Brix. Lo que vive aquí es estado de interfaz:
 * qué campo está enfocado y cuál se está tecleando.
 *
 * Los mira todos de una vez, y no cada fila los suyos como hace Brix, porque
 * aquí todo depende de la suma: teclear un peso cambia la distribución de los
 * otros ocho calibres.
 */
export function EvalCriba() {
  // El calibre que se está tecleando, que no avisa hasta que se deja de teclear
  // (ver `summarizeCriba`): una pausa o salir del campo.
  //
  // Cada tecla guarda un objeto nuevo y no el índice a secas: con el índice,
  // React descartaría las teclas siguientes por ser el mismo valor, el efecto
  // no se reiniciaría y la espera contaría desde la primera, no desde la última.
  const [typing, setTyping] = useState<{ index: number } | null>(null);

  useEffect(() => {
    if (typing === null) return;

    const timeout = setTimeout(() => setTyping(null), WARNING_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [typing]);

  const calibres = useWatch<EvaluationFormValues, "criba.calibres">({
    name: "criba.calibres",
  });
  const summary = summarizeCriba(calibres, typing?.index ?? null);
  // Uno solo, el más grave de los que estén rotos. En cuanto se arregla,
  // aparece el siguiente si sigue ahí (ver `firstCribaWarning`).
  const warning = firstCribaWarning(summary);
  // Lo imposible se pinta en rojo; lo raro, en ámbar.
  const tone: FieldTone =
    warning !== null && isCribaError(warning) ? "destructive" : "warn";

  // Un hueco por campo, en el orden de captura: el peso total de un calibre, su
  // promedio, y de ahí al calibre siguiente. Es lo que encadena «Siguiente».
  const inputs = useRef<(TextInput | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const lastFieldIndex = CRIBA_CALIBRES.length * FIELDS_PER_CALIBRE - 1;

  return (
    <View className="gap-4">
      <View className="gap-2">
        <View className="flex-row items-end gap-3 pb-0.5">
          <Text className={cn(CALIBRE_CN, COLUMN_LABEL_CN)}>Calibre</Text>
          <Text className={cn(FIELD_CN, COLUMN_LABEL_CN)}>Peso total</Text>
          <Text className={cn(FIELD_CN, COLUMN_LABEL_CN)}>
            Peso promedio por baya
          </Text>
          <Text className={cn("flex-1", COLUMN_LABEL_CN)}>Distribución</Text>
        </View>

        {summary.calibres.map((calibre, index) => (
          <View
            key={calibre.calibre}
            role="group"
            aria-label={`Calibre ${calibre.calibre}`}
            className="flex-row items-center gap-3"
          >
            <Text
              className={cn(
                CALIBRE_CN,
                "text-center text-sm font-bold text-muted-foreground",
              )}
              style={styles.tabular}
            >
              {calibre.calibre}
            </Text>

            {CRIBA_FIELDS.map(({ key, label }, column) => {
              const fieldIndex = index * FIELDS_PER_CALIBRE + column;

              return (
                <CribaWeightField
                  key={key}
                  name={`criba.calibres.${index}.${key}`}
                  ref={(input) => {
                    inputs.current[fieldIndex] = input;
                  }}
                  accessibilityLabel={`Calibre ${calibre.calibre}, ${label}`}
                  // Un calibre pesado en 0 g no tiene bayas que pesar, y eso
                  // se dice en el campo que se queda vacío.
                  placeholder={
                    key === "average" && calibre.noFruit ? "No aplica" : ""
                  }
                  // En ámbar solo los campos del aviso que se está enseñando: un
                  // campo marcado cuyo problema no explica nadie deja al
                  // evaluador buscando. Los demás aparecerán cuando les toque.
                  warn={
                    key === "average"
                      ? (warning === "overTotal" && calibre.overTotal) ||
                        (warning === "belowPrevious" && calibre.belowPrevious)
                      : warning === "totalOutOfRange" && calibre.totalOutOfRange
                  }
                  tone={tone}
                  isFocused={focused === fieldIndex}
                  isLast={fieldIndex === lastFieldIndex}
                  onEdit={() => setTyping({ index })}
                  onFocus={() => setFocused(fieldIndex)}
                  onBlur={() => {
                    setFocused((current) =>
                      current === fieldIndex ? null : current,
                    );
                    // Salir del campo es terminar de teclear: el aviso sale
                    // ya, sin esperar la pausa.
                    setTyping(null);
                  }}
                  onSubmitEditing={() =>
                    inputs.current[fieldIndex + 1]?.focus()
                  }
                />
              );
            })}

            <View className="flex-1 flex-row items-center gap-2.5">
              {/* `w-auto` neutraliza el `w-full` de la raíz de `Progress`: en
                    una fila ocuparía el ancho entero y, como el `flexShrink`
                    por defecto es 0 en React Native, empujaría el porcentaje
                    fuera de la tarjeta. */}
              <Progress
                value={calibre.share ?? 0}
                className="h-2 w-auto flex-1 bg-secondary"
                indicatorClassName="bg-foreground/90"
              />
              <Text
                className={cn(
                  "min-w-14 text-right font-medium",
                  calibre.share === null && "text-muted-foreground",
                )}
                style={styles.tabular}
              >
                {formatShare(calibre.share)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {warning && (
        // Uno solo para toda la tarjeta, y no uno colgando de cada fila: qué
        // calibre no cuadra ya lo dice su campo en ámbar, así que el aviso solo
        // tiene que explicar qué pasa. La variante `warning` es la misma que usa
        // el aviso de rango de Brix.
        <Alert
          variant={tone === "destructive" ? "destructive" : "warning"}
          icon={CircleAlertIcon}
        >
          <AlertDescription>{WARNING_TEXT[warning]}</AlertDescription>
        </Alert>
      )}

      <Separator className="my-1" />

      <CribaSampleNote />
    </View>
  );
}

/**
 * El peso de muestra que toca pesar antes de cribar.
 *
 * Nombra las dos referencias en lugar de la que toca porque la etapa de la
 * plantación no se puede saber desde aquí: no está en el modelo ni la manda el
 * backend. El evaluador sí sabe en cuál está.
 */
function CribaSampleNote() {
  return (
    // El texto va sin `flex-1`: aquí el contenedor es una columna, así que eso
    // sería «base cero y encoge» sobre el alto. Mientras sobra sitio no se
    // nota, pero en cuanto entra el aviso y el contenido no cabe en el alto que
    // el cuerpo de la sección tiene medido, el texto encoge a cero y la nota
    // desaparece. A lo ancho no hace falta: en una columna los hijos se estiran
    // por defecto.
    <View role="note" className="px-2 pb-2">
      <Text variant="muted">
        Pesa una muestra de{" "}
        <Text className="font-semibold text-foreground">1.5 kg</Text> si la
        plantación es experimental (primera etapa), o de{" "}
        <Text className="font-semibold text-foreground">2.5 kg</Text> si es
        semiexperimental (segunda etapa).
      </Text>
    </View>
  );
}

type CribaWeightFieldProps = {
  ref?: Ref<TextInput>;
  name: `criba.calibres.${number}.${(typeof CRIBA_FIELDS)[number]["key"]}`;
  accessibilityLabel: string;
  placeholder: string;
  warn: boolean;
  /** Con qué color se marca cuando `warn` está puesto. */
  tone: FieldTone;
  isFocused: boolean;
  isLast: boolean;
  /** Avisa de que cambió el peso, sin decir cuál ni a qué. */
  onEdit: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmitEditing: () => void;
};

/**
 * Un peso en gramos, enganchado a su campo del formulario.
 *
 * La máscara va aquí, al teclear, y no en el esquema: zod valida al guardar, y
 * pasarla allí dejaría ver "1a8,5" en el campo hasta entonces.
 */
function CribaWeightField({
  ref,
  name,
  accessibilityLabel,
  placeholder,
  warn,
  tone,
  isFocused,
  isLast,
  onEdit,
  onFocus,
  onBlur,
  onSubmitEditing,
}: CribaWeightFieldProps) {
  const { field } = useController<EvaluationFormValues, typeof name>({ name });

  return (
    <View className={FIELD_CN}>
      <Input
        ref={ref}
        value={field.value}
        onChangeText={(text) => {
          onEdit();
          field.onChange(sanitizeCribaInput(text));
        }}
        onFocus={onFocus}
        onBlur={() => {
          // Lo marca como tocado, que es lo que usará el guardado para decidir
          // qué errores enseña.
          field.onBlur();
          onBlur();
        }}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        aria-label={accessibilityLabel}
        keyboardType="decimal-pad"
        // «Siguiente» pasa al peso que sigue sin cerrar el teclado; en el
        // último lo cierra.
        returnKeyType={isLast ? "done" : "next"}
        submitBehavior={isLast ? "blurAndSubmit" : "submit"}
        // Corregir un peso es reescribirlo entero, no editar un dígito.
        selectTextOnFocus
        variant={warn ? tone : "default"}
        className={cn(
          "pr-8 text-right text-lg font-medium leading-6",
          isFocused && "border-primary",
        )}
        style={styles.tabular}
      />
      {/* Encima del campo pero sin tragarse el toque: tocar la unidad también
          tiene que enfocarlo. */}
      <View
        pointerEvents="none"
        className="absolute bottom-0 right-3 top-0 justify-center"
      >
        <Text variant="muted" className="text-sm">
          g
        </Text>
      </View>
    </View>
  );
}
