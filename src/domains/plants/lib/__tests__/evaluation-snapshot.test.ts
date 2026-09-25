import { buildEvaluationDefaults } from "../evaluation-schema";
import {
  changedSecciones,
  mergeSnapshot,
  snapshotEvaluation,
} from "../evaluation-snapshot";

describe("evaluation-snapshot", () => {
  it("no ve cambios donde no los hay", () => {
    const values = buildEvaluationDefaults();

    expect(changedSecciones(values, snapshotEvaluation(values))).toEqual([]);
  });

  it("señala solo la sección que se tocó", () => {
    const guardado = snapshotEvaluation(buildEvaluationDefaults());
    const values = buildEvaluationDefaults();
    values.comentarios.positivos = "Buena uniformidad.";

    expect(changedSecciones(values, guardado)).toEqual(["comentarios"]);
  });

  it("el orden de las claves no cuenta como cambio", () => {
    const guardado = snapshotEvaluation(buildEvaluationDefaults());
    const values = buildEvaluationDefaults();
    // Lo que hace react-hook-form al reconstruir un objeto: los mismos datos
    // en otro orden. Contarlo como cambio devolvería a la cola del push una
    // sección ya sincronizada.
    values.comentarios = {
      observaciones: "",
      negativos: "",
      positivos: "",
    };

    expect(changedSecciones(values, guardado)).toEqual([]);
  });

  it("una opción deseleccionada equivale a no tenerla", () => {
    const values = buildEvaluationDefaults();
    values.exterior = { forma_racimo: undefined };

    // El catálogo deja la clave puesta en `undefined` al deseleccionar, y lo
    // guardado en JSON no la tiene.
    expect(
      changedSecciones(values, snapshotEvaluation({ ...values, exterior: {} })),
    ).toEqual([]);
  });

  it("después de guardar, lo escrito deja de contar como cambio", () => {
    const guardado = snapshotEvaluation(buildEvaluationDefaults());
    const values = buildEvaluationDefaults();
    values.comentarios.positivos = "Buena uniformidad.";
    values.exterior = { forma_racimo: "hairy" };

    const despues = mergeSnapshot(guardado, values, ["comentarios"]);

    // Comentarios se guardó; exterior no, así que sigue pendiente.
    expect(changedSecciones(values, despues)).toEqual(["exterior"]);
  });
});
