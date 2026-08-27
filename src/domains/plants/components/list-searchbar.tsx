import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

interface ListSearchBarProps {
  query?: string;
  onQueryChange?: (text: string) => void;
  onCleaQuery?: () => void;
}

export function ListSearchBar({
  query,
  onQueryChange,
  onCleaQuery,
}: ListSearchBarProps) {
  return (
    <View className="flex-row items-center bg-primary-foreground/15 border border-primary-foreground/30 rounded-xl px-4">
      <Icon className="text-primary-foreground/60" size={16} as={SearchIcon} />
      <Input
        className="bg-transparent border-0 text-primary-foreground placeholder:text-primary-foreground/60 flex-shrink"
        value={query}
        onChangeText={onQueryChange}
        accessibilityLabel="Buscar plantaciones"
        placeholder="Buscar variedad, campo o cuadro, programa, patrón o año"
        keyboardType="web-search"
        autoComplete="off"
        returnKeyType="send"
        autoCapitalize="none"
        autoCorrect={false}
        cursorColor={"#ffff"}
      />
      {query && (
        <Pressable
          className="w-8 h-8 rounded-full bg-primary-foreground/15 items-center justify-center ml-auto"
          onPress={onCleaQuery}
          accessibilityRole="button"
          accessibilityLabel="Sincronizar cambios"
        >
          <Icon as={XIcon} size={16} className="text-primary-foreground" />
        </Pressable>
      )}
    </View>
  );
}
