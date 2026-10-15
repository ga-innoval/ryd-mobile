import { useNotificationsReadStore } from "../notifications-read-store";

describe("useNotificationsReadStore", () => {
  beforeEach(() => {
    useNotificationsReadStore.setState({ readIds: new Set() });
  });

  it("marca una como leída", () => {
    useNotificationsReadStore.getState().markRead("n1");

    expect(useNotificationsReadStore.getState().readIds.has("n1")).toBe(true);
  });

  // Una referencia nueva repintaría a todos los que escuchan —la campana
  // incluida— sin que haya cambiado nada.
  it("marcar una ya leída no cambia la referencia", () => {
    useNotificationsReadStore.getState().markRead("n1");
    const before = useNotificationsReadStore.getState().readIds;

    useNotificationsReadStore.getState().markRead("n1");

    expect(useNotificationsReadStore.getState().readIds).toBe(before);
  });

  it("marcar todas suma a lo que ya estaba leído", () => {
    useNotificationsReadStore.getState().markRead("n1");
    useNotificationsReadStore.getState().markAllRead(["n2", "n3"]);

    expect([...useNotificationsReadStore.getState().readIds].sort()).toEqual([
      "n1",
      "n2",
      "n3",
    ]);
  });
});
