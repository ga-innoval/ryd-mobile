import { Fragment } from "react";
import { View } from "react-native";
import { Separator } from "@/components/ui/separator";
import { OptionPicker } from "@/components/ui/option-picker";
import type { EvalQuestion } from "../types";

export type EvalAnswers = Record<string, string | undefined>;

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
    <View className="gap-6">
      {questions.map((question, index) => (
        <Fragment key={question.id}>
          {/* Entre preguntas y no antes de la primera: el `gap-6` del
              contenedor le da aire por ambos lados. */}
          {index > 0 && <Separator />}
          <OptionPicker
            label={question.label}
            options={question.options}
            value={answers[question.id]}
            onChange={(value) => onAnswerChange(question.id, value)}
          />
        </Fragment>
      ))}
    </View>
  );
}
