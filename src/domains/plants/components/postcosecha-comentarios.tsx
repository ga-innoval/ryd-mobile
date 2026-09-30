import { useState } from "react";
import { View } from "react-native";
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
  createComentarios,
  type ComentarioKey,
} from "../lib/comentarios";

/** Las tres notas de **esta** encuesta. */
type Comentarios = Record<ComentarioKey, string>;

/**
 * Lo que la cabecera enseña en su hueco de resumen: cuántas notas llevan algo
 * escrito.
 *
 * Sin barra de avance, igual que en tratamiento: ninguna nota es obligatoria, y
 * una barra diría que hay que llenar las tres.
 */
export function PostcosechaComentariosHeaderSummary({
  values,
}: {
  values: Comentarios;
}) {
  const written = countWrittenComentarios(values);

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
 * dos secciones no se hablan. Lo que sí sostiene que se vean igual es el
 * `Textarea` de `components/ui/`, que es de donde sale el aspecto del campo.
 *
 * Las tres salen del catálogo (`lib/comentarios.ts`), así que agregar una nota
 * es tocar esa lista y nada de aquí — en las dos encuestas a la vez, que es lo
 * que se quiere: son las mismas tres preguntas hechas en dos momentos.
 */
export function PostcosechaComentariosForm({
  values,
  onChange,
}: {
  values: Comentarios;
  onChange: (values: Comentarios) => void;
}) {
  // Cuál está enfocada, solo para el borde. Como en las demás secciones, es
  // estado de interfaz y no del dato.
  const [focused, setFocused] = useState<ComentarioKey | null>(null);

  const set = (key: ComentarioKey, value: string) =>
    onChange({ ...values, [key]: value });

  return (
    <View className="gap-4">
      {COMENTARIO_FIELDS.map(({ key, label, placeholder }) => (
        <View key={key} className="gap-2">
          {/* Mismo tratamiento que la etiqueta de una pregunta, para que la
              nota se lea como un bloque más del formulario. */}
          <Text className="font-medium">{label}</Text>

          {/* Sin máscara ni `returnKeyType`: es texto libre, y el retorno mete
              un salto de línea, que es lo que se espera al escribir una nota. */}
          <Textarea
            value={values[key]}
            onChangeText={(text) => set(key, text)}
            onFocus={() => setFocused(key)}
            onBlur={() =>
              setFocused((current) => (current === key ? null : current))
            }
            placeholder={placeholder}
            aria-label={label}
            className={cn(focused === key && "border-primary")}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * La sección entera —cabecera plegable y cuerpo—, con su estado.
 *
 * Junta las dos porque la cabecera enseña cuántas notas llevan algo escrito y
 * el cuerpo es quien lo cambia: separarlas obligaría a subir el estado a la
 * pantalla, que no tiene nada que hacer con él.
 *
 * Quien la monta le pone `key={evalId}`: **lo escrito es de esta evaluación**,
 * no de la siguiente. Hoy además se pierde al salir, porque post-cosecha
 * todavía no persiste —igual que la evaluación de fruta—. Cuando llegue, este
 * `useState` pasa a ser el `defaultValues` de un `react-hook-form` y lo demás
 * se queda igual.
 */
export function PostcosechaComentariosSection() {
  const [values, setValues] = useState<Comentarios>(createComentarios);
  const [open, setOpen] = useState(true);

  return (
    <>
      <View className="bg-background pt-4">
        <CollapsibleHeader
          icon={MessageSquareTextIcon}
          title="Comentarios y observaciones"
          description="Notas del evaluador sobre la fruta y sobre la evaluación."
          summary={<PostcosechaComentariosHeaderSummary values={values} />}
          open={open}
          onToggle={() => setOpen((value) => !value)}
        />
      </View>
      <CollapsibleBody open={open}>
        <PostcosechaComentariosForm values={values} onChange={setValues} />
      </CollapsibleBody>
    </>
  );
}
