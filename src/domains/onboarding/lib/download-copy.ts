const plantsLabel = (count: number) =>
  count === 1 ? "1 plantación" : `${count} plantaciones`;

/**
 * El texto con que acaba la descarga del onboarding.
 *
 * **Cuenta lo que se descargó en esa petición, no lo que hay en la tablet**: la
 * descarga es incremental —trae lo que cambió desde la última vez—, así que con
 * datos previos el número es solo lo nuevo. Por eso dice «se descargaron» y no
 * «ya están en la tablet», que sería falso. Con cero tampoco asegura que no haya
 * plantaciones asignadas: dice que no hay nada nuevo.
 */
export function downloadResultBody(count: number): string {
  if (count <= 0) {
    return "Por ahora no hay plantaciones nuevas para ti. Cuando las haya, la app te avisará.";
  }

  return `Se ${count === 1 ? "descargó" : "descargaron"} ${plantsLabel(count)}. Ya puedes empezar a capturar, aunque no tengas señal.`;
}
