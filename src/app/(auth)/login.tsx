import { Text } from "@/components/ui/text";
import { LoginHero } from "@/domains/auth/components/login-hero";
import { LoginForm } from "@/domains/auth/components/login-form";
import { app } from "@/lib/app-metadata";
import { View } from "react-native";

export default function LoginPage() {
  return (
    <View className="flex-1">
      <LoginHero />
      <View className="flex-1 items-center pt-12">
        <LoginForm />
      </View>
      <View className="p-6 items-center">
        <Text variant="muted">
          {app.name} {app.version} © {app.developer}
        </Text>
      </View>
    </View>
  );
}
