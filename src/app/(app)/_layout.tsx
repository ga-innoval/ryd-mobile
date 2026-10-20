import { useEffect, useState } from "react";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SQLiteProvider } from "expo-sqlite";
import { runMigrations } from "@/lib/db/migrations";
import { queryClient } from "@/lib/query-client";
import { databaseNameFor } from "@/lib/user-scope";
import {
  activateUserScope,
  deactivateUserScope,
} from "@/lib/activate-user-scope";
import { cancelPostcosechaReminders } from "@/domains/notifications/lib/refresh-postcosecha-reminders";
import { useAuthStore } from "@/domains/auth/store/auth-store";
import { OnboardingHost } from "@/domains/onboarding/components/onboarding-host";
import { usePendingPlantsPolling } from "@/domains/plants/hooks/use-pending-plants-polling";
import { NotificationsWatcher } from "@/domains/notifications/components/notifications-watcher";

// Debe montarse una sola vez y solo con sesión autenticada para evitar
// llamadas sin token
function PendingPlantsWatcher() {
  usePendingPlantsPolling();
  return null;
}

const Loading = () => (
  <View className="flex-1 items-center justify-center">
    <ActivityIndicator />
  </View>
);

/**
 * Todo lo que es **de un usuario**: su base de datos, sus fotografías, lo que
 * persisten sus stores y la caché de consultas.
 *
 * Se monta con `key={userId}`, así que cambiar de usuario es desmontar esto y
 * montarlo de nuevo, nunca reutilizarlo. Hasta que el scope está activo no se
 * pinta nada: un store que aún no leyó su disco enseñaría un instante lo del
 * usuario anterior —o la marca de descarga de otro, que es peor—.
 *
 * Al salir —cerrar sesión o cambiar de usuario— se vacía la caché de TanStack
 * Query, que si no serviría las plantaciones del anterior mientras se vuelve a
 * leer, y se cancelan los recordatorios, que son de lo que capturó él.
 */
function UserScope({ userId }: { userId: string }) {
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    activateUserScope(userId).then(() => {
      if (!cancelled) setReadyFor(userId);
    });

    return () => {
      cancelled = true;
      deactivateUserScope();
      queryClient.clear();
      void cancelPostcosechaReminders();
    };
  }, [userId]);

  if (readyFor !== userId) return <Loading />;

  return (
    <SQLiteProvider
      databaseName={databaseNameFor(userId)}
      onInit={runMigrations}
    >
      <PendingPlantsWatcher />
      <NotificationsWatcher />
      <OnboardingHost />
      <Stack>
        {/* La presentación tiene que conocerse al empujar la ruta, así que
            va aquí y no dentro de la pantalla, donde llegaría tarde. Las
            demás rutas siguen sin declararse. */}
        <Stack.Screen
          name="photos"
          options={{ presentation: "modal", headerShown: false }}
        />
      </Stack>
    </SQLiteProvider>
  );
}

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const userId = useAuthStore((s) => s.user?.id);

  if (isLoading) return <Loading />;
  // `init` no deja una sesión sin perfil, así que sin usuario no hay sesión.
  if (!isAuthenticated || !userId) return <Redirect href="/login" />;

  return <UserScope key={userId} userId={userId} />;
}
