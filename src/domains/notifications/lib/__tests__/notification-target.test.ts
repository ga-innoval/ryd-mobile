import type { AppNotification } from "../../types";
import { notificationTarget } from "../notification-target";

const base = { id: "n", subject: "s", body: "b", createdAt: 0, read: false };

describe("notificationTarget", () => {
  // Es lo único que lleva a una pantalla distinta de la principal, y el destino
  // son la plantación y cuál de las cuatro: con otra evaluación, el evaluador
  // abriría una que no es la que le avisaron.
  it("el recordatorio de post-cosecha lleva a su evaluación", () => {
    const notification: AppNotification = {
      ...base,
      kind: "postcosecha-reminder",
      plantId: "planta-1",
      evalId: "30plastico",
    };

    expect(notificationTarget(notification)).toEqual({
      screen: "postcosecha",
      plantId: "planta-1",
      evalId: "30plastico",
    });
  });

  it.each(["plants-download", "sync-reminder"] as const)(
    "%s se resuelve desde la pantalla principal",
    (kind) => {
      expect(notificationTarget({ ...base, kind })).toEqual({ screen: "home" });
    },
  );
});
