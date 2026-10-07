import { View } from "react-native";
import { CircleCheckIcon, CircleXIcon, PackageIcon } from "lucide-react-native";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { PostCosechaEval } from "../lib/evals-post-cosecha";
import { isComplete } from "../lib/evaluation-progress";
import { CaptureChip } from "./capture-chip";

/** El fondo del renglón de post-cosecha, para que la señal de la esquina tape
 *  el borde en vez de dejarlo cruzar por detrás. Es el token `secondary`. */
const ROW_BACKGROUND = "#e8f0e6";

type PostcosechaChipProps = {
  evaluacion: PostCosechaEval;
  onPress: () => void;
  variant?: "card" | "header";
  /** Solo en la cabecera: cuál de las cuatro estás mirando. */
  isActive?: boolean;
  /** Solo en la tarjeta, de 0 a 1: es lo que la llena. */
  progress?: number;
  /** Su captura tiene un dato imposible —la fecha de evaluación anterior a la
   *  de empaque, un peso que no cuadra—. */
  hasError?: boolean;
  /** La caja ya tiene fecha de empaque: entró, aunque falte evaluarla. */
  empacada?: boolean;
};

/**
 * Una de las cuatro evaluaciones de post-cosecha, en la tarjeta de plantación o
 * en la barra de acceso rápido de la cabecera.
 *
 * **Las dos variantes casi no comparten nada y por eso van separadas**, igual
 * que en `TratamientoChip`. La de tarjeta es una captura —se llena con su avance
 * y señala en la esquina—, así que la caja se la pone `CaptureChip`, la misma
 * que usan los tratamientos. La de cabecera solo sitúa en cuál estás.
 *
 * Lo que sí es propio de las dos: **dos líneas**, días arriba y empaque debajo.
 * Es lo que la separa del chip de tratamiento, que enseña un solo dato.
 */
export function PostcosechaChip({
  evaluacion,
  onPress,
  variant = "header",
  isActive = false,
  progress = 0,
  hasError = false,
  empacada = false,
}: PostcosechaChipProps) {
  if (variant === "card") {
    // El de empaque solo mientras falte algo: para llegar al 100 % hay que
    // haber capturado la fecha, así que con el check puesto sería decir dos
    // veces lo mismo.
    const completa = isComplete(progress);
    const conEmpaque = !completa && empacada;

    return (
      <CaptureChip
        onPress={onPress}
        testID={`post-cosecha-${evaluacion.id}`}
        progress={progress}
        fillClassName={hasError ? "bg-destructive/15" : "bg-leaf/20"}
        // La misma regla que en tratamiento: **el error gana**, que una captura
        // llena con una fecha imposible no está terminada.
        badge={
          hasError
            ? {
                icon: CircleXIcon,
                className: "text-destructive",
                fill: ROW_BACKGROUND,
              }
            : completa
              ? {
                  icon: CircleCheckIcon,
                  className: "text-foreground",
                  fill: ROW_BACKGROUND,
                }
              : conEmpaque
                ? {
                    icon: PackageIcon,
                    className: "text-foreground",
                    fill: ROW_BACKGROUND,
                  }
                : undefined
        }
        accessibilityLabel={`${evaluacion.title} ${evaluacion.subtitle}`}
      >
        <Text numberOfLines={1} className="font-medium">
          {evaluacion.title}
        </Text>
        <Text numberOfLines={1} variant="muted">
          {evaluacion.subtitle}
        </Text>
      </CaptureChip>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      role="button"
      aria-label={`${evaluacion.title} ${evaluacion.subtitle}`}
      // `aria-current` y no solo el color: el resaltado es la única pista de en
      // cuál estás, y el color no llega a quien no lo ve.
      aria-current={isActive}
      className={cn(
        "w-28 items-center justify-center rounded-xl border border-primary-foreground/50 py-1",
        isActive && "border-primary-foreground/20 bg-primary-foreground/20",
      )}
    >
      <View className="items-center">
        <Text
          className={cn(
            "text-sm font-medium text-primary-foreground",
            isActive && "text-white",
          )}
        >
          {evaluacion.title}
        </Text>
        <Text className="text-xs text-primary-foreground/70">
          {evaluacion.subtitle}
        </Text>
      </View>
    </PressableScale>
  );
}
