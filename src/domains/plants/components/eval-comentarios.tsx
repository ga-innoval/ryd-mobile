import { useState } from "react";
import { View } from "react-native";
import { useController, useWatch } from "react-hook-form";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  COMENTARIO_FIELDS,
  countWrittenComentarios,
  type ComentarioKey,
} from "../lib/comentarios";
import type { EvaluationFormValues } from "../lib/evaluation-schema";

/**
 * Lo que la cabecera de la sección muestra en lugar de la barra de progreso:
 * cuántas notas llevan algo escrito.
 *
 * Sin barra de avance a propósito: ninguna nota es obligatoria, y una barra
 * diría que hay que llenar las tres.
 */
export function ComentariosHeaderSummary() {
  const comentarios = useWatch<EvaluationFormValues, "comentarios">({
    name: "comentarios",
  });
  const written = countWrittenComentarios(comentarios);

  return (
    <Text variant="muted">
      {written > 0
        ? `${written} de ${COMENTARIO_FIELDS.length} campos escritos`
        : ""}
    </Text>
  );
}

/**
 * Comentarios y observaciones: las notas del evaluador al cerrar la visita.
 *
 * Las tres salen del catálogo (`lib/comentarios.ts`) y son el mismo campo, así
 * que agregar una nota es tocar esa lista y nada de aquí.
 */
export function EvalComentarios() {
  // Cuál está enfocada, solo para el borde. Como en las demás secciones, es
  // estado de interfaz y no del formulario.
  const [focused, setFocused] = useState<ComentarioKey | null>(null);

  return (
    <View className="gap-4">
      {COMENTARIO_FIELDS.map(({ key, label, placeholder }) => (
        <ComentarioField
          key={key}
          name={key}
          label={label}
          placeholder={placeholder}
          isFocused={focused === key}
          onFocus={() => setFocused(key)}
          onBlur={() =>
            setFocused((current) => (current === key ? null : current))
          }
        />
      ))}
    </View>
  );
}

type ComentarioFieldProps = {
  name: ComentarioKey;
  label: string;
  placeholder: string;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
};

/** El enganche de una nota con su campo del formulario. */
function ComentarioField({
  name,
  label,
  placeholder,
  isFocused,
  onFocus,
  onBlur,
}: ComentarioFieldProps) {
  const path = `comentarios.${name}` as const;
  const { field } = useController<EvaluationFormValues, typeof path>({
    name: path,
  });

  return (
    <View className="gap-2">
      {/* Mismo tratamiento que la etiqueta de una pregunta, para que la nota se
          lea como un bloque más del formulario. */}
      <Text className="font-medium">{label}</Text>

      {/* Sin máscara ni `returnKeyType`: es texto libre, y el retorno mete un
          salto de línea, que es lo que se espera al escribir una nota. */}
      <Textarea
        value={field.value}
        onChangeText={field.onChange}
        onFocus={onFocus}
        onBlur={() => {
          field.onBlur();
          onBlur();
        }}
        placeholder={placeholder}
        aria-label={label}
        className={cn(isFocused && "border-primary")}
      />
    </View>
  );
}
