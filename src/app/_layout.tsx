import "../../global.css";
import "@/lib/nativewind-interop";

import { Slot } from "expo-router";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useEffect } from "react";
import { useAuthStore } from "@/domains/auth/store/auth-store";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SQLiteProvider } from "expo-sqlite";
import { runMigrations } from "@/lib/db/migrations";
import { Toaster } from "@/components/toaster";

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    init();
  }, []);

  return (
    // Lo más afuera posible, para que también queden dentro el portal de los
    // menús y el toaster. Lo necesita cualquier control de gesture-handler
    // fuera de un `Modal` —hoy, la cabecera de las secciones—.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="plantaciones.db" onInit={runMigrations}>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <Slot />
            {/* PortalHost Needs to be last child of your providers
      https://reactnativereusables.com/docs/installation/manual */}
            <PortalHost />
          </KeyboardProvider>
        </QueryClientProvider>
        <Toaster />
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
