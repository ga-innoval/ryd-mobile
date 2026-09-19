import { NativeOnlyAnimatedView } from "@/components/ui/native-only-animated-view";
import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import * as DropdownMenuPrimitive from "@rn-primitives/dropdown-menu";
import * as React from "react";
import { Platform, StyleSheet } from "react-native";
import { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";

/**
 * Menú contextual sobre `@rn-primitives/dropdown-menu`, con el mismo montaje
 * que `popover.tsx`: portal, overlay a pantalla completa y `FullWindowOverlay`
 * en iOS para que no quede por debajo de nada.
 *
 * Recortado a lo que usamos —raíz, disparador, contenido e item—; el primitivo
 * trae además grupos, submenús y items de selección si hicieran falta.
 *
 * **El disparador se puede abrir por ref** (`ref.current.open()`), que además
 * mide su posición. Es lo que permite colgar el menú de un gesto que no sea su
 * propio `onPress`.
 */
const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const FullWindowOverlay =
  Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

function DropdownMenuContent({
  className,
  align = "center",
  sideOffset = 4,
  portalHost,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  portalHost?: string;
}) {
  return (
    <DropdownMenuPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <DropdownMenuPrimitive.Overlay
          style={Platform.select({ native: StyleSheet.absoluteFill })}
          asChild={Platform.OS !== "web"}
        >
          <NativeOnlyAnimatedView
            entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.reduceMotion(ReduceMotion.System)}
            as="Pressable"
          >
            <TextClassContext.Provider value="text-popover-foreground">
              <DropdownMenuPrimitive.Content
                align={align}
                sideOffset={sideOffset}
                className={cn(
                  "bg-popover border-border z-50 min-w-40 overflow-hidden rounded-md border p-1 shadow-md shadow-black/5",
                  className,
                )}
                {...props}
              />
            </TextClassContext.Provider>
          </NativeOnlyAnimatedView>
        </DropdownMenuPrimitive.Overlay>
      </FullWindowOverlay>
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  /** `destructive` tiñe el texto y el icono, como la acción de borrar. */
  variant?: "default" | "destructive";
}) {
  return (
    <TextClassContext.Provider
      value={cn("font-medium", variant === "destructive" && "text-destructive")}
    >
      <DropdownMenuPrimitive.Item
        className={cn(
          "flex-row items-center gap-2 rounded-sm px-3 py-2.5",
          "active:bg-secondary",
          props.disabled && "opacity-50",
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
};
