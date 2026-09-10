import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReactChildren } from "react-native-toast-message";

interface HeaderBase {
  children: ReactChildren;
}

export function HeaderBase({ children }: HeaderBase) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 16 }} className="bg-primary">
      <View className="flex-row items-center justify-between px-4 h-14">
        {children}
      </View>
    </View>
  );
}
