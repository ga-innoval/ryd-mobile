import { useAuthStore } from "@/domains/auth/store/auth-store";
import {
  onboardingGate,
  type OnboardingGate,
} from "../lib/onboarding-completion";
import { useOnboardingStore } from "../store/onboarding-store";

/**
 * Si el usuario de esta sesión tiene que pasar por el onboarding antes de usar
 * la app. Lo lee `(app)/_layout`, que es el único sitio por el que se entra.
 */
export function useOnboardingGate(): OnboardingGate {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const completedIds = useOnboardingStore((state) => state.completedUserIds);
  const hydrated = useOnboardingStore((state) => state.hydrated);

  return onboardingGate({ hydrated, userId, completedIds });
}
