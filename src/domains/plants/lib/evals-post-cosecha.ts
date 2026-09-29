/**
 * Una de las cuatro evaluaciones de post-cosecha. El `id` es lo que viaja en la
 * ruta (`/postcosecha/[id]?eval=15caja`), así que **no se renombra**: cambiarlo
 * rompería los enlaces y, cuando exista, lo ya capturado.
 */
export type PostCosechaEval = {
  id: string;
  title: string;
  subtitle: string;
};

export const EVALS_POST_COSECHA: PostCosechaEval[] = [
  {
    id: "15caja",
    title: "15 días",
    subtitle: "Caja",
  },
  {
    id: "15plastico",
    title: "15 días",
    subtitle: "Plástico",
  },
  {
    id: "30caja",
    title: "30 días",
    subtitle: "Caja",
  },
  {
    id: "30plastico",
    title: "30 días",
    subtitle: "Plástico",
  },
];
