import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
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

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <>
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
    </>
  );
}
