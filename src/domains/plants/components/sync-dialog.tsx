import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import {
  CircleCheckIcon,
  CircleXIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react-native";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { PlantDataFields } from "./plant-data-fields";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { syncDialogView, type SyncUnit } from "../lib/sync-progress";
import { useSyncProgressStore } from "../store/sync-progress-store";
import { useSyncStatus } from "../hooks/use-sync-status";

/** Lo alto que puede ponerse la lista antes de hacer scroll. */
const LIST_MAX_HEIGHT = 240;

/** Lo mismo que gira en `SyncButton`, y a la misma velocidad: son el mismo
 *  icono diciendo lo mismo, y dos ritmos distintos se leerían como dos cosas. */
const SPIN_MS = 800;

function SpinningIcon() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: SPIN_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  // El estilo animado va en el `Animated.View` y el color en el `Icon`: envolver
  // el propio `Icon` hace que Reanimated y NativeWind se disputen `style`.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Icon as={RefreshCwIcon} size={18} className="text-primary" />
    </Animated.View>
  );
}

/** En qué va cada plantación, a la derecha de su renglón. */
function UnitStatus({ unit }: { unit: SyncUnit }) {
  if (unit.status === "done") {
    return <Icon as={CircleCheckIcon} size={18} className="text-primary" />;
  }
  if (unit.status === "failed" || unit.status === "rejected") {
    return <Icon as={CircleXIcon} size={18} className="text-destructive" />;
  }
  if (unit.status === "blocked") {
    return <Icon as={TriangleAlertIcon} size={18} className="text-warn" />;
  }
  if (unit.status === "running") return <SpinningIcon />;

  return <View className="bg-foreground/20 size-1.5 rounded-full" />;
}

/**
 * Un renglón: una plantación de la tanda.
 *
 * **Es el encabezado de su tarjeta en pequeño**, con los cinco datos y no solo
 * el nombre: una variedad se repite entre cuadros, así que «518» por sí solo no
 * dice cuál de las dos es. Comparte la fila de datos con el listado
 * (`PlantDataFields`), para que no acaben contando cosas distintas.
 *
 * **La que está en curso se resalta con el fondo** en vez de con un color de
 * texto: en una lista de nombres parecidos, el ojo encuentra antes la franja que
 * la letra, y así el renglón sigue leyéndose igual de bien.
 */
function UnitRow({ unit, first }: { unit: SyncUnit; first: boolean }) {
  return (
    <View
      className={cn(
        "gap-1 px-3 py-2.5",
        !first && "border-border/60 border-t",
        unit.status === "running" && "bg-secondary",
        // Lo que todavía no empieza se apaga: la lista entera se ve de un golpe
        // y el ojo va a lo que está pasando.
        unit.status === "pending" && "opacity-40",
      )}
    >
      <View className="flex-row items-center gap-3">
        {/* El estado va donde la tarjeta grande pone sus chips. */}
        <Text className="shrink flex-1 font-medium leading-5">
          {unit.plant.name}
        </Text>
        <UnitStatus unit={unit} />
      </View>

      <PlantDataFields plant={unit.plant} compact />
    </View>
  );
}

/**
 * El diálogo de «sincronizar todo».
 *
 * **Un diálogo y no un aviso flotante**: la tanda dura lo que dure y el
 * evaluador tiene que poder seguirla plantación por plantación; en una tarjeta
 * al pie, la lista competía con el listado que tenía debajo. Aquí la pantalla se
 * dedica a eso mientras pasa.
 *
 * **Salir no detiene nada**, y por eso el botón dice «Seguir en segundo plano»
 * mientras sincroniza y «Cerrar» cuando ya no hay nada en marcha: la tanda es de
 * la mutation, no de esta pantalla, así que apartarla no la cancela. Lo que pasa
 * entonces se ve en el indicador de la cabecera y en los chips de las tarjetas.
 *
 * **No se cierra solo al terminar.** El resultado —cuántas salieron, cuántas se
 * quedaron— es lo que hay que leer antes de guardar la tablet, y un diálogo que
 * se va se lleva esa noticia con él.
 */
export function SyncDialog() {
  const progress = useSyncProgressStore((state) => state.progress);
  const units = useSyncProgressStore((state) => state.units);
  const dismissed = useSyncProgressStore((state) => state.dismissed);
  const dismiss = useSyncProgressStore((state) => state.dismiss);
  const { triggerSync } = useSyncStatus();

  const view = syncDialogView(progress);
  const open = view !== null && !dismissed;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <AlertDialogContent
        // Más ancho que el `sm:max-w-lg` de serie: los cinco datos de la
        // plantación son una sola fila en la tarjeta grande, y partirlos en dos
        // aquí los haría leer como dos grupos distintos.
        //
        // Blanco, al revés que el resto de diálogos: el que lleva dentro es un
        // renglón por plantación, y sobre el crema del fondo no se despegaría.
        className="bg-card sm:max-w-2xl"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{view?.title}</AlertDialogTitle>
          <AlertDialogDescription>{view?.detail}</AlertDialogDescription>
        </AlertDialogHeader>

        {view?.percent !== null && view !== null ? (
          <View className="flex-row items-center gap-4">
            <Progress
              value={view.percent}
              className="bg-secondary h-1.5 flex-1"
              indicatorClassName={
                view.tone === "warn" ? "bg-warn" : "bg-primary"
              }
              aria-label="Avance de la sincronización"
            />
            <Text className="font-bold" style={styles.tabular}>
              {`${view.percent} %`}
            </Text>
          </View>
        ) : null}

        {units.length > 0 ? (
          // En su propia tarjeta sobre el fondo del diálogo: así la lista se lee
          // como una tabla y no como más párrafos de la cabecera. El crema
          // contra el blanco de atrás, que es el reparto inverso al de las
          // tarjetas del listado — aquí el papel de «hoja» lo hace el diálogo.
          <View className="bg-background border-border overflow-hidden rounded-lg border">
            {/* `className` es el alto del propio ScrollView; el contenido va por
                su `contentContainerClassName`. Confundirlos rompe el tope. */}
            <ScrollView
              style={{ maxHeight: LIST_MAX_HEIGHT }}
              nestedScrollEnabled
            >
              {units.map((unit, index) => (
                <UnitRow key={unit.id} unit={unit} first={index === 0} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <AlertDialogFooter>
          {view?.retry ? (
            <AlertDialogAction onPress={triggerSync}>
              <Text>Reintentar</Text>
            </AlertDialogAction>
          ) : null}
          <AlertDialogCancel>
            <Text>{view?.dismissLabel}</Text>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// `tabular-nums` es de Tailwind pero NativeWind no lo traduce: sin esto el
// porcentaje baila de ancho al pasar de 9 a 10.
const styles = {
  tabular: { fontVariant: ["tabular-nums" as const] },
};
