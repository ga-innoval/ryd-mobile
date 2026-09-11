import type { EvalQuestion } from "../types";

/**
 * Catálogo fijo del negocio: "5.1 Evaluación exterior". Todas las preguntas son
 * de selección única.
 *
 * Los `value` son slugs y no el texto que se muestra: si la etiqueta cambiara
 * —traducir "Yes" a "Sí", por ejemplo— las respuestas ya capturadas dejarían de
 * corresponder. Cuando exista el contrato con el backend hay que confirmar que
 * estos slugs son lo que espera recibir.
 *
 * TODO(obligatorias): falta marcar cuáles son obligatorias.
 */
export const EVALS_EXTERIOR: EvalQuestion[] = [
  {
    id: "susceptibilidad_quemaduras_sol",
    label: "Susceptibilidad a quemaduras del sol",
    options: [
      { label: "Zero", value: "zero" },
      { label: "High", value: "high" },
      { label: "Medium", value: "medium" },
      { label: "Low", value: "low" },
    ],
  },
  {
    id: "forma_racimo",
    label: "Forma de racimo",
    options: [
      { label: "Double Shoulder", value: "double_shoulder" },
      { label: "Hairy", value: "hairy" },
      { label: "Conical", value: "conical" },
      { label: "Cylindrical", value: "cylindrical" },
    ],
  },
  {
    id: "densidad_racimo",
    label: "Densidad de racimo",
    options: [
      { label: "Tight", value: "tight" },
      { label: "Slightly Tight", value: "slightly_tight" },
      { label: "Ideal", value: "ideal" },
      { label: "Straggly", value: "straggly" },
      { label: "Very Straggly", value: "very_straggly" },
    ],
  },
  {
    id: "tamano_racimo",
    label: "Tamaño de racimo",
    options: [
      { label: "Big", value: "big" },
      { label: "Ideal", value: "ideal" },
      { label: "Medium", value: "medium" },
      { label: "Small", value: "small" },
    ],
  },
  {
    id: "forma_baya",
    label: "Forma de baya",
    options: [
      { label: "Round", value: "round" },
      { label: "Ovoid", value: "ovoid" },
      { label: "Extended", value: "extended" },
    ],
  },
  {
    id: "uniformidad_tamano_bayas",
    label: "Uniformidad del tamaño de bayas",
    options: [
      { label: "Even", value: "even" },
      { label: "Uneven", value: "uneven" },
    ],
  },
  {
    id: "color_baya",
    label: "Color de baya",
    options: [
      { label: "Black", value: "black" },
      { label: "Red", value: "red" },
      { label: "Green", value: "green" },
      { label: "Dark-Red", value: "dark_red" },
    ],
  },
  {
    id: "coloracion_baya",
    label: "Coloración de baya",
    options: [
      { label: "Uniforme", value: "uniforme" },
      { label: "Desuniforme", value: "desuniforme" },
    ],
  },
  {
    id: "superficie_baya",
    label: "Superficie de la baya",
    options: [
      { label: "Clean", value: "clean" },
      { label: "Few marks", value: "few_marks" },
      { label: "Russet", value: "russet" },
      { label: "With freckles", value: "with_freckles" },
    ],
  },
  {
    id: "manchas_hoja",
    label: "Manchas causadas por hoja",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "bayas_reventadas",
    label: "Bayas reventadas o craqueadas",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "firmeza_bayas",
    label: "Firmeza de bayas",
    options: [
      { label: "Firm", value: "firm" },
      { label: "Semi firm", value: "semi_firm" },
      { label: "Soft", value: "soft" },
    ],
  },
  {
    id: "raquis",
    label: "Raquis",
    options: [
      { label: "Thin", value: "thin" },
      { label: "Ideal", value: "ideal" },
      { label: "Thick", value: "thick" },
    ],
  },
  {
    id: "pedicelo",
    label: "Pedicelo",
    options: [
      { label: "Thin", value: "thin" },
      { label: "Ideal", value: "ideal" },
      { label: "Thick", value: "thick" },
    ],
  },
  {
    id: "desgrane",
    label: "Desgrane",
    options: [
      { label: "Zero", value: "zero" },
      { label: "Low", value: "low" },
      { label: "Medium", value: "medium" },
      { label: "High", value: "high" },
    ],
  },
  {
    id: "arreglo_racimo",
    label: "Arreglo de racimo",
    options: [
      { label: "Zero", value: "zero" },
      { label: "Low", value: "low" },
      { label: "Medium", value: "medium" },
      { label: "High", value: "high" },
    ],
  },
];
