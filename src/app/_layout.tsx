import "../../global.css";
import { Slot } from "expo-router";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useEffect } from "react";
import { useAuthStore } from "@/domains/auth/store/auth-store";

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    init();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
      {/* PortalHost Needs to be last child of your providers
      https://reactnativereusables.com/docs/installation/manual */}
      <PortalHost />
    </QueryClientProvider>
  );
}
