import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { CalendarIcon } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatISODate, parseISODate, toISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type DateFieldProps = {
  /** La fecha en ISO (`2026-08-12`); vacía es sin fecha. */
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  placeholder?: string;
  className?: string;
};

/**
 * Un campo de fecha: se lee como un `Input` y abre el calendario del sistema.
 *
 * Es propio porque react-native-reusables no trae selector de fecha, y lo que
 * da `@react-native-community/datetimepicker` no es un campo sino el calendario
 * a secas, con dos formas distintas de aparecer: en Android es un diálogo que
 * se abre por código (`DateTimePickerAndroid.open`) y en iOS es una vista que
 * hay que montar, así que aquí va dentro de un modal con su botón de cerrar. Lo
 * único que comparten es este campo.
 */
export function DateField({
  value,
  onChange,
  accessibilityLabel,
  placeholder = "dd/mm/aaaa",
  className,
}: DateFieldProps) {
  /**
   * La fecha que se está eligiendo en el modal de iOS, y a la vez la señal de
   * que está abierto.
   *
   * Va aparte del valor del campo porque **abrir el calendario no es elegir**:
   * cuando todavía no hay fecha se abre en hoy, y el picker solo avisa cuando
   * se toca un día, así que sin este borrador confirmar sin tocar nada no
   * guardaba nada. Aquí lo guarda «Seleccionar», y tocar fuera cancela.
   */
  const [draft, setDraft] = useState<Date | null>(null);
  const date = parseISODate(value);
  const text = formatISODate(value);

  // `onValueChange` y no el `onChange` de siempre, que quedó deprecado en la
  // versión 9: este solo se dispara al elegir y ya trae la fecha, así que no
  // hay que mirar el tipo de evento.
  //
  // En Android el diálogo del sistema ya trae su aceptar y su cancelar, así que
  // lo que llega aquí es la fecha confirmada y se guarda sin más.
  const handleAndroidValueChange = (
    _event: DateTimePickerChangeEvent,
    selected: Date,
  ) => {
    onChange(toISODate(selected));
  };

  const confirmDraft = () => {
    if (draft !== null) onChange(toISODate(draft));

    setDraft(null);
  };

  const openPicker = () => {
    if (Platform.OS !== "android") {
      setDraft(date ?? new Date());
      return;
    }

    DateTimePickerAndroid.open({
      value: date ?? new Date(),
      mode: "date",
      onValueChange: handleAndroidValueChange,
    });
  };

  return (
    <>
      <Pressable
        onPress={openPicker}
        role="button"
        aria-label={accessibilityLabel}
        className={cn(
          "h-12 flex-row items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 shadow-sm shadow-black/5",
          "active:bg-secondary/50",
          className,
        )}
      >
        {/* Sin fecha se ve la plantilla del formato, que además dice en qué
            orden van los números cuando se lee la fila ya capturada. */}
        <Text
          className={cn(
            "text-lg font-medium",
            text === "" && "text-muted-foreground",
          )}
        >
          {text === "" ? placeholder : text}
        </Text>
        <Icon as={CalendarIcon} size={18} className="text-muted-foreground" />
      </Pressable>

      {draft !== null && (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setDraft(null)}
        >
          <View className="flex-1 items-center justify-center">
            {/* El fondo cierra al tocarlo y va aparte de la tarjeta, no
                envolviéndola: envolviéndola, tocar el calendario también
                cerraría. */}
            <Pressable
              className="absolute bottom-0 left-0 right-0 top-0 bg-foreground/40"
              onPress={() => setDraft(null)}
              aria-label="Cerrar el calendario"
            />
            <View className="gap-2 rounded-2xl bg-card p-4 shadow-lg shadow-black/20">
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                onValueChange={(_event, selected) => setDraft(selected)}
                accentColor="#2d5a27"
              />
              <Button variant={"secondary"} onPress={confirmDraft}>
                <Text className="text-base font-medium">Seleccionar</Text>
              </Button>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
