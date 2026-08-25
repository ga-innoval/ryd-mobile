import { useScreenOrientation } from "@/hooks/use-screen-orientation";
import { useWindowDimensions } from "react-native";

const HERO_RATIO = { landscape: 0.35, portrait: 0.4 };
const HERO_MIN = { landscape: 220, portrait: 280 };
const HERO_MAX = { landscape: 360, portrait: 480 };

export function useHeroHeight() {
  const { orientation } = useScreenOrientation();

  const { height } = useWindowDimensions();
  const raw = height * HERO_RATIO[orientation];

  return Math.min(HERO_MAX[orientation], Math.max(HERO_MIN[orientation], raw));
}
