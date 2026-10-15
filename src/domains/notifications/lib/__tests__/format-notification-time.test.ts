import { formatNotificationTime } from "../format-notification-time";

// Miércoles 14 de octubre de 2026, 12:00, en hora local.
const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const at = (month: number, day: number, hour = 12, minute = 0, year = 2026) =>
  new Date(year, month, day, hour, minute).getTime();

const format = (timestamp: number) => formatNotificationTime(timestamp, NOW);

describe("formatNotificationTime", () => {
  it("hoy es relativo: momento, minutos y horas", () => {
    expect(format(NOW - 20 * 1000)).toBe("Hace un momento");
    expect(format(NOW - 12 * 60 * 1000)).toBe("Hace 12 min");
    expect(format(NOW - 60 * 60 * 1000)).toBe("Hace 1 h");
    expect(format(NOW - 3.5 * 60 * 60 * 1000)).toBe("Hace 3 h");
  });

  it("ayer lleva la hora", () => {
    expect(format(at(9, 13, 16, 40))).toBe("Ayer, 4:40 p.m.");
  });

  it("dentro de la semana, el día y la hora", () => {
    // El domingo 11 de octubre de 2026.
    expect(format(at(9, 11, 9, 12))).toBe("Domingo, 9:12 a.m.");
  });

  it("más allá de la semana, solo la fecha", () => {
    expect(format(at(9, 8))).toBe("Jueves, 12:00 p.m."); // hace 6 días
    expect(format(at(9, 7))).toBe("7 oct"); // hace 7 días
  });

  it("de otro año, lo dice", () => {
    expect(format(at(11, 30, 12, 0, 2025))).toBe("30 dic 2025");
  });

  it("las 12 son p.m. y la medianoche, a.m. con 12", () => {
    expect(format(at(9, 13, 12, 5))).toBe("Ayer, 12:05 p.m.");
    expect(format(at(9, 13, 0, 5))).toBe("Ayer, 12:05 a.m.");
  });

  it("un instante del futuro no da «hace» negativo", () => {
    expect(format(NOW + 10 * 60 * 1000)).toBe("Hace un momento");
  });
});
