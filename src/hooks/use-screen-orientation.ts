import { useWindowDimensions } from "react-native";

export enum ScreenOrientation {
  LANDSCAPE = "landscape",
  PORTRAIT = "portrait",
}

export function useScreenOrientation() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return {
    orientation: isLandscape
      ? ScreenOrientation.LANDSCAPE
      : ScreenOrientation.PORTRAIT,
  };
}
