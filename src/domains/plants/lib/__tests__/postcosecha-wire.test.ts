import {
  buildPostcosechaDefaults,
  postcosechaSchema,
} from "../postcosecha-schema";
import { toPostcosechaWirePayload } from "../postcosecha-wire";

const defaults = buildPostcosechaDefaults();

describe("toPostcosechaWirePayload", () => {
  describe("fruta", () => {
    it("una evaluación en blanco viaja entera, toda en null", () => {
      const wire = toPostcosechaWirePayload("fruta", defaults.fruta);
      const campos = Object.keys(postcosechaSchema.shape.fruta.shape);

      expect(Object.keys(wire!)).toHaveLength(campos.length);
      expect(Object.values(wire!).every((value) => value === null)).toBe(true);
    });

    it("las fechas en ISO, y la vacía en null", () => {
      const wire = toPostcosechaWirePayload("fruta", {
        ...defaults.fruta,
        fecha_empaque: "2026-08-12",
      });

      expect(wire).toMatchObject({
        fecha_empaque: "2026-08-12",
        fecha_evaluacion: null,
      });
    });

    // Los pesos se guardan como texto —un «8002.» a medio teclear no existe
    // como número— y es aquí donde cruzan a número. El esquema no lo hace por su
    // cuenta: `pesoSchema` es `z.string()` sin `transform`.
    it("los pesos pasan de texto a número en gramos", () => {
      const wire = toPostcosechaWirePayload("fruta", {
        ...defaults.fruta,
        peso_inicial: "8002.5",
        peso_final: "0",
        peso_bayas_reventadas: "",
      });

      expect(wire).toMatchObject({
        peso_inicial: 8002.5,
        // Se pesó y dio cero: cuenta.
        peso_final: 0,
        // No se pesó: no cuenta, y no es cero.
        peso_bayas_reventadas: null,
        peso_desgrane: null,
      });
    });

    it("los niveles viajan por su slug y las escalas como entero", () => {
      const wire = toPostcosechaWirePayload("fruta", {
        ...defaults.fruta,
        acidez: "high",
        tallo: 4,
      });

      expect(wire).toMatchObject({ acidez: "high", tallo: 4 });
    });

    // Los tres porcentajes se derivan de los cuatro pesos, así que mandarlos
    // sería mandar dos veces el mismo dato con la posibilidad de que discrepen.
    it("los tres porcentajes no viajan", () => {
      const wire = toPostcosechaWirePayload("fruta", defaults.fruta)!;

      expect(wire).not.toHaveProperty("deshidratacion");
      expect(wire).not.toHaveProperty("bayas_reventadas");
      expect(wire).not.toHaveProperty("desgrane");
    });

    it("un payload que no encaja no se manda", () => {
      expect(toPostcosechaWirePayload("fruta", { tallo: 9 })).toBeNull();
      expect(toPostcosechaWirePayload("fruta", null)).toBeNull();
    });
  });

  describe("comentarios", () => {
    it("las tres notas, tal cual", () => {
      expect(
        toPostcosechaWirePayload("comentarios", {
          positivos: "",
          negativos: "Partidura en el racimo bajo.",
          observaciones: "",
        }),
      ).toEqual({
        positivos: "",
        negativos: "Partidura en el racimo bajo.",
        observaciones: "",
      });
    });
  });
});
