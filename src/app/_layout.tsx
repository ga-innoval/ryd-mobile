import "../../global.css";
import "@/lib/nativewind-interop";

import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useEffect } from "react";
import { useAuthStore } from "@/domains/auth/store/auth-store";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "@/components/toaster";

// El mismo color que el splash nativo (`app.json`): si por un cuadro no hay nada
// pintado, que se vea éste y no el blanco de la ventana. No puede importarse de
// `app.json`, así que va copiado aquí.
const SPLASH_BACKGROUND = "#f5f2eb";

// Sin esto el splash nativo se quita solo en cuanto monta el primer componente, y
// entre eso y el primer cuadro de la app —la base de datos abriéndose, la sesión
// leyéndose, el router sin estado— solo hay la ventana en blanco.
void SplashScreen.preventAutoHideAsync();

SplashScreen.setOptions({ duration: 250, fade: true });

/**
 * Quita el splash nativo cuando ya hay algo que enseñar en su lugar. Va **dentro
 * del `SQLiteProvider`**, que no pinta a sus hijos hasta que la base está abierta
 * y migrada: si se montara fuera, quitaría el splash con la base aún abriéndose,
 * que es justo el instante en blanco. Y espera a que la sesión se haya leído, que
 * es lo que decide entre el listado y el login.
 */
function SplashHider() {
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (!isLoading) SplashScreen.hide();
  }, [isLoading]);

  return null;
}

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    init();
  }, []);

  return (
    // Lo más afuera posible, para que también queden dentro el portal de los
    // menús y el toaster. Lo necesita cualquier control de gesture-handler
    // fuera de un `Modal` —hoy, la cabecera de las secciones—.
    <GestureHandlerRootView 
      style={{ flex: 1, backgroundColor: SPLASH_BACKGROUND }}
    >
      <SplashHider />
      {/* La base de datos ya no se abre aquí: es de cada usuario y se abre en
          `(app)/_layout`, que es donde se sabe quién es. */}
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <Slot />
          {/* PortalHost Needs to be last child of your providers
      https://reactnativereusables.com/docs/installation/manual */}
          <PortalHost />
        </KeyboardProvider>
      </QueryClientProvider>
      <Toaster />
    </GestureHandlerRootView>
  );
}
