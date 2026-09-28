import type { EvalQuestion } from "../types";

/**
 * Catálogo fijo del negocio: "5.1 Evaluación exterior". Todas las preguntas son
 * de selección única.
 *
 * Los `value` son slugs y no el texto que se muestra: si la etiqueta cambiara
 * —traducir "Yes" a "Sí", por ejemplo— las respuestas ya capturadas dejarían de
 * corresponder. Eso ya pasó: las etiquetas se tradujeron al español y los slugs
 * se quedaron igual, así que lo capturado antes sigue valiendo. Cuando exista el
 * contrato con el backend hay que confirmar que estos slugs son lo que espera
 * recibir.
 *
 * TODO(obligatorias): falta marcar cuáles son obligatorias.
 */
export const EVALS_EXTERIOR: EvalQuestion[] = [
  {
    id: "susceptibilidad_quemaduras_sol",
    label: "Susceptibilidad a quemaduras del sol",
    options: [
      { label: "Nula", value: "zero" },
      { label: "Baja", value: "low" },
      { label: "Media", value: "medium" },
      { label: "Alta", value: "high" },
    ],
  },
  {
    id: "forma_racimo",
    label: "Forma de racimo",
    options: [
      { label: "Doble hombro", value: "double_shoulder" },
      { label: "Ramificado", value: "hairy" },
      { label: "Cónico", value: "conical" },
      { label: "Cilíndrico", value: "cylindrical" },
    ],
  },
  {
    id: "densidad_racimo",
    label: "Densidad de racimo",
    options: [
      { label: "Ideal", value: "ideal" },
      { label: "Poco compacto", value: "slightly_tight" },
      { label: "Compacto", value: "tight" },
      { label: "Suelto", value: "straggly" },
      { label: "Muy suelto", value: "very_straggly" },
    ],
  },
  {
    id: "tamano_racimo",
    label: "Tamaño de racimo",
    options: [
      { label: "Ideal", value: "ideal" },
      { label: "Pequeño", value: "small" },
      { label: "Mediano", value: "medium" },
      { label: "Grande", value: "big" },
    ],
  },
  {
    id: "forma_baya",
    label: "Forma de baya",
    options: [
      { label: "Redonda", value: "round" },
      { label: "Ovoide", value: "ovoid" },
      { label: "Alargada", value: "extended" },
    ],
  },
  {
    id: "uniformidad_tamano_bayas",
    label: "Uniformidad del tamaño de bayas",
    options: [
      { label: "Uniforme", value: "even" },
      { label: "Desigual", value: "uneven" },
    ],
  },
  {
    id: "color_baya",
    label: "Color de baya",
    options: [
      { label: "Negro", value: "black" },
      { label: "Rojo", value: "red" },
      { label: "Verde", value: "green" },
      { label: "Rojo oscuro", value: "dark_red" },
    ],
  },
  {
    id: "coloracion_baya",
    label: "Coloración de baya",
    options: [
      { label: "Uniforme", value: "uniforme" },
      { label: "Desigual", value: "desuniforme" },
    ],
  },
  {
    id: "superficie_baya",
    label: "Superficie de la baya",
    options: [
      { label: "Limpia", value: "clean" },
      { label: "Pocas marcas", value: "few_marks" },
      { label: "Rugosidad", value: "russet" },
      { label: "Con pecas", value: "with_freckles" },
    ],
  },
  {
    id: "manchas_hoja",
    label: "Manchas causadas por hoja",
    options: [
      { label: "Sí", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "bayas_reventadas",
    label: "Bayas reventadas o craqueadas",
    options: [
      { label: "Sí", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "firmeza_bayas",
    label: "Firmeza de bayas",
    options: [
      { label: "Firme", value: "firm" },
      { label: "Semifirme", value: "semi_firm" },
      { label: "Blanda", value: "soft" },
    ],
  },
  {
    id: "raquis",
    label: "Raquis",
    options: [
      { label: "Delgado", value: "thin" },
      { label: "Ideal", value: "ideal" },
      { label: "Grueso", value: "thick" },
    ],
  },
  {
    id: "pedicelo",
    label: "Pedicelo",
    options: [
      { label: "Delgado", value: "thin" },
      { label: "Ideal", value: "ideal" },
      { label: "Grueso", value: "thick" },
    ],
  },
  {
    id: "desgrane",
    label: "Desgrane",
    options: [
      { label: "Nulo", value: "zero" },
      { label: "Bajo", value: "low" },
      { label: "Medio", value: "medium" },
      { label: "Alto", value: "high" },
    ],
  },
  {
    id: "arreglo_racimo",
    label: "Arreglo de racimo",
    options: [
      { label: "Nulo", value: "zero" },
      { label: "Bajo", value: "low" },
      { label: "Medio", value: "medium" },
      { label: "Alto", value: "high" },
    ],
  },
];
