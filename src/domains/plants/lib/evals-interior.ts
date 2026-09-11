import type { EvalQuestion } from "../types";

/**
 * Catálogo fijo del negocio: "Evaluación interior". Todas las preguntas son de
 * selección única.
 *
 * Mismas reglas que `evals-exterior.ts`: los `value` son slugs y no el texto
 * visible, para que cambiar una etiqueta no invalide las respuestas ya
 * capturadas, y falta confirmarlos contra el contrato del backend cuando
 * exista.
 *
 * Los `id` tienen que ser únicos **entre secciones**, no solo dentro de esta:
 * la pantalla guarda todas las respuestas en un único record indexado por `id`,
 * así que un id repetido en exterior compartiría valor en silencio.
 *
 * TODO(obligatorias): falta marcar cuáles son obligatorias.
 */
export const EVALS_INTERIOR: EvalQuestion[] = [
  {
    id: "acidez",
    label: "Acidez",
    options: [
      { label: "Zero", value: "zero" },
      { label: "Low", value: "low" },
      { label: "Medium", value: "medium" },
      { label: "High", value: "high" },
    ],
  },
  {
    id: "textura",
    label: "Textura",
    options: [
      { label: "Crunchy", value: "crunchy" },
      { label: "Juicy", value: "juicy" },
      { label: "Soft", value: "soft" },
      { label: "Jelly", value: "jelly" },
    ],
  },
  {
    id: "sabor",
    label: "Sabor",
    options: [
      { label: "Neutral", value: "neutral" },
      { label: "Neutral sweet", value: "neutral_sweet" },
      { label: "Fruit", value: "fruit" },
      { label: "Tropical fruit", value: "tropical_fruit" },
      { label: "Foxy", value: "foxy" },
      { label: "Labrusca", value: "labrusca" },
      { label: "Moscatel", value: "moscatel" },
    ],
  },
  {
    id: "intensidad_sabor",
    label: "Intensidad del sabor",
    options: [
      { label: "Prominent", value: "prominent" },
      { label: "Neutral", value: "neutral" },
      { label: "Without flavor", value: "without_flavor" },
    ],
  },
  {
    id: "traza_semilla",
    label: "Traza de semilla",
    options: [
      { label: "Without trace", value: "without_trace" },
      { label: "With perceptible trace", value: "with_perceptible_trace" },
      { label: "With imperceptible trace", value: "with_imperceptible_trace" },
      { label: "Seed", value: "seed" },
    ],
  },
  {
    id: "textura_piel",
    label: "Textura de la piel",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Thin", value: "thin" },
      { label: "Thick", value: "thick" },
    ],
  },
  {
    id: "sabor_piel",
    label: "Sabor de la piel",
    options: [
      { label: "Neutral", value: "neutral" },
      { label: "Without flavor", value: "without_flavor" },
      { label: "Sweet", value: "sweet" },
      { label: "Acid", value: "acid" },
    ],
  },
  {
    id: "intensidad_sabor_piel",
    label: "Intensidad del sabor de la piel",
    options: [
      { label: "Prominent", value: "prominent" },
      { label: "Neutral", value: "neutral" },
      { label: "Without flavor", value: "without_flavor" },
    ],
  },
  {
    id: "calidad_comerla",
    label: "Calidad al comerla",
    options: [
      { label: "Excellent", value: "excellent" },
      { label: "More than good", value: "more_than_good" },
      { label: "Good", value: "good" },
      { label: "Acceptable", value: "acceptable" },
      { label: "Poor", value: "poor" },
    ],
  },
  {
    id: "pincel",
    label: "Pincel",
    options: [
      { label: "Short", value: "short" },
      { label: "Medium", value: "medium" },
      { label: "Large", value: "large" },
    ],
  },
];
