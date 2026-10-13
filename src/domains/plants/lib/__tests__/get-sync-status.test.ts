import { getSyncStatus } from "../get-sync-status";
import { SyncStatus } from "../../types";

const estado = (overrides = {}) =>
  getSyncStatus({
    isSyncing: false,
    hasError: false,
    pendingCount: 0,
    lastSyncedAt: null,
    ...overrides,
  });

describe("getSyncStatus", () => {
  it("sin haber sincronizado nunca, lo dice", () => {
    expect(estado()).toBe(SyncStatus.unsynced);
  });

  it("con todo mandado y una sincronización hecha, está sincronizado", () => {
    expect(estado({ lastSyncedAt: 1 })).toBe(SyncStatus.synced);
  });

  it("con capturas sin mandar, pendiente", () => {
    expect(estado({ pendingCount: 2, lastSyncedAt: 1 })).toBe(
      SyncStatus.pending,
    );
  });

  // Lo que está pasando ahora gana a lo que pasó, igual que en la descarga.
  it("mientras sincroniza, eso gana a todo", () => {
    expect(estado({ isSyncing: true, pendingCount: 2 })).toBe(
      SyncStatus.syncing,
    );
    expect(estado({ isSyncing: true, hasError: true })).toBe(
      SyncStatus.syncing,
    );
  });

  it("un fallo se ve antes que lo que quedó pendiente", () => {
    expect(estado({ hasError: true, pendingCount: 2 })).toBe(SyncStatus.error);
  });
});
