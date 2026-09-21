import { useEffect, useRef, useState, type Ref } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  type TextInput,
} from "react-native";
import { CheckIcon, PlusIcon, TriangleAlertIcon } from "lucide-react-native";
import {
  CollapsibleBody,
  CollapsibleChevron,
} from "@/components/collapsible-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { TextButton } from "@/components/ui/text-button";
import { cn } from "@/lib/utils";
import {
  BRIX_READINGS_PER_CORTE,
  canAddBrixCorte,
  canRemoveBrixCorte,
  formatBrix,
  sanitizeBrixInput,
  summarizeBrix,
  type BrixCorteSummary,
  type BrixPairSummary,
} from "../lib/brix";
import type { BrixCorte } from "../types";

/** Cuánto espera «Confirmar descarte» antes de volver solo a su estado normal. */
const CONFIRM_DELETE_TIMEOUT_MS = 4_000;

const styles = StyleSheet.create({
  // Cifras de ancho fijo, para que los resultados queden en columna. En
  // `style` y no como clase: react-native-css-interop solo traduce
  // `font-variant-caps`, así que `tabular-nums` fallaría en silencio.
  tabular: { fontVariant: ["tabular-nums"] },
});

function cortesLabel(count: number): string {
  return count === 1 ? "1 corte" : `${count} cortes`;
}

function deleteHint(filled: number): string {
  if (filled === 0) return "El corte no tiene lecturas.";
  if (filled === 1) return "Se borrará su única lectura.";
  return `Se borrarán sus ${filled} lecturas.`;
}

/**
 * Lo que la cabecera de la sección muestra en lugar de la barra de progreso.
 *
 * Sin etiqueta de estado a propósito: mientras no hay lecturas el promedio
 * queda en «—», y eso ya dice que la sección no ha empezado.
 */
export function BrixHeaderSummary({ cortes }: { cortes: BrixCorte[] }) {
  const { average, capturedCount } = summarizeBrix(cortes);

  return (
    <View className="flex-row items-baseline justify-between gap-4">
      <Text variant="muted">
        {capturedCount > 0 ? cortesLabel(capturedCount) : ""}
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text variant="muted">Brix promedio</Text>
        <Text
          className={cn(
            "text-xl font-bold",
            average === null && "text-muted-foreground",
          )}
          style={styles.tabular}
        >
          {formatBrix(average)}
        </Text>
      </View>
    </View>
  );
}

type EvalBrixProps = {
  cortes: BrixCorte[];
  onReadingChange: (
    corteIndex: number,
    readingIndex: number,
    text: string,
  ) => void;
  onAddCorte: () => void;
  onRemoveLastCorte: () => void;
};

/**
 * Captura de Brix: un corte por visita, con sus diez lecturas.
 *
 * Las lecturas no viven aquí: llegan por props y los cambios se avisan, como en
 * `EvalQuestionsForm`, porque la cabecera de la sección también las necesita y
 * no está dentro de este componente. Lo que sí vive aquí es estado de interfaz
 * —qué cortes están abiertos y si hay un descarte esperando confirmación—, así
 * que quien lo monte debe darle `key` por tratamiento para que no se arrastre
 * de uno a otro.
 */
export function EvalBrix({
  cortes,
  onReadingChange,
  onAddCorte,
  onRemoveLastCorte,
}: EvalBrixProps) {
  const { cortes: summaries } = summarizeBrix(cortes);
  const lastIndex = cortes.length - 1;

  // Sin entrada propia, un corte está abierto si es el último: el que se está
  // capturando. Se resuelve en cada render y no al montar porque, al cambiar de
  // tratamiento, este componente se monta en el mismo render en que la pantalla
  // aún tiene los cortes del anterior; fijado al montar, apuntaría a un corte
  // que deja de existir en cuanto la pantalla los reinicia.
  const [openCortes, setOpenCortes] = useState<Record<number, boolean>>({});
  const isCorteOpen = (index: number) =>
    openCortes[index] ?? index === lastIndex;

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

  // Todo lo demás cancela un descarte pendiente: confirmar tiene que ser lo
  // siguiente que se toque.
  //
  // Y todo lo que pliega o quita un corte cierra el teclado: el cuerpo plegado
  // sigue montado, así que su campo enfocado conservaría el foco sin verse y lo
  // que se tecleara iría a parar ahí.
  const toggleCorte = (index: number) => {
    const wasOpen = isCorteOpen(index);

    setConfirmingDelete(false);
    if (wasOpen) Keyboard.dismiss();
    setOpenCortes((prev) => ({ ...prev, [index]: !wasOpen }));
  };

  const changeReading = (
    corteIndex: number,
    readingIndex: number,
    text: string,
  ) => {
    setConfirmingDelete(false);
    onReadingChange(corteIndex, readingIndex, sanitizeBrixInput(text));
  };

  // Se captura un corte por visita: el nuevo se abre y los demás se pliegan.
  const addCorte = () => {
    setConfirmingDelete(false);
    Keyboard.dismiss();
    setOpenCortes({ [cortes.length]: true });
    onAddCorte();
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setConfirmingDelete(false);
    Keyboard.dismiss();
    // Queda abierto el que pasa a ser el último.
    setOpenCortes((prev) => ({
      ...prev,
      [lastIndex]: false,
      [lastIndex - 1]: true,
    }));
    onRemoveLastCorte();
  };

  return (
    <View className="gap-3">
      {cortes.map((corte, index) => (
        <BrixCorteCard
          // Solo se agrega o se quita al final, así que el índice identifica
          // al corte.
          key={index}
          number={index + 1}
          readings={corte.readings}
          summary={summaries[index]}
          open={isCorteOpen(index)}
          onToggle={() => toggleCorte(index)}
          onReadingChange={(readingIndex, text) =>
            changeReading(index, readingIndex, text)
          }
          canDelete={index === lastIndex && canRemoveBrixCorte(cortes)}
          confirmingDelete={confirmingDelete}
          onDelete={handleDelete}
        />
      ))}

      {canAddBrixCorte(cortes) && (
        <Button
          variant="secondary"
          size="lg"
          className="mt-1 border border-border"
          onPress={addCorte}
        >
          <Icon as={PlusIcon} size={16} className="text-primary" />
          <Text className="text-base">{`Agregar corte ${cortes.length + 1}`}</Text>
        </Button>
      )}
    </View>
  );
}

type BrixCorteCardProps = {
  number: number;
  readings: string[];
  summary: BrixCorteSummary;
  open: boolean;
  onToggle: () => void;
  onReadingChange: (readingIndex: number, text: string) => void;
  canDelete: boolean;
  confirmingDelete: boolean;
  onDelete: () => void;
};

/**
 * Un corte: una cabecera que pliega y, dentro, sus cinco pares de lecturas.
 *
 * La cabecera es la misma abierta y cerrada —«Corte N» a la izquierda, el
 * promedio a la derecha y el mismo alto— y solo cambia el centro: los
 * resultados R1–R5 cerrada, las lecturas capturadas abierta. Así abrir un corte
 * no mueve nada de lo que ya estaba a la vista.
 */
function BrixCorteCard({
  number,
  readings,
  summary,
  open,
  onToggle,
  onReadingChange,
  canDelete,
  confirmingDelete,
  onDelete,
}: BrixCorteCardProps) {
  const inputs = useRef<(TextInput | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);

  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      {/* El `Pressable` de React Native y no el de gesture-handler que usa
          `CollapsibleHeader`: aquel lo exige el sticky, y esta cabecera no se
          pega. */}
      <Pressable
        onPress={onToggle}
        role="button"
        aria-expanded={open}
        className="flex-row items-center gap-4 py-2 pl-4 pr-3 active:bg-secondary/50"
      >
        <Text className="w-24 font-bold">{`Corte ${number}`}</Text>

        <View className="flex-1">
          {open ? (
            <CorteProgress summary={summary} />
          ) : (
            <CorteResults pairs={summary.pairs} />
          )}
        </View>

        {/* `h-auto` anula el `h-full` del separador vertical: en una fila sin
            alto propio, el porcentaje no tiene contra qué resolverse. */}
        <Separator orientation="vertical" className="h-auto self-stretch" />

        <View className="w-[84px] gap-0.5">
          <Text className="text-xs font-semibold text-muted-foreground">
            Promedio
          </Text>
          <Text
            className={cn(
              "text-lg font-bold",
              summary.average === null && "text-muted-foreground",
            )}
            style={styles.tabular}
          >
            {formatBrix(summary.average)}
          </Text>
        </View>

        <CollapsibleChevron open={open} />
      </Pressable>

      <CollapsibleBody open={open} variant="bare">
        <Separator />

        <View className="flex-row gap-2.5 p-4">
          {summary.pairs.map((pair, pairIndex) => (
            <View key={pairIndex} className="flex-1 gap-2">
              <Text className="text-center text-sm font-bold text-muted-foreground">
                {`R${pairIndex + 1}`}
              </Text>

              {[pairIndex * 2, pairIndex * 2 + 1].map((readingIndex) => (
                <BrixReadingInput
                  key={readingIndex}
                  ref={(input) => {
                    inputs.current[readingIndex] = input;
                  }}
                  label={`L${readingIndex + 1}`}
                  accessibilityLabel={`Corte ${number}, lectura ${readingIndex + 1}`}
                  value={readings[readingIndex] ?? ""}
                  isFocused={focused === readingIndex}
                  outOfRange={summary.outOfRange[readingIndex]}
                  isLast={readingIndex === BRIX_READINGS_PER_CORTE - 1}
                  onChangeText={(text) => onReadingChange(readingIndex, text)}
                  onFocus={() => setFocused(readingIndex)}
                  onBlur={() =>
                    setFocused((current) =>
                      current === readingIndex ? null : current,
                    )
                  }
                  onSubmitEditing={() =>
                    inputs.current[readingIndex + 1]?.focus()
                  }
                />
              ))}

              <PairResult pair={pair} />
            </View>
          ))}
        </View>

        {summary.filled === 0 && (
          <Text variant="muted" className="-mt-1 px-4 pb-4">
            Captura las lecturas en orden, de L1 a L10. Cada columna es un par y
            su promedio (R) se calcula solo.
          </Text>
        )}

        {summary.firstOutOfRange !== null && (
          <View className="-mt-1 px-4 pb-4">
            <Alert
              icon={TriangleAlertIcon}
              className="border-amber-300 bg-amber-50"
              iconClassName="text-amber-700"
            >
              <AlertDescription className="text-amber-800">
                {`L${summary.firstOutOfRange + 1} = ${readings[summary.firstOutOfRange]} está fuera del rango habitual. ¿Faltó el punto decimal?`}
              </AlertDescription>
            </Alert>
          </View>
        )}

        {canDelete && (
          <View className="-mt-1 flex-row items-center justify-end gap-3 px-4 pb-4">
            {confirmingDelete && (
              <Text variant="muted">{deleteHint(summary.filled)}</Text>
            )}
            <TextButton
              variant={confirmingDelete ? "destructive" : "onLight"}
              onPress={onDelete}
            >
              {confirmingDelete
                ? "Confirmar descarte"
                : `Descartar corte ${number}`}
            </TextButton>
          </View>
        )}
      </CollapsibleBody>
    </View>
  );
}

/** Centro de la cabecera abierta: cuántas lecturas lleva el corte. */
function CorteProgress({ summary }: { summary: BrixCorteSummary }) {
  if (summary.complete) {
    return (
      <View className="flex-row items-center gap-1">
        <Icon as={CheckIcon} size={14} className="text-primary" />
        <Text className="text-sm font-medium text-primary">
          {`${BRIX_READINGS_PER_CORTE} de ${BRIX_READINGS_PER_CORTE} lecturas`}
        </Text>
      </View>
    );
  }

  return (
    <Text variant="muted" className="font-medium">
      {summary.filled === 0
        ? "Sin lecturas"
        : `${summary.filled} de ${BRIX_READINGS_PER_CORTE} lecturas`}
    </Text>
  );
}

/** Centro de la cabecera cerrada: los resultados, que ya dicen si está completo. */
function CorteResults({ pairs }: { pairs: BrixPairSummary[] }) {
  return (
    <View className="flex-row gap-2">
      {pairs.map((pair, index) => (
        <View key={index} className="flex-1 gap-0.5">
          <Text className="text-xs font-semibold text-muted-foreground">
            {`R${index + 1}`}
          </Text>
          <Text
            className={cn(
              "font-medium",
              pair.value === null && "text-muted-foreground",
              pair.outOfRange && "text-amber-800",
            )}
            style={styles.tabular}
          >
            {formatBrix(pair.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PairResult({ pair }: { pair: BrixPairSummary }) {
  return (
    <View
      className={cn(
        "h-10 flex-row items-center justify-center gap-1.5 rounded-lg",
        pair.outOfRange
          ? "bg-amber-50"
          : pair.value === null
            ? "bg-background"
            : "bg-secondary",
      )}
    >
      {pair.outOfRange && (
        <Icon as={TriangleAlertIcon} size={14} className="text-amber-700" />
      )}
      <Text
        className={cn(
          "text-lg font-bold",
          pair.value === null && "text-muted-foreground",
          pair.outOfRange && "text-amber-800",
        )}
        style={styles.tabular}
      >
        {formatBrix(pair.value)}
      </Text>
    </View>
  );
}

type BrixReadingInputProps = {
  ref?: Ref<TextInput>;
  label: string;
  accessibilityLabel: string;
  value: string;
  isFocused: boolean;
  outOfRange: boolean;
  isLast: boolean;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmitEditing: () => void;
};

/**
 * El `Input` de la app con su etiqueta L1–L10 dentro, a la izquierda: dice qué
 * lectura toca sin gastar una fila de etiquetas.
 */
function BrixReadingInput({
  ref,
  label,
  accessibilityLabel,
  isFocused,
  outOfRange,
  isLast,
  ...props
}: BrixReadingInputProps) {
  return (
    <View>
      <Input
        ref={ref}
        {...props}
        aria-label={accessibilityLabel}
        keyboardType="decimal-pad"
        // «Siguiente» pasa a la lectura que sigue sin cerrar el teclado; en la
        // última lo cierra.
        returnKeyType={isLast ? "done" : "next"}
        submitBehavior={isLast ? "blurAndSubmit" : "submit"}
        // Corregir una lectura es reescribirla entera, no editar un dígito.
        selectTextOnFocus
        className={cn(
          "pl-10 text-right text-lg font-medium leading-6",
          isFocused && "border-primary",
          outOfRange && "border-amber-600 bg-amber-50 text-amber-800",
        )}
        style={styles.tabular}
      />
      {/* Encima del campo pero sin tragarse el toque: tocar la etiqueta
          también tiene que enfocarlo. */}
      <View
        pointerEvents="none"
        className="absolute bottom-0 left-3 top-0 justify-center"
      >
        <Text
          className={cn(
            "text-xs font-semibold text-muted-foreground",
            isFocused && "text-primary",
          )}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
