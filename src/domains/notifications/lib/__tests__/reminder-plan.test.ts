import { toISODate } from "@/lib/dates";
import {
  buildDesiredReminders,
  MAX_PENDING_REMINDERS,
  planReminderChanges,
  reminderIdentifier,
  type ReminderInput,
} from "../reminder-plan";

// Jueves 15 de octubre de 2026, 10:00, en hora local.
const NOW = new Date(2026, 9, 15, 10, 0).getTime();

const input = (overrides: Partial<ReminderInput> = {}): ReminderInput => ({
  plantId: "p1",
  plantName: "518",
  evalId: "15plastico",
  fechaEmpaque: "2026-10-15",
  fechaEvaluacion: "",
  ...overrides,
});

const build = (inputs: ReminderInput[], now = NOW) =>
  buildDesiredReminders(inputs, now);

describe("buildDesiredReminders", () => {
  // El caso del encargo: empacada hoy en «15 días · Liner» → el 30 de octubre a
  // las 7:00, hora del dispositivo.
  it("programa el empaque más los días, a las 7:00 locales", () => {
    const [reminder] = build([input()]);

    expect(new Date(reminder.fireAt)).toEqual(new Date(2026, 9, 30, 7, 0));
    expect(reminder.identifier).toBe("postcosecha:p1:15plastico:2026-10-30");
  });

  it("los 30 días suman 30", () => {
    const [reminder] = build([input({ evalId: "30caja" })]);

    expect(new Date(reminder.fireAt)).toEqual(new Date(2026, 10, 14, 7, 0));
  });

  it("dice qué evaluación toca, en qué plantación y desde cuándo", () => {
    const [reminder] = build([input()]);

    expect(reminder.title).toBe("Evaluación de post-cosecha (15 díasL)");
    expect(reminder.body).toBe("Hoy toca evaluar post-cosecha en variedad 518.");
    expect(reminder.data).toEqual({ plantId: "p1", evalId: "15plastico" });
  });

  it("sin fecha de empaque no hay nada que programar", () => {
    expect(build([input({ fechaEmpaque: "" })])).toEqual([]);
  });

  it("una fecha que no es una fecha no programa nada", () => {
    expect(build([input({ fechaEmpaque: "no-es-fecha" })])).toEqual([]);
  });

  // Decisión del usuario: evaluada antes de tiempo, el aviso del día sobra.
  it("ya evaluada, el recordatorio sobra", () => {
    expect(build([input({ fechaEvaluacion: "2026-10-28" })])).toEqual([]);
  });

  it("una evaluación que no está en el catálogo no se programa", () => {
    expect(build([input({ evalId: "45caja" })])).toEqual([]);
  });

  describe("la hora que ya pasó", () => {
    // Empacada hace 15 días justos: toca hoy a las 7:00 y son las 10:00.
    it("no se programa", () => {
      expect(build([input({ fechaEmpaque: "2026-09-30" })])).toEqual([]);
    });

    it("hoy antes de las 7:00 sí", () => {
      const early = new Date(2026, 9, 15, 6, 59).getTime();
      const reminders = build([input({ fechaEmpaque: "2026-09-30" })], early);

      expect(reminders).toHaveLength(1);
    });

    it("exactamente a las 7:00 ya no", () => {
      const exact = new Date(2026, 9, 15, 7, 0).getTime();

      expect(build([input({ fechaEmpaque: "2026-09-30" })], exact)).toEqual([]);
    });
  });

  it("de la más próxima a la más lejana", () => {
    const reminders = build([
      input({ plantId: "lejos", fechaEmpaque: "2026-10-20" }),
      input({ plantId: "cerca", fechaEmpaque: "2026-10-16" }),
    ]);

    expect(reminders.map((reminder) => reminder.data.plantId)).toEqual([
      "cerca",
      "lejos",
    ]);
  });

  // iOS descarta en silencio lo que pase de 64: se quedan las más próximas.
  it("no pasa del tope de iOS y conserva las más cercanas", () => {
    const inputs = Array.from({ length: MAX_PENDING_REMINDERS + 10 }, (_, i) =>
      input({
        plantId: `p${i}`,
        // Un día más lejos cada una, dentro del mismo mes.
        fechaEmpaque: toISODate(new Date(2026, 9, 15 + (i % 14))),
      }),
    );

    const reminders = build(inputs);

    expect(reminders).toHaveLength(MAX_PENDING_REMINDERS);
    const times = reminders.map((reminder) => reminder.fireAt);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe("planReminderChanges", () => {
  const desired = build([
    input({ plantId: "a" }),
    input({ plantId: "b", evalId: "30caja" }),
  ]);
  const [a, b] = desired;

  it("lo que ya está programado no se toca", () => {
    expect(
      planReminderChanges(desired, [a.identifier, b.identifier]),
    ).toEqual({ cancel: [], schedule: [] });
  });

  it("programa lo que falta", () => {
    expect(planReminderChanges(desired, [a.identifier])).toEqual({
      cancel: [],
      schedule: [b],
    });
  });

  it("cancela lo que ya no se quiere", () => {
    const stale = reminderIdentifier("borrada", "15caja", "2026-10-30");

    expect(
      planReminderChanges(desired, [a.identifier, b.identifier, stale]),
    ).toEqual({ cancel: [stale], schedule: [] });
  });

  // Corregir la fecha de empaque cambia el identificador: sobra el viejo y
  // falta el nuevo, sin leer de vuelta el disparador del sistema.
  it("una fecha corregida cancela la vieja y programa la nueva", () => {
    const old = reminderIdentifier("a", "15plastico", "2026-10-25");

    expect(planReminderChanges([a], [old])).toEqual({
      cancel: [old],
      schedule: [a],
    });
  });

  it("no cancela lo que no es suyo", () => {
    expect(planReminderChanges([], ["otro-tipo:xyz", "sin-prefijo"])).toEqual({
      cancel: [],
      schedule: [],
    });
  });

  it("sin nada que querer, cancela todo lo suyo", () => {
    expect(planReminderChanges([], [a.identifier, b.identifier])).toEqual({
      cancel: [a.identifier, b.identifier],
      schedule: [],
    });
  });
});
