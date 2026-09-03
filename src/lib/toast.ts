import Toast from "react-native-toast-message";

type ToastOptions = {
  title: string;
  description?: string;
};

export const toast = {
  success({ title, description }: ToastOptions) {
    Toast.show({ type: "success", text1: title, text2: description });
  },
  error({ title, description }: ToastOptions) {
    Toast.show({ type: "error", text1: title, text2: description });
  },
  info({ title, description }: ToastOptions) {
    Toast.show({ type: "info", text1: title, text2: description });
  },
};
