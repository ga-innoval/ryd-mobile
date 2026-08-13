import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { LeafIcon } from "lucide-react-native";
import { View } from "react-native";

const blurhash = "L0AmbT0c~q4s5j4-%p~B_J-W54%E";

export function LoginHero() {
  return (
    <View className="relative flex-1">
      <Image
        source={require("../../../../assets/images/vinedo.jpg")}
        placeholder={{ blurhash }}
        transition={1000}
        contentFit="cover"
        className="flex-1 w-full"
      />
      <LinearGradient
        colors={["rgba(28, 46, 26, 0.92)", "transparent"]}
        locations={[0, 0.55]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        className="absolute inset-0"
      />
      <View className="absolute inset-0 bg-green-950 opacity-50" />
      <View className="absolute inset-0 items-center justify-center">
        <View className="flex-row items-center gap-6">
          <View className="p-3 bg-white/30 rounded-full">
            <Icon as={LeafIcon} className="p-4 text-green-400" />
          </View>
          <Text variant="h1" className="text-white tracking-wide">
            Captura Experimental
          </Text>
        </View>
      </View>
    </View>
  );
}
