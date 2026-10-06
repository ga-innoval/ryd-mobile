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
        destructive: "border-destructive/20 bg-destructive-background",
        // El aviso que no bloquea nada: el rango de Brix, el peso de la muestra
        // que no cuadra. Ámbar y no rojo porque el dato sigue contando; el rojo
        // queda para lo que no puede ser cierto.
        warning: "border-warn/20 bg-warn-background",
        // Algo que salió bien. No la usa ningún aviso del formulario —ahí no
        // hay nada que celebrar a media captura—; existe para el toast, que sí
        // tiene que decir que la descarga terminó. Sale de los tokens que ya
        // hay: el verde claro de `secondary` con el verde de la app encima.
        success: "border-leaf/20 bg-leaf-background",
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
      destructive: "text-destructive",
      warning: "text-warn",
      success: "text-primary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

/** El color que heredan los hijos del aviso; `Text` lo toma del contexto. */
const alertTextVariants = cva("text-sm text-foreground font-medium", {
  variants: {
    variant: {
      default: "",
      destructive: "text-destructive",
      warning: "text-amber-800",
      success: "text-primary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

/**
 * El color del cuerpo, **aparte del sangrado**.
 *
 * Partido en dos porque el toast usa estos mismos colores con otra disposición:
 * allí el icono es un hermano en la fila y no hay bajo qué sangrar, así que
 * heredar el `pl-6` le dejaría el texto descolgado.
 */
const alertDescriptionColorVariants = cva("", {
  variants: {
    variant: {
      default: "text-muted-foreground",
      destructive: "text-destructive",
      warning: "text-amber-800",
      success: "text-primary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

/** El sangrado del cuerpo, que es igual en las cuatro variantes: deja sitio al
 *  icono, que va absoluto a la izquierda. */
const ALERT_DESCRIPTION_CN = "ml-0.5 pb-1.5 pl-6 text-sm leading-relaxed";

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
          <View className="absolute left-3.5 top-0 bottom-0 items-center justify-center">
            <Icon
              as={icon}
              className={cn(alertIconVariants({ variant }), iconClassName)}
              strokeWidth={2.4}
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
      className={cn(
        ALERT_DESCRIPTION_CN,
        alertDescriptionColorVariants({ variant }),
        className,
      )}
      {...props}
    />
  );
}

export {
  Alert,
  AlertDescription,
  AlertTitle,
  // Las variantes salen fuera para que el toast se pinte con ellas en vez de con
  // una copia: son el mismo vocabulario —esto va mal, esto es raro, esto salió
  // bien— y dos copias acaban diciéndolo con dos rojos distintos.
  alertVariants,
  alertIconVariants,
  alertTextVariants,
  alertDescriptionColorVariants,
  type AlertVariant,
};
