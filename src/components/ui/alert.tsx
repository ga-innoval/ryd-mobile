import { Icon } from "@/components/ui/icon";
import { Text, TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react-native";
import * as React from "react";
import { View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

const alertVariants = cva(
  "bg-card border-border relative w-full rounded-lg border px-4 pb-2 pt-3.5",
  {
    variants: {
      variant: {
        default: "",
        // El dato imposible: el promedio por baya mayor que el peso de su
        // calibre, los kilogramos sin racimos. No impide guardar —eso no se
        // toca—, pero sí que la evaluación se dé por terminada.
        destructive: "border-red-300 bg-red-300/20",
        // El aviso que no bloquea nada: el rango de Brix, el peso de la muestra
        // que no cuadra. Ámbar y no rojo porque el dato sigue contando; el rojo
        // queda para lo que no puede ser cierto.
        warning: "border-amber-600 bg-amber-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const alertIconVariants = cva("size-4", {
  variants: {
    variant: {
      default: "",
      destructive: "text-red-700",
      warning: "text-amber-700",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

/** El color que heredan los hijos del aviso; `Text` lo toma del contexto. */
const alertTextVariants = cva("text-sm text-foreground", {
  variants: {
    variant: {
      default: "",
      destructive: "text-red-800",
      warning: "text-amber-800",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const alertDescriptionVariants = cva(
  "text-muted-foreground ml-0.5 pb-1.5 pl-6 text-sm leading-relaxed",
  {
    variants: {
      variant: {
        default: "",
        destructive: "text-red-800",
        warning: "text-amber-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

/**
 * La variante llega a `AlertDescription` por contexto y no por props: quien
 * monta un aviso la declara una vez, en el `Alert`, y el color del texto sale
 * de ahí. Antes se deducía mirando si la clase heredada contenía
 * "text-destructive", que con una variante más dejaba de distinguir.
 */
const AlertVariantContext = React.createContext<AlertVariant>("default");

function Alert({
  className,
  variant = "default",
  children,
  icon,
  iconClassName,
  ...props
}: React.ComponentProps<typeof View> &
  React.RefAttributes<View> & {
    icon: LucideIcon;
    variant?: AlertVariant;
    iconClassName?: string;
  }) {
  return (
    <AlertVariantContext.Provider value={variant}>
      <TextClassContext.Provider value={alertTextVariants({ variant })}>
        <Animated.View
          entering={FadeInUp.duration(250)}
          role="alert"
          className={cn(alertVariants({ variant }), className)}
          {...props}
        >
          <View className="absolute left-3.5 top-3">
            <Icon
              as={icon}
              className={cn(alertIconVariants({ variant }), iconClassName)}
            />
          </View>
          {children}
        </Animated.View>
      </TextClassContext.Provider>
    </AlertVariantContext.Provider>
  );
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn(
        "mb-1 ml-0.5 min-h-4 pl-6 font-medium leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  const variant = React.useContext(AlertVariantContext);

  return (
    <Text
      className={cn(alertDescriptionVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
