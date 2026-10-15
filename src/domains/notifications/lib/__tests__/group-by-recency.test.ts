import type { AppNotification } from "../../types";
import { groupByRecency, recencyBucket } from "../group-by-recency";

// Miércoles 14 de octubre de 2026, 12:00, en hora local.
const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const at = (day: number, hour = 12, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime();

const note = (id: string, createdAt: number): AppNotification => ({
  id,
  kind: "sync-reminder",
  subject: "s",
  body: "b",
  createdAt,
  read: false,
});

describe("recencyBucket", () => {
  it("el día de calendario manda, no las 24 horas", () => {
    // 11:30 p.m. de ayer: hace 12 horas y media, pero es ayer.
    expect(recencyBucket(at(13, 23, 30), NOW)).toBe("week");
    // 12:01 a.m. de hoy.
    expect(recencyBucket(at(14, 0, 1), NOW)).toBe("today");
  });

  it("la semana es corrida: seis días antes de hoy", () => {
    expect(recencyBucket(at(8), NOW)).toBe("week"); // hace 6 días
    expect(recencyBucket(at(7), NOW)).toBe("older"); // hace 7 días
  });

  it("un instante del futuro cuenta como hoy", () => {
    expect(recencyBucket(NOW + 5 * 60 * 1000, NOW)).toBe("today");
  });
});

describe("groupByRecency", () => {
  it("ordena los bloques y, dentro, de lo más reciente a lo más viejo", () => {
    const sections = groupByRecency(
      [
        note("viejo", at(1)),
        note("hoy-temprano", at(14, 8)),
        note("semana", at(10)),
        note("hoy-tarde", at(14, 11)),
      ],
      NOW,
    );

    expect(sections.map((section) => section.label)).toEqual([
      "Hoy",
      "Esta semana",
      "Anteriores",
    ]);
    expect(sections[0].items.map((item) => item.id)).toEqual([
      "hoy-tarde",
      "hoy-temprano",
    ]);
  });

  it("no devuelve bloques vacíos", () => {
    const sections = groupByRecency([note("a", at(1))], NOW);

    expect(sections).toHaveLength(1);
    expect(sections[0].bucket).toBe("older");
  });

  it("sin notificaciones no hay bloques", () => {
    expect(groupByRecency([], NOW)).toEqual([]);
  });

  it("no muta la lista que recibe", () => {
    const input = [note("a", at(10)), note("b", at(11))];
    groupByRecency(input, NOW);

    expect(input.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
