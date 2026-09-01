import "../../global.css";
import "@/lib/nativewind-interop";

import { Slot } from "expo-router";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useEffect } from "react";
import { useAuthStore } from "@/domains/auth/store/auth-store";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SQLiteProvider } from "expo-sqlite";
import { runMigrations } from "@/lib/db/migrations";
import { Toaster } from "@/components/toaster";

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    init();
  }, []);

  return (
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
  );
}
