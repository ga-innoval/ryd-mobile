import Toast from "react-native-toast-message";

type ToastOptions = {
  title: string;
  description?: string;
  /**
   * Hace tocable el aviso. Se oculta solo al tocarlo: quien lo abre ya llegó a
   * donde el aviso mandaba, y dejarlo encima tapa lo que se acaba de abrir.
   */
  onPress?: () => void;
};

const show = (
  type: "success" | "error" | "info",
  { title, description, onPress }: ToastOptions,
) =>
  Toast.show({
    type,
    text1: title,
    text2: description,
    // **La tocabilidad va marcada aparte** y no se deduce de `onPress`: la
    // librería rellena `onPress` con una función vacía cuando no se le da
    // ninguno, así que mirar si existe diría «tocable» de todos los toasts.
    props: { tappable: onPress !== undefined },
    onPress: onPress
      ? () => {
          Toast.hide();
          onPress();
        }
      : undefined,
  });

export const toast = {
  success: (options: ToastOptions) => show("success", options),
  error: (options: ToastOptions) => show("error", options),
  info: (options: ToastOptions) => show("info", options),
};
