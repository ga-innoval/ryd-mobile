import { LogoutButton } from "@/domains/auth/components/logout-button";
import { View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <LogoutButton />
    </View>
  );
}
