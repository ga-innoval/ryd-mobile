import type { ReactNode } from "react";
import {
  CameraIcon,
  GaugeCircleIcon,
  GrapeIcon,
  Grid3x3Icon,
  MessageSquareTextIcon,
  MicroscopeIcon,
  PipetteIcon,
  type LucideIcon,
} from "lucide-react-native";
import { EvalQuestionsForm } from "./eval-questions-form";
import { EvalPhotosForm, PhotosHeaderSummary } from "./eval-photos";
import { BrixHeaderSummary, EvalBrix } from "./eval-brix";
import { CribaHeaderSummary, EvalCriba } from "./eval-criba";
import { EvalRendimiento, RendimientoHeaderSummary } from "./eval-rendimiento";
import { ComentariosHeaderSummary, EvalComentarios } from "./eval-comentarios";
import { EVALS_EXTERIOR } from "../lib/evals-exterior";
import { EVALS_INTERIOR } from "../lib/evals-interior";
import type {
  EvaluationSectionId,
  QuestionsSectionId,
} from "../lib/evaluation-schema";
import type { EvalQuestion } from "../types";

/**
 * De qué está hecha la evaluación: las siete secciones, en orden, y qué monta
 * cada una.
 *
 * Vive aparte de la pantalla porque es lo que se abre para **agregar o cambiar
 * una sección**, y eso no tiene nada que ver con la mecánica del scroll ni con
 * el bloque de la cabecera. Es el mismo papel que `EVALS_EXTERIOR` o
 * `EVALS_POST_COSECHA`, salvo que aquí no puede vivir en `lib/`: los dos
 * despachos devuelven JSX.
 */

/**
 * Qué lleva cada sección va declarado aquí, en su `kind`, y no como un
 * `id === "..."` suelto en el render, para que esta lista siga describiendo por
 * sí sola lo que lleva cada una.
 *
 * El `id` de las que se capturan en el formulario es también su clave en
 * `evaluationSchema`, y el tipo lo obliga: una errata entre esta lista y el
 * esquema es un error de compilación, no un campo que no se guarda.
 */
export type Section = {
  icon: LucideIcon;
  title: string;
  description: string;
} & (
  | { kind: "questions"; id: QuestionsSectionId; questions: EvalQuestion[] }
  // Brix no es un catálogo de preguntas: se captura por cortes, y su avance no
  // es un porcentaje porque no tiene un número fijo de cortes.
  | { kind: "brix"; id: Extract<EvaluationSectionId, "brix"> }
  // Criba tampoco: es una tabla fija de nueve calibres, y lo que resume no es
  // un avance sino el peso de la muestra.
  | { kind: "criba"; id: Extract<EvaluationSectionId, "criba"> }
  // Rendimiento va por cosechas: los cortes que el evaluador agrega, y su
  // resumen son los kilogramos cosechados.
  | { kind: "rendimiento"; id: Extract<EvaluationSectionId, "rendimiento"> }
  // Comentarios son tres notas de texto libre, sin nada que calcular ni que
  // validar.
  | { kind: "comentarios"; id: Extract<EvaluationSectionId, "comentarios"> }
  // Las fotografías no son campos del formulario: son archivos, y viven en
  // `respuesta_fotos` con su archivo en disco. Por eso esta sección no tiene
  // clave en el esquema y su `id` solo la identifica en pantalla.
  | { kind: "photos"; id: "fotografias" }
);

/** Lo que cada sección sin preguntas enseña en el hueco del resumen de su
 *  cabecera. Las de preguntas no pasan por aquí: la suya es
 *  `EvalQuestionsHeader`, con su barra de avance. */
export function sectionSummary(
  section: Section,
  tratamientoId: string,
): ReactNode {
  switch (section.kind) {
    case "brix":
      return <BrixHeaderSummary />;
    case "criba":
      return <CribaHeaderSummary />;
    case "rendimiento":
      return <RendimientoHeaderSummary />;
    case "comentarios":
      return <ComentariosHeaderSummary />;
    case "photos":
      return <PhotosHeaderSummary tratamientoId={tratamientoId} />;
    case "questions":
      return undefined;
  }
}

/** El contenido de cada sección. Cada uno lee y escribe lo suyo del formulario
 *  —o de `respuesta_fotos`, en las fotografías—, así que solo hay que
 *  montarlo. */
export function sectionBody(
  section: Section,
  tratamientoId: string,
): ReactNode {
  switch (section.kind) {
    case "questions":
      return (
        <EvalQuestionsForm
          sectionId={section.id}
          questions={section.questions}
        />
      );
    case "brix":
      // Su estado de interfaz —qué corte está abierto— es del tratamiento; con
      // `setParams` la pantalla no se desmonta.
      return <EvalBrix key={tratamientoId} />;
    case "criba":
      return <EvalCriba />;
    case "rendimiento":
      // Como Brix, los cortes que lleva son del tratamiento: con `setParams` la
      // pantalla no se desmonta.
      return <EvalRendimiento key={tratamientoId} />;
    case "comentarios":
      return <EvalComentarios />;
    case "photos":
      return <EvalPhotosForm tratamientoId={tratamientoId} />;
  }
}

export const SECTIONS: Section[] = [
  {
    id: "fotografias",
    kind: "photos",
    icon: CameraIcon,
    title: "Fotografías",
    description: "Evidencia del racimo y de los dos cortes de la baya.",
  },
  {
    id: "exterior",
    kind: "questions",
    icon: GrapeIcon,
    title: "Evaluación Exterior",
    description: "Forma, color, firmeza y arreglo del racimo y de la baya.",
    questions: EVALS_EXTERIOR,
  },
  {
    id: "interior",
    kind: "questions",
    icon: MicroscopeIcon,
    title: "Evaluación Interior",
    description:
      "Características de la pulpa, la piel, el sabor y la experiencia de consumo.",
    questions: EVALS_INTERIOR,
  },
  {
    id: "brix",
    kind: "brix",
    icon: PipetteIcon,
    title: "Brix",
    description: "Diez lecturas de refractómetro por corte.",
  },
  {
    id: "criba",
    kind: "criba",
    icon: Grid3x3Icon,
    title: "Criba",
    description: "Peso de la muestra por calibre, del 8 al 16.",
  },
  {
    id: "rendimiento",
    kind: "rendimiento",
    icon: GaugeCircleIcon,
    title: "Rendimiento",
    description: "Kilogramos y racimos cosechados en cada corte.",
  },
  {
    id: "comentarios",
    kind: "comentarios",
    icon: MessageSquareTextIcon,
    title: "Comentarios y observaciones",
    description: "Notas del evaluador sobre la fruta y sobre la evaluación.",
  },
];

/**
 * Qué hijos del scroll se quedan fijos al llegar arriba. Van derivados y no a
 * mano porque `stickyHeaderIndices` indexa los hijos directos del contenedor:
 * el espaciador ocupa el 0 y cada sección aporta cabecera y cuerpo, así que
 * añadir una sección con índices escritos a mano descuadraría el pegado sin
 * dar ningún error.
 */
export const STICKY_HEADER_INDICES = SECTIONS.map((_, index) => 1 + index * 2);
