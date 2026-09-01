import { Pressable, View } from "react-native";
import Toast, { type ToastConfig } from "react-native-toast-message";
import { CheckIcon, XIcon, type LucideIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type ToastBodyProps = {
  icon: LucideIcon;
  badgeTextClassName: string;
  title?: string;
  description?: string;
  onClose: () => void;
};

export function ToastBody({
  icon,
  badgeTextClassName,
  title,
  description,
  onClose,
}: ToastBodyProps) {
  return (
    <View className="self-end mx-4 max-w-md sm:min-w-toast sm:max-w-xl flex-row items-center px-3 py-3 gap-3 rounded-xl bg-foreground shadow-md shadow-black/20">
      <Icon
        strokeWidth={4}
        as={icon}
        size={16}
        className={cn(badgeTextClassName, "px-3")}
      />

      {/* `shrink` es lo que hace que el texto envuelva en vez de desbordar
          la fila cuando el mensaje es largo. */}
      <View className="shrink">
        {title && (
          <Text className="text-white font-medium leading-5 text-sm">
            {title}
          </Text>
        )}
        {description && (
          <Text className="text-white/70 text-sm leading-5">{description}</Text>
        )}
      </View>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Cerrar notificación"
        className="ml-auto"
      >
        <Icon as={XIcon} size={16} className="text-white px-3" />
      </Pressable>
    </View>
  );
}

const toastConfig: ToastConfig = {
  success: ({ text1, text2, hide }) => (
    <ToastBody
      icon={CheckIcon}
      badgeTextClassName="text-green-500"
      title={text1}
      description={text2}
      onClose={() => hide()}
    />
  ),
  error: ({ text1, text2, hide }) => (
    <ToastBody
      icon={XIcon}
      badgeTextClassName="text-red-500"
      title={text1}
      description={text2}
      onClose={() => hide()}
    />
  ),
};

// Host de los toasts. Vive aquí y no en `_layout.tsx` para que cambiar de
// librería no obligue a tocar el layout raíz
export function Toaster() {
  return <Toast position="bottom" config={toastConfig} />;
}
