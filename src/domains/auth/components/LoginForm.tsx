import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "../hooks/useLogin";
import { Text } from "@/components/ui/text";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { mutate, isPending, error } = useLogin();

  function handleLogin() {
    mutate({ username, password }, { onSuccess: () => router.replace("/") });
  }

  return (
    <View className="flex-1 justify-center p-6 gap-4">
      <Input
        placeholder="Usuario"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <Input
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error && (
        <Text className="text-red-500">Usuario o contraseña incorrectos</Text>
      )}
      <Button onPress={handleLogin} disabled={isPending}>
        <Text>{isPending ? "Iniciando..." : "Iniciar sesión"}</Text>
      </Button>
    </View>
  );
}
