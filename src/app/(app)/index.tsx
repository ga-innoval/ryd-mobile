import { LogoutButton } from "@/domains/auth/components/logout-button";
import { EvalsList } from "@/domains/evals/components/evals-list";
import { MOCK_EVALS_DATA } from "@/domains/evals/lib/mock-data";
import { Stack } from "expo-router";
import { View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerTitle: "VitalEval",
          headerRight: () => <LogoutButton />,
          headerTintColor: "white",
          headerStyle: {
            backgroundColor: "#2d5a27",
          },
        }}
      />
      <EvalsList data={MOCK_EVALS_DATA} />
    </View>
  );
}
