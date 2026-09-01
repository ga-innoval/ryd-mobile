import * as Haptics from "expo-haptics";

// El haptic feedback es cosmético, así que el
// fallo se ignora a propósito: no debe ensuciar la consola con unhandled
// rejections ni enmascarar un error real.
const ignoreUnavailable = () => {};

export const haptics = {
  // Confirma que se registró el press de una acción importate.
  tap() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      ignoreUnavailable,
    );
  },
  // Confirman el resultado de una operación
  success() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      ignoreUnavailable,
    );
  },
  error() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      ignoreUnavailable,
    );
  },
};
