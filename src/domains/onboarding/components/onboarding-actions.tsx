import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

/**
 * El botón grande de cada paso: el mismo `Button` `lg` del login, sin tamaño ni
 * esquinas propios. Antes llevaba un `h-12 rounded-full` a mano —con un `sm:h-12`
 * para vencer al `sm:h-9` del componente— y se veía distinto al resto de la app.
 */
export function PrimaryAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      onPress={onPress}
      // **Nunca `undefined`.** El botón de la última página no recibía `disabled`
      // mientras los de las dos primeras sí (`busy`), y como React reutiliza la
      // misma vista al cambiar de página, la prop pasaba de `false` a `undefined`:
      // en Android el botón dejaba de responder salvo justo sobre su texto.
      // Probado en la tablet: con `false` explícito responde en toda su área.
      disabled={disabled ?? false}
      size="lg"
      accessibilityLabel={label}
    >
      <Text className="font-bold">{label}</Text>
    </Button>
  );
}

/**
 * «Ahora no» y «Más tarde»: avanzan sin pedir nada. El mismo botón `outline` que
 * el «Cancelar» de los diálogos, con su texto por defecto.
 */
export function SecondaryAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Button className="bg-backround" variant="secondary" onPress={onPress}>
      <Text>{label}</Text>
    </Button>
  );
}
