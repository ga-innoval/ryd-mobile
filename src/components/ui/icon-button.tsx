import { cn } from "@/lib/utils";
import { Pressable, PressableProps } from "react-native";

export function IconButton({ className, disabled, ...props }: PressableProps) {
  return (
    <Pressable
      className={cn(
        "size-8 rounded-full bg-primary-foreground/15 items-center justify-center",
        disabled ? "opacity-50" : "opacity-100",
        className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}
