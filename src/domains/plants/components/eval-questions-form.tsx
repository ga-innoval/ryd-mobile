import { View } from "react-native";
import { Separator } from "@/components/ui/separator";
import { OptionPicker } from "@/components/ui/option-picker";
import type { EvalAnswers, EvalQuestion } from "../types";

type EvalQuestionsFormProps = {
  questions: EvalQuestion[];
  answers: EvalAnswers;
  onAnswerChange: (questionId: string, value: string | undefined) => void;
};

/**
 * Lista de preguntas de selección única de una sección de la encuesta.
 *
 * Recibe el catálogo por props en vez de importarlo: exterior e interior solo
 * se diferencian en su contenido, así que un componente por sección serían
 * archivos idénticos salvo un import.
 *
 * Presentacional: recibe las respuestas y emite los cambios. Quién las guarda
 * —hoy estado local de la pantalla, mañana la tabla `respuestas`— es decisión
 * de quien lo monta. Ojo con el `answers`: va indexado por `id` de pregunta, y
 * los ids son únicos entre catálogos, no solo dentro de cada uno.
 */
export function EvalQuestionsForm({
  questions,
  answers,
  onAnswerChange,
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
          <OptionPicker
            label={question.label}
            options={question.options}
            value={answers[question.id]}
            onChange={(value) => onAnswerChange(question.id, value)}
          />
        </View>
      ))}
    </View>
  );
}
