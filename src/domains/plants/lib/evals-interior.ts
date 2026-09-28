import type { EvalQuestion } from "../types";

/**
 * Catálogo fijo del negocio: "Evaluación interior". Todas las preguntas son de
 * selección única.
 *
 * Mismas reglas que `evals-exterior.ts`: los `value` son slugs y no el texto
 * visible, para que cambiar una etiqueta no invalide las respuestas ya
 * capturadas, y falta confirmarlos contra el contrato del backend cuando
 * exista. Las etiquetas ya se tradujeron al español una vez sin tocar los slugs,
 * que es justo para lo que están.
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
      { label: "Nula", value: "zero" },
      { label: "Baja", value: "low" },
      { label: "Media", value: "medium" },
      { label: "Alta", value: "high" },
    ],
  },
  {
    id: "textura",
    label: "Textura",
    options: [
      { label: "Blanda", value: "soft" },
      { label: "Crujiente", value: "crunchy" },
      { label: "Jugosa", value: "juicy" },
      { label: "Gelatinosa", value: "jelly" },
    ],
  },
  {
    id: "sabor",
    label: "Sabor",
    options: [
      { label: "Neutro", value: "neutral" },
      { label: "Neutro dulce", value: "neutral_sweet" },
      { label: "Frutal", value: "fruit" },
      { label: "Frutal tropical", value: "tropical_fruit" },
      { label: "Foxy", value: "foxy" },
      { label: "Labrusca", value: "labrusca" },
      { label: "Moscatel", value: "moscatel" },
    ],
  },
  {
    id: "intensidad_sabor",
    label: "Intensidad del sabor",
    options: [
      { label: "Neutro", value: "neutral" },
      { label: "Sin sabor", value: "without_flavor" },
      { label: "Pronunciado", value: "prominent" },
    ],
  },
  {
    id: "traza_semilla",
    label: "Traza de semilla",
    options: [
      { label: "Nula", value: "without_trace" },
      { label: "Imperceptible", value: "with_imperceptible_trace" },
      { label: "Perceptible", value: "with_perceptible_trace" },
      { label: "Semilla", value: "seed" },
    ],
  },
  {
    id: "textura_piel",
    label: "Textura de la piel",
    options: [
      { label: "Delgada", value: "thin" },
      { label: "Normal", value: "normal" },
      { label: "Gruesa", value: "thick" },
    ],
  },
  {
    id: "sabor_piel",
    label: "Sabor de la piel",
    options: [
      { label: "Neutro", value: "neutral" },
      { label: "Sin sabor", value: "without_flavor" },
      { label: "Dulce", value: "sweet" },
      { label: "Ácido", value: "acid" },
    ],
  },
  {
    id: "intensidad_sabor_piel",
    label: "Intensidad del sabor de la piel",
    options: [
      { label: "Neutro", value: "neutral" },
      { label: "Sin sabor", value: "without_flavor" },
      { label: "Pronunciado", value: "prominent" },
    ],
  },
  {
    id: "calidad_comerla",
    label: "Calidad al comerla",
    options: [
      { label: "Mala", value: "poor" },
      { label: "Aceptable", value: "acceptable" },
      { label: "Buena", value: "good" },
      { label: "Muy buena", value: "more_than_good" },
      { label: "Excelente", value: "excellent" },
    ],
  },
  {
    id: "pincel",
    label: "Pincel",
    options: [
      { label: "Corto", value: "short" },
      { label: "Medio", value: "medium" },
      { label: "Largo", value: "large" },
    ],
  },
];
