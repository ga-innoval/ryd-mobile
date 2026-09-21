import type { ComponentProps } from "react";
import { View } from "react-native";
import { useController, useWatch } from "react-hook-form";
import { CollapsibleHeader } from "@/components/collapsible-section";
import { Separator } from "@/components/ui/separator";
import { OptionPicker } from "@/components/ui/option-picker";
import { calcEvalProgress } from "../lib/calc-eval-progress";
import type {
  EvaluationFormValues,
  QuestionsSectionId,
} from "../lib/evaluation-schema";
import type { EvalQuestion } from "../types";

type EvalQuestionsFormProps = {
  /** La clave de la sección en el formulario; también su `id` en pantalla. */
  sectionId: QuestionsSectionId;
  questions: EvalQuestion[];
};

/**
 * Lista de preguntas de selección única de una sección de la encuesta.
 *
 * Recibe el catálogo por props en vez de importarlo: exterior e interior solo
 * se diferencian en su contenido, así que un componente por sección serían
 * archivos idénticos salvo un import.
 *
 * **Ya no es presentacional**: lee y escribe el formulario del contexto
 * (`FormProvider` en la pantalla), y cada pregunta se suscribe solo a su campo.
 * Así, contestar una re-renderiza esa pregunta y no la lista entera —con varias
 * secciones abiertas, antes se re-renderizaba toda la pantalla—. Lo que sí sigue
 * siendo presentacional es `OptionPicker`: el enganche con el formulario vive en
 * `QuestionField`, no en él.
 */
export function EvalQuestionsForm({
  sectionId,
  questions,
}: EvalQuestionsFormProps) {
  return (
    <View className="flex-row flex-wrap mb-4">
      {questions.map((question, index) => (
        <View
          key={question.id}
          // `grow basis-[45%]` y no `w-1/2`: dos mitades exactas más el `gap-6`
          // suman más del 100% y la segunda caería a la fila siguiente, con lo
          // que el par se vería como una columna. Pidiendo 45% caben dos y
          // crecen para repartirse lo que sobra; una tercera ya no entra.
          className={question.halfWidth ? "grow basis-[45%]" : "w-full"}
        >
          {/* Dentro de la celda y no entre celdas: en un flujo que envuelve, un
              separador suelto ocuparía su propio hueco de la fila y rompería el
              emparejamiento. La condición es la de siempre —todas menos la
              primera—, así que en las filas de una sola pregunta se ve igual
              que antes. */}
          {index > 0 && <Separator className="mb-6 mt-7" />}
          <QuestionField sectionId={sectionId} question={question} />
        </View>
      ))}
    </View>
  );
}

/** El enganche de una pregunta con su campo del formulario. */
function QuestionField({
  sectionId,
  question,
}: {
  sectionId: QuestionsSectionId;
  question: EvalQuestion;
}) {
  const { field } = useController<EvaluationFormValues>({
    name: `${sectionId}.${question.id}`,
  });

  return (
    <OptionPicker
      label={question.label}
      options={question.options}
      value={field.value as string | undefined}
      // Deseleccionar llega como `undefined`, y el esquema lo acepta: una
      // pregunta sin contestar es válida mientras no sea obligatoria.
      onChange={field.onChange}
    />
  );
}

type EvalQuestionsHeaderProps = Omit<
  ComponentProps<typeof CollapsibleHeader>,
  "progress" | "summary"
> & {
  sectionId: QuestionsSectionId;
  questions: EvalQuestion[];
};

/**
 * La cabecera de una sección de preguntas, con su avance.
 *
 * El avance sale de un `useWatch` acotado a la sección y no de la pantalla:
 * contestar re-renderiza esta cabecera, no el formulario. Es un hijo directo
 * del scroll igual que antes, así que `stickyHeaderIndices` sigue contando bien.
 *
 * TODO(respuestas): cuando se carguen de SQLite cambia el origen de los valores
 * —los `defaultValues` del formulario—, no este cálculo.
 */
export function EvalQuestionsHeader({
  sectionId,
  questions,
  ...headerProps
}: EvalQuestionsHeaderProps) {
  const answers = useWatch<EvaluationFormValues, QuestionsSectionId>({
    name: sectionId,
  });

  return (
    <CollapsibleHeader
      {...headerProps}
      progress={calcEvalProgress(questions, answers ?? {})}
    />
  );
}
