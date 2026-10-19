import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type Tone = "leaf" | "warn" | "neutral";

/** El color de cada icono, del tema y no de hex sueltos del diseño. */
const TONE_CN: Record<Tone, { circle: string; icon: string }> = {
  leaf: { circle: "bg-leaf-background", icon: "text-primary" },
  warn: { circle: "bg-warn-background", icon: "text-warn" },
  neutral: { circle: "bg-secondary", icon: "text-primary" },
};

export type OnboardingRow = {
  icon: LucideIcon;
  text: string;
  tone?: Tone;
};

/** La tarjeta blanca con una fila por cosa que el paso explica. */
export function OnboardingCard({ rows }: { rows: OnboardingRow[] }) {
  return (
    <View className="overflow-hidden rounded-2xl bg-card py-1.5 shadow-sm shadow-black/10">
      {rows.map(({ icon, text, tone = "leaf" }, index) => (
        <View
          key={text}
          className={cn(
            "flex-row items-center gap-3.5 px-4 py-2.5",
            index > 0 && "border-t border-border",
          )}
        >
          <View
            className={cn(
              "size-9 items-center justify-center rounded-full",
              TONE_CN[tone].circle,
            )}
          >
            <Icon as={icon} size={18} className={TONE_CN[tone].icon} />
          </View>
          <Text className="flex-1 text-sm leading-5">{text}</Text>
        </View>
      ))}
    </View>
  );
}
