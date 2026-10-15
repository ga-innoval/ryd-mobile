import { reminderTarget } from "../reminder-target";

describe("reminderTarget", () => {
  it("lee la plantación y la evaluación del data", () => {
    expect(
      reminderTarget({ plantId: "p1", evalId: "15plastico" }),
    ).toEqual({ plantId: "p1", evalId: "15plastico" });
  });

  it("ignora lo que sobre", () => {
    expect(
      reminderTarget({ plantId: "p1", evalId: "30caja", url: "x", extra: 1 }),
    ).toEqual({ plantId: "p1", evalId: "30caja" });
  });

  // El data sale del sistema operativo sin tipo, de un aviso programado hace
  // días: lo que no encaje no puede abrir una evaluación que no es.
  it.each([
    ["sin data", undefined],
    ["nulo", null],
    ["una cadena", "p1"],
    ["un número", 7],
    ["vacío", {}],
    ["sin evaluación", { plantId: "p1" }],
    ["sin plantación", { evalId: "15caja" }],
    ["plantación vacía", { plantId: "", evalId: "15caja" }],
    ["evaluación vacía", { plantId: "p1", evalId: "" }],
    ["ids que no son texto", { plantId: 1, evalId: 2 }],
  ])("%s no abre nada", (_, data) => {
    expect(reminderTarget(data)).toBeNull();
  });
});
