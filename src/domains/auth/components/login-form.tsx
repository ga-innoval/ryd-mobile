import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginFormValues } from "../schemas";
import { useLogin } from "../hooks/useLogin";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react-native";

export function LoginForm() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });
  const { mutate, isPending, error: loginError } = useLogin();

  const onSubmit = (data: LoginFormValues) => {
    mutate(data, { onSuccess: () => router.replace("/") });
  };

  return (
    <View className="p-6 gap-6 w-2/3">
      <View className="gap-2">
        <Text className="text-green-700 tracking-widest">BIENVENIDO</Text>
        <Text variant="h3">Inicio de sesión</Text>
        <Text variant="muted">
          Ingresa tus credenciales para acceder al sistema.
        </Text>
      </View>

      {loginError && (
        <Alert
          variant="destructive"
          icon={AlertCircleIcon}
          className="border-red-300 bg-red-500/20"
        >
          <AlertTitle>{loginError.message}</AlertTitle>
        </Alert>
      )}

      <View className="gap-6">
        <View className="gap-1.5">
          <Label htmlFor="username">Nombre de usuario</Label>
          {errors.username && (
            <Text variant="muted" className="text-red-500">
              {errors.username.message}
            </Text>
          )}
          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                id="username"
                placeholder="Tu nombre de usuario"
                autoComplete="nickname"
                autoCapitalize="none"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </View>
        <View className="gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          {errors.password && (
            <Text variant="muted" className="text-red-500">
              {errors.password.message}
            </Text>
          )}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="*******"
                secureTextEntry
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </View>

        <Button onPress={handleSubmit(onSubmit)} disabled={isPending} size="lg">
          {isPending ? (
            <>
              <ActivityIndicator />
              <Text className="font-bold">Iniciando...</Text>
            </>
          ) : (
            <Text className="font-bold">Iniciar sesión</Text>
          )}
        </Button>
      </View>
    </View>
  );
}
