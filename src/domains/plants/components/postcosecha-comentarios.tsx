import { useState } from "react";
import { View } from "react-native";
import { useController, useWatch } from "react-hook-form";
import { MessageSquareTextIcon } from "lucide-react-native";
import {
  CollapsibleBody,
  CollapsibleHeader,
} from "@/components/collapsible-section";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  COMENTARIO_FIELDS,
  countWrittenComentarios,
  type ComentarioKey,
} from "../lib/comentarios";
import type { PostcosechaFormValues } from "../lib/postcosecha-schema";

/**
 * Lo que la cabecera enseña en su hueco de resumen: cuántas notas llevan algo
 * escrito.
 *
 * Sin barra de avance, igual que en tratamiento: ninguna nota es obligatoria, y
 * una barra diría que hay que llenar las tres.
 */
export function PostcosechaComentariosHeaderSummary() {
  const comentarios = useWatch<PostcosechaFormValues, "comentarios">({
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
 * Las notas del evaluador sobre la caja: las mismas tres que en tratamiento y
 * con el mismo aspecto, pero **de otra encuesta**.
 *
 * Hermana de `EvalComentarios` y deliberadamente sin nada compartido con ella
 * salvo el catálogo: lo que se escribe aquí no es lo que se escribió allá, y las
 * dos viven en formularios distintos. Lo que sí sostiene que se vean igual es el
 * `Textarea` de `components/ui/`, que es de donde sale el aspecto del campo.
 *
 * Las tres salen del catálogo (`lib/comentarios.ts`), así que agregar una nota
 * es tocar esa lista y nada de aquí — en las dos encuestas a la vez, que es lo
 * que se quiere: son las mismas tres preguntas hechas en dos momentos.
 */
export function PostcosechaComentariosForm() {
  // Cuál está enfocada, solo para el borde. Como en las demás secciones, es
  // estado de interfaz y no del dato.
  const [focused, setFocused] = useState<ComentarioKey | null>(null);

  return (
    <View className="gap-4">
      {COMENTARIO_FIELDS.map(({ key, label, placeholder }) => (
        <ComentarioNota
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

type ComentarioNotaProps = {
  name: ComentarioKey;
  label: string;
  placeholder: string;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
};

/**
 * El enganche de una nota con su campo del formulario.
 *
 * Una por campo y no un controlador para las tres: aquí sí se teclea, y con un
 * solo controlador cada letra repintaría las tres cajas.
 */
function ComentarioNota({
  name,
  label,
  placeholder,
  isFocused,
  onFocus,
  onBlur,
}: ComentarioNotaProps) {
  const path = `comentarios.${name}` as const;
  const { field } = useController<PostcosechaFormValues, typeof path>({
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

/**
 * La sección entera —cabecera plegable y cuerpo—.
 *
 * **Sin `key` por evaluación**, al revés que antes: ahora quien la vacía al
 * saltar entre las cuatro es el `reset` del volcado de la pantalla.
 */
export function PostcosechaComentariosSection() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <View className="bg-background pt-4">
        <CollapsibleHeader
          icon={MessageSquareTextIcon}
          title="Comentarios y observaciones"
          description="Notas del evaluador sobre la fruta y sobre la evaluación."
          summary={<PostcosechaComentariosHeaderSummary />}
          open={open}
          onToggle={() => setOpen((value) => !value)}
        />
      </View>
      <CollapsibleBody open={open}>
        <PostcosechaComentariosForm />
      </CollapsibleBody>
    </>
  );
}
