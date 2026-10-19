import { Pressable, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/domains/auth/store/auth-store";
import { useOnboardingStore } from "@/domains/onboarding/store/onboarding-store";
import { getAllPlants } from "@/domains/plants/lib/db/plants.repository";
import { announcePendingPlants } from "@/domains/plants/lib/announce-pending-plants";
import { scheduleTestNotification } from "../lib/reminders";

/** Lo bastante para mandar la app a segundo plano y mirar. */
const DEV_TEST_DELAY_MS = 15_000;

type DevNotificationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * **Solo en desarrollo.** Programa una notificación para dentro de 15 segundos,
 * para probar a mano las dos caras de un aviso sin esperar a que toque de
 * verdad: con la app **abierta** sale el toast, y con ella **en segundo plano** la
 * notificación del sistema. Tocar cualquiera de las dos abre la evaluación.
 *
 * El aviso imita a uno real —mismo título, mismo `data`— y apunta a la primera
 * plantación descargada, para que el toque lleve a una evaluación que existe. Sin
 * plantaciones se programa igual, solo que sin destino.
 *
 * También puede **simular el ping de descargas pendientes**.
 *
 * Quien lo monta tiene que protegerlo con `__DEV__`: no debe llegar a producción.
 */
export function DevNotificationDialog({
  open,
  onOpenChange,
}: DevNotificationDialogProps) {
  const db = useSQLiteContext();

  /** Simula que el ping encontró plantaciones por descargar, aunque no las haya:
   *  sale el mismo toast y entra el mismo aviso a la bandeja. */
  const handleSimulateDownload = () => {
    onOpenChange(false);
    announcePendingPlants(2);
  };

  /** Deja al usuario actual como si nunca hubiera visto el onboarding. El candado
   *  de `(app)/_layout` lo ve al instante y lo lleva allí. */
  const handleResetOnboarding = () => {
    onOpenChange(false);

    const userId = useAuthStore.getState().user?.id;
    if (userId) useOnboardingStore.getState().reset(userId);
  };

  const handleSchedule = async () => {
    onOpenChange(false);

    try {
      const [plant] = await getAllPlants(db);

      const scheduled = await scheduleTestNotification({
        delayMs: DEV_TEST_DELAY_MS,
        title: `Evaluación de post-cosecha (15C)`,
        body: plant
          ? `Hoy toca evaluar post-cosecha en variedad Cotton Candy`
          : "Notificación de prueba.",
        data: plant ? { plantId: plant.id, evalId: "15caja" } : undefined,
      });

      if (scheduled) {
        toast.success({
          title: "Notificación programada",
          description: "Llegará en 15 segundos.",
        });
      } else {
        toast.error({
          title: "Sin permiso de notificaciones",
          description: "Actívalas en Ajustes para probar el aviso.",
        });
      }
    } catch (error) {
      toast.error({
        title: "No se pudo programar",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Herramientas de prueba</AlertDialogTitle>
          <AlertDialogDescription>
            Elige qué simular. Solo existe en desarrollo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <View className="gap-3">
          <TestCard
            title="Notificación de post-cosecha"
            description="Simula la notificación de fecha de evaluación. Se programará en 15 segundos: con la app abierta sale el toast, y en segundo plano la notificación del sistema."
            onPress={handleSchedule}
          />
          <TestCard
            title="Reiniciar onboarding"
            description="Olvida que este usuario ya lo completó y te lleva al principio, para probarlo sin borrar la app."
            onPress={handleResetOnboarding}
          />
          <TestCard
            title="Descargas pendientes"
            description="Simula que el ping detectó plantaciones por descargar, aunque no las haya. Sale el toast y se agrega a la lista al instante."
            onPress={handleSimulateDownload}
          />
        </View>

        <AlertDialogFooter>
          <AlertDialogCancel>
            <Text>Cancelar</Text>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Una opción de la herramienta: lo que simula y qué esperar, en una tarjeta
 *  tocable. */
function TestCard({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="gap-1 rounded-xl border border-border bg-card px-4 py-3 active:bg-secondary"
    >
      <Text className="font-medium">{title}</Text>
      <Text variant="muted">{description}</Text>
    </Pressable>
  );
}
