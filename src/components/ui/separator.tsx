import { cn } from '@/lib/utils';
import * as SeparatorPrimitive from '@rn-primitives/separator';
import { StyleSheet } from 'react-native';

/**
 * El grosor va por `style` y no por un `h-[1px]` de Tailwind.
 *
 * 1dp casi nunca es un número entero de píxeles físicos en Android: a densidad
 * 2.75 son 2.75px, y el renderer redondea el borde superior e inferior de la
 * vista a la rejilla, así que el grosor dibujado sale
 * `round((y + alto) × d) − round(y × d)` — 2 o 3 píxeles según dónde caiga la
 * línea. Por eso unos separadores se veían más gruesos que otros dentro del
 * mismo formulario: la posición de cada uno depende de lo que tenga encima.
 *
 * `hairlineWidth` está calculado para que `alto × densidad` sea un entero, y
 * con eso el redondeo deja de depender de la posición: sumar un entero desplaza
 * por igual los dos bordes. Lo dice la propia doc de React Native — "siempre
 * será un número redondo de píxeles, para que la línea se vea nítida".
 */
const styles = StyleSheet.create({
  horizontal: { height: StyleSheet.hairlineWidth },
  vertical: { width: StyleSheet.hairlineWidth },
});

function Separator({
  className,
  style,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'w-full' : 'h-full',
        className
      )}
      // El `style` de quien lo use va al final para que siga pudiendo mandar.
      style={[
        orientation === 'horizontal' ? styles.horizontal : styles.vertical,
        style,
      ]}
      {...props}
    />
  );
}

export { Separator };
