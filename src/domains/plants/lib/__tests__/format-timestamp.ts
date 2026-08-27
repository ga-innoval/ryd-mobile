import { formatTimestamp } from "../format-timestamp";

describe("formatSyncTimestamp", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-14T15:00:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("muestra tiempo relativo si es menos de un año", () => {
    const threeDaysAgo = new Date("2026-08-11T15:00:00").getTime();
    expect(formatTimestamp(threeDaysAgo)).toBe("hace 3 días");
  });

  it("muestra fecha dd/MM/yyyy si es exactamente un año o más", () => {
    const oneYearAgo = new Date("2025-08-13T15:00:00").getTime();
    expect(formatTimestamp(oneYearAgo)).toBe("13 ago 2025");
  });

  it("usa tiempo relativo justo por debajo del límite de un año", () => {
    const almostOneYear = new Date("2025-08-15T15:00:00").getTime();
    expect(formatTimestamp(almostOneYear)).toContain("hace");
  });
});
