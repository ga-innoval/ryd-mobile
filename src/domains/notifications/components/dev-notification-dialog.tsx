import { useSQLiteContext } from "expo-sqlite";
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
import { Text } from "@/components/ui/text";
import { toast } from "@/lib/toast";
import { getAllPlants } from "@/domains/plants/lib/db/plants.repository";
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
 * Quien lo monta tiene que protegerlo con `__DEV__`: no debe llegar a producción.
 */
export function DevNotificationDialog({
  open,
  onOpenChange,
}: DevNotificationDialogProps) {
  const db = useSQLiteContext();

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
          <AlertDialogTitle>Notificación de prueba</AlertDialogTitle>
          <AlertDialogDescription>
            Se programará un aviso para dentro de 15 segundos. Déjalo abierto
            para ver el toast, o manda la app a segundo plano para ver la
            notificación del sistema. Solo existe en desarrollo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Text>Cancelar</Text>
          </AlertDialogCancel>
          <AlertDialogAction onPress={handleSchedule}>
            <Text>Programar</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
