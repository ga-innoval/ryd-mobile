import { useEffect, useRef, useState, type Ref } from "react";
import {
  Keyboard,
  StyleSheet,
  View,
  type KeyboardTypeOptions,
  type TextInput,
} from "react-native";
import { PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react-native";
import { useController, useFieldArray, useWatch } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { TextButton } from "@/components/ui/text-button";
import { cn } from "@/lib/utils";
import {
  createRendimientoCorte,
  formatAveragePerRacimo,
  formatKilos,
  sanitizeKilogramos,
  sanitizeRacimos,
  summarizeRendimiento,
} from "../lib/rendimiento";
import type { EvaluationFormValues } from "../lib/evaluation-schema";

/**
 * Cuánto espera el aviso a que se deje de teclear. El mismo criterio y el mismo
 * tiempo que en Criba y en Brix: lo que se está tecleando no avisa.
 */
const WARNING_DELAY_MS = 900;

/** Cuánto espera «Confirmar descarte» antes de volver solo a su estado normal. */
const CONFIRM_DELETE_TIMEOUT_MS = 4_000;

/**
 * Las dos columnas que se teclean, en el orden en que se llenan. La fecha no
 * entra: se elige en el calendario, así que no forma parte del recorrido del
 * teclado.
 */
const RENDIMIENTO_FIELDS = [
  {
    key: "kilogramos",
    label: "kilogramos",
    sanitize: sanitizeKilogramos,
    keyboardType: "decimal-pad",
    suffix: "kg",
  },
  {
    key: "racimos",
    label: "racimos",
    sanitize: sanitizeRacimos,
    // Se cuentan de uno en uno, así que el teclado no ofrece separador.
    keyboardType: "number-pad",
    suffix: "",
  },
] as const;

const FIELDS_PER_CORTE = RENDIMIENTO_FIELDS.length;

const styles = StyleSheet.create({
  // Cifras de ancho fijo, para que los pesos queden en columna. En `style` y no
  // como clase: react-native-css-interop solo traduce `font-variant-caps`, así
  // que `tabular-nums` fallaría en silencio.
  tabular: { fontVariant: ["tabular-nums"] },
});

/** Anchos de columna, compartidos con la cabecera y con la fila del total. */
const CORTE_CN = "w-12";
const FECHA_CN = "w-[168px]";
const FIELD_CN: Record<(typeof RENDIMIENTO_FIELDS)[number]["key"], string> = {
  kilogramos: "w-[148px]",
  racimos: "w-[128px]",
};
const COLUMN_LABEL_CN = "text-xs font-semibold text-muted-foreground";

function cortesLabel(count: number): string {
  return count === 1 ? "1 corte registrado" : `${count} cortes registrados`;
}

/**
 * Lo que la cabecera de la sección muestra en lugar de la barra de progreso:
 * cuántos cortes llevan kilogramos y cuánto se lleva cosechado.
 *
 * Lee los cortes del formulario por su cuenta, como los otros resúmenes: al
 * teclear se re-renderiza esto y no la cabecera entera.
 */
export function RendimientoHeaderSummary() {
  const cortes = useWatch<EvaluationFormValues, "rendimiento.cortes">({
    name: "rendimiento.cortes",
  });
  const { total, registeredCount } = summarizeRendimiento(cortes);

  return (
    <View className="flex-row items-baseline justify-between gap-4">
      <Text variant="muted">
        {registeredCount > 0 ? cortesLabel(registeredCount) : ""}
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text variant="muted">Total</Text>
        <Text
          className={cn(
            "text-xl font-bold",
            total === null && "text-muted-foreground",
          )}
          style={styles.tabular}
        >
          {formatKilos(total)}
        </Text>
        {total !== null && <Text variant="muted">kg</Text>}
      </View>
    </View>
  );
}

/**
 * Rendimiento: lo cosechado en cada corte, con tantos cortes como haga falta.
 *
 * Los cortes viven en el formulario de la pantalla (`rendimiento.cortes`), y
 * aquí se agregan y se descartan con `useFieldArray`, como los de Brix. Lo que
 * vive aquí es estado de interfaz: qué campo está enfocado, cuál se está
 * tecleando y si hay un descarte esperando confirmación, así que quien lo monte
 * debe darle `key` por tratamiento para que no se arrastre de uno a otro.
 */
export function EvalRendimiento() {
  const { fields, append, remove } = useFieldArray<
    EvaluationFormValues,
    "rendimiento.cortes"
  >({ name: "rendimiento.cortes" });

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Un toque suelto no debe dejar el descarte armado: si no se confirma, vuelve
  // solo a su estado normal.
  useEffect(() => {
    if (!confirmingDelete) return;

    const timeout = setTimeout(
      () => setConfirmingDelete(false),
      CONFIRM_DELETE_TIMEOUT_MS,
    );
    return () => clearTimeout(timeout);
  }, [confirmingDelete]);

  // El corte que se está tecleando, que no avisa hasta que se deja de teclear
  // (ver `summarizeRendimiento`): una pausa o salir del campo.
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

  const cortes = useWatch<EvaluationFormValues, "rendimiento.cortes">({
    name: "rendimiento.cortes",
  });

  /**
   * **Cuántos cortes hay lo dice `fields`; qué llevan, lo vigilado.**
   *
   * Las dos listas no cambian a la vez: agregar y descartar acortan o alargan
   * `fields` en el acto, y el aviso que despierta al `useWatch` llega un paso
   * después, en un efecto. Mientras tanto, pintar desde lo vigilado dejaba a la
   * vista el corte recién descartado, y sus campos volvían a registrarse en el
   * formulario con sus valores: el corte resucitaba y el descarte no hacía nada.
   *
   * Emparejando contra `fields`, un corte recién agregado se pinta en blanco
   * durante ese render —que es justo lo que es— y uno descartado desaparece ya.
   */
  const rows = fields.map(
    (_, index) => cortes[index] ?? createRendimientoCorte(),
  );
  // Un hueco por campo tecleable, en el orden de captura: los kilogramos de un
  // corte, sus racimos, y de ahí al corte siguiente. Es lo que encadena
  // «Siguiente».
  const inputs = useRef<(TextInput | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);

  const summary = summarizeRendimiento(rows, typing?.index ?? null);
  const hasError = summary.cortes.some((corte) => corte.zeroRacimos);
  const lastFieldIndex = summary.cortes.length * FIELDS_PER_CORTE - 1;

  const addCorte = () => {
    // El corte nuevo llega vacío y sin enfocar: por defecto RHF enfocaría su
    // primer campo, y eso reabriría el teclado que se acaba de cerrar.
    setConfirmingDelete(false);
    Keyboard.dismiss();
    append(createRendimientoCorte(), { shouldFocus: false });
  };

  // Primer toque: pregunta. Segundo: descarta. Siempre el último corte, que es
  // el que se está capturando.
  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setConfirmingDelete(false);
    Keyboard.dismiss();
    remove(fields.length - 1);
  };

  return (
    <View className="gap-4">
      <View className="gap-2">
        <View className="flex-row items-end gap-3 pb-0.5">
          <Text className={cn(CORTE_CN, COLUMN_LABEL_CN)}>Corte</Text>
          <Text className={cn(FECHA_CN, COLUMN_LABEL_CN)}>Fecha</Text>
          <Text className={cn(FIELD_CN.kilogramos, COLUMN_LABEL_CN)}>
            Kilogramos
          </Text>
          <Text className={cn(FIELD_CN.racimos, COLUMN_LABEL_CN)}>Racimos</Text>
          <Text className={cn("flex-1", COLUMN_LABEL_CN)}>
            Promedio por racimo
          </Text>
        </View>

        {/* El `id` del field array y no el índice: es el que RHF mantiene
            ligado a cada corte al agregar, quitar o reiniciar. */}
        {summary.cortes.map((corte, index) => (
          <View
            key={fields[index].id}
            role="group"
            aria-label={`Corte ${corte.numero}`}
            className="flex-row items-center gap-3"
          >
            <Text
              className={cn(
                CORTE_CN,
                "text-center text-sm font-bold text-muted-foreground",
              )}
              style={styles.tabular}
            >
              {corte.numero}
            </Text>

            <RendimientoDateField index={index} numero={corte.numero} />

            {RENDIMIENTO_FIELDS.map(
              ({ key, label, sanitize, keyboardType, suffix }, column) => {
                const fieldIndex = index * FIELDS_PER_CORTE + column;

                return (
                  <RendimientoNumberField
                    key={key}
                    name={`rendimiento.cortes.${index}.${key}`}
                    ref={(input) => {
                      inputs.current[fieldIndex] = input;
                    }}
                    sanitize={sanitize}
                    keyboardType={keyboardType}
                    suffix={suffix}
                    className={FIELD_CN[key]}
                    accessibilityLabel={`${label} del corte ${corte.numero}`}
                    // El error es del conteo: los kilogramos están, y decir que
                    // los dieron cero racimos es imposible.
                    warn={key === "racimos" && corte.zeroRacimos}
                    isFocused={focused === fieldIndex}
                    isLast={fieldIndex === lastFieldIndex}
                    // Teclear cualquier dato cancela un descarte pendiente:
                    // confirmar tiene que ser lo siguiente que se toque.
                    onEdit={() => {
                      setConfirmingDelete(false);
                      setTyping({ index });
                    }}
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
              },
            )}

            <View className="flex-1 flex-row items-baseline gap-1">
              <Text
                className={cn(
                  "font-medium",
                  corte.average === null && "text-muted-foreground",
                  corte.zeroRacimos && "text-red-800",
                )}
                style={styles.tabular}
              >
                {/* Con 0 kg y 0 racimos no hay nada que promediar, y un cero
                    parecería un dato capturado. */}
                {corte.noFruit
                  ? "No aplica"
                  : formatAveragePerRacimo(corte.average)}
              </Text>
              {corte.average !== null && <Text variant="muted">kg</Text>}
            </View>
          </View>
        ))}

        {summary.canRemove && (
          // A partir del segundo corte: el primero es obligatorio y no se
          // descarta, como en Brix. Cuelga del último, que es el que se quita,
          // y a la derecha para no competir con el botón de agregar.
          //
          // Sin `flex-1`: aquí el contenedor es una columna, así que sería
          // «base cero y encoge» sobre el alto, y el cuerpo de la sección se
          // mide por su contenido. Es lo que dejó sin altura a la nota de
          // Criba.
          <View className="items-end py-2">
            {/* Dos toques, como el descarte de un corte de Brix: el primero
                pregunta y el segundo descarta. Si no se confirma, vuelve solo a
                su estado normal. */}
            <TextButton
              icon={Trash2Icon}
              variant={confirmingDelete ? "destructive" : "onLight"}
              onPress={handleDelete}
            >
              {confirmingDelete
                ? "Confirmar descarte"
                : `Descartar corte ${summary.cortes.length}`}
            </TextButton>
          </View>
        )}

        <Separator className="my-1" />
      </View>

      {hasError && (
        // Uno solo para toda la tabla: qué corte es lo dice su campo en rojo.
        //
        // Rojo y no ámbar porque no es raro, es imposible —la fruta salió de
        // algún sitio—, y por eso impide dar la evaluación por terminada (ver
        // `evaluation-errors.ts`). Guardar se guarda igual.
        //
        // Que el conteo esté todavía sin capturar no saca nada: de los datos
        // que faltan habla el avance de la sección, y una alerta por cada hueco
        // sería una alerta permanente.
        <Alert variant="destructive" icon={TriangleAlertIcon}>
          <AlertDescription>
            Hay kilogramos capturados y el conteo dice cero racimos: revisa el
            conteo.
          </AlertDescription>
        </Alert>
      )}

      <View className="gap-2">
        {/* Deshabilitado y no escondido: con tres datos por corte, que el
            botón desaparezca no dice qué falta, y la nota de abajo sí. */}
        <Button
          variant="secondary"
          size="lg"
          className="border border-border"
          disabled={!summary.canAdd}
          onPress={addCorte}
        >
          <Icon as={PlusIcon} size={16} className="text-primary" />
          <Text className="text-base">
            {`Agregar corte ${summary.cortes.length + 1}`}
          </Text>
        </Button>
      </View>
    </View>
  );
}

/** El enganche de la fecha de un corte con su campo del formulario. */
function RendimientoDateField({
  index,
  numero,
}: {
  index: number;
  numero: number;
}) {
  const name = `rendimiento.cortes.${index}.fecha` as const;
  const { field } = useController<EvaluationFormValues, typeof name>({ name });

  return (
    <DateField
      className={FECHA_CN}
      value={field.value}
      onChange={field.onChange}
      accessibilityLabel={`Fecha del corte ${numero}`}
    />
  );
}

type RendimientoNumberFieldProps = {
  ref?: Ref<TextInput>;
  name: `rendimiento.cortes.${number}.${(typeof RENDIMIENTO_FIELDS)[number]["key"]}`;
  sanitize: (text: string) => string;
  keyboardType: KeyboardTypeOptions;
  /** La unidad, dentro del campo y a la derecha; vacía si no lleva. */
  suffix: string;
  accessibilityLabel: string;
  className: string;
  warn: boolean;
  isFocused: boolean;
  isLast: boolean;
  /** Avisa de que cambió el dato, sin decir cuál ni a qué. */
  onEdit: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmitEditing: () => void;
};

/**
 * Un dato del corte, enganchado a su campo del formulario.
 *
 * La máscara va aquí, al teclear, y no en el esquema: zod valida al guardar, y
 * pasarla allí dejaría ver "41a2,5" en el campo hasta entonces.
 */
function RendimientoNumberField({
  ref,
  name,
  sanitize,
  keyboardType,
  suffix,
  accessibilityLabel,
  className,
  warn,
  isFocused,
  isLast,
  onEdit,
  onFocus,
  onBlur,
  onSubmitEditing,
}: RendimientoNumberFieldProps) {
  const { field } = useController<EvaluationFormValues, typeof name>({ name });

  return (
    <View className={className}>
      <Input
        ref={ref}
        value={field.value}
        onChangeText={(text) => {
          onEdit();
          field.onChange(sanitize(text));
        }}
        onFocus={onFocus}
        onBlur={() => {
          // Lo marca como tocado, que es lo que usará el guardado para decidir
          // qué errores enseña.
          field.onBlur();
          onBlur();
        }}
        onSubmitEditing={onSubmitEditing}
        aria-label={accessibilityLabel}
        keyboardType={keyboardType}
        // «Siguiente» pasa al dato que sigue sin cerrar el teclado; en el
        // último lo cierra.
        returnKeyType={isLast ? "done" : "next"}
        submitBehavior={isLast ? "blurAndSubmit" : "submit"}
        // Corregir un dato es reescribirlo entero, no editar un dígito.
        selectTextOnFocus
        className={cn(
          "text-right text-lg font-medium leading-6",
          suffix === "" ? "pr-3" : "pr-8",
          isFocused && "border-primary",
          warn && "border-red-600 bg-red-50 text-red-800",
        )}
        style={styles.tabular}
      />
      {suffix !== "" && (
        // Encima del campo pero sin tragarse el toque: tocar la unidad también
        // tiene que enfocarlo.
        <View
          pointerEvents="none"
          className="absolute bottom-0 right-3 top-0 justify-center"
        >
          <Text variant="muted" className="text-sm">
            {suffix}
          </Text>
        </View>
      )}
    </View>
  );
}
