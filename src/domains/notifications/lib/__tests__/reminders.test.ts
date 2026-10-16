import type { SQLiteDatabase } from "expo-sqlite";
import { createInMemoryDb } from "@/test-utils/in-memory-db";
import { runMigrations } from "@/lib/db/migrations";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import type { PlantRecord } from "@/domains/plants/types";
import { upsertPlant } from "@/domains/plants/lib/db/plants.repository";
import { savePostcosechaRespuesta } from "@/domains/plants/lib/db/postcosecha-respuestas.repository";
import { buildFrutaDefaults } from "@/domains/plants/lib/postcosecha-fruta";
import { toISODate } from "@/lib/dates";
import { refreshPostcosechaReminders } from "../refresh-postcosecha-reminders";
import {
  REMINDER_PREFIX,
  reminderIdentifier,
  type DesiredReminder,
} from "../reminder-plan";
import {
  DEV_TEST_PREFIX,
  scheduleTestNotification,
  syncReminders,
} from "../reminders";

type Mocked = Record<string, jest.Mock>;
const notifications = () =>
  jest.requireMock("expo-notifications") as Mocked;

const buildRecord = (overrides: Partial<PlantRecord> = {}): PlantRecord => {
  const { tratamientos: _t, progress: _p, ...record } = buildPlant(overrides);
  return record as PlantRecord;
};

const reminder = (overrides: Partial<DesiredReminder> = {}): DesiredReminder => ({
  identifier: reminderIdentifier("p1", "15plastico", "2099-10-30"),
  fireAt: new Date(2099, 9, 30, 7, 0).getTime(),
  title: "Evaluación de post-cosecha",
  body: "cuerpo",
  data: { plantId: "p1", evalId: "15plastico" },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  const mock = notifications();
  mock.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  mock.getPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  mock.requestPermissionsAsync.mockResolvedValue({ granted: true });
});

describe("syncReminders", () => {
  it("programa lo que falta, con su identificador, su fecha y su canal", async () => {
    await syncReminders([reminder()]);

    expect(notifications().scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: "postcosecha:p1:15plastico:2099-10-30",
      content: {
        title: "Evaluación de post-cosecha",
        body: "cuerpo",
        data: { plantId: "p1", evalId: "15plastico" },
      },
      trigger: {
        type: "date",
        date: new Date(2099, 9, 30, 7, 0),
        channelId: "post-cosecha",
      },
    });
  });

  it("lo que ya está programado no se vuelve a programar", async () => {
    const existing = reminder();
    notifications().getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: existing.identifier },
    ]);

    await syncReminders([existing]);

    expect(notifications().scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(
      notifications().cancelScheduledNotificationAsync,
    ).not.toHaveBeenCalled();
  });

  it("cancela lo que sobra y no toca lo que no es suyo", async () => {
    const stale = reminderIdentifier("borrada", "15caja", "2099-10-30");
    notifications().getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: stale },
      { identifier: "otro-tipo:abc" },
    ]);

    await syncReminders([]);

    expect(
      notifications().cancelScheduledNotificationAsync,
    ).toHaveBeenCalledTimes(1);
    expect(
      notifications().cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith(stale);
  });

  describe("sin permiso", () => {
    // iOS no vuelve a preguntar: reintentar en cada guardado no molesta a nadie,
    // pero tampoco programa nada, y se calla.
    it("denegado: no programa y no insiste", async () => {
      notifications().getPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });

      await syncReminders([reminder()]);

      expect(notifications().requestPermissionsAsync).not.toHaveBeenCalled();
      expect(notifications().scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    // Cancelar no pide permiso: un aviso que ya no toca no puede sonar porque
    // el usuario desactivara las notificaciones después de programarlo.
    it("denegado: cancela igualmente lo que sobra", async () => {
      const stale = reminderIdentifier("borrada", "15caja", "2099-10-30");
      notifications().getAllScheduledNotificationsAsync.mockResolvedValue([
        { identifier: stale },
      ]);
      notifications().getPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });

      await syncReminders([]);

      expect(
        notifications().cancelScheduledNotificationAsync,
      ).toHaveBeenCalledWith(stale);
    });

    it("sin decidir: lo pide la primera vez y programa si lo dan", async () => {
      notifications().getPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      await syncReminders([reminder()]);

      expect(notifications().requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(notifications().scheduleNotificationAsync).toHaveBeenCalledTimes(
        1,
      );
    });

    it("sin decidir y lo rechaza: no programa", async () => {
      notifications().getPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });
      notifications().requestPermissionsAsync.mockResolvedValue({
        granted: false,
      });

      await syncReminders([reminder()]);

      expect(notifications().scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    // Pedir permiso sin nada que programar sería un aviso del sistema sin
    // motivo: solo se pide cuando de verdad hay algo que mandar.
    it("sin nada que programar no pide permiso", async () => {
      notifications().getPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      await syncReminders([]);

      expect(notifications().requestPermissionsAsync).not.toHaveBeenCalled();
    });
  });
});

describe("scheduleTestNotification", () => {
  it("programa para dentro del retraso, con el contenido que se le da", async () => {
    const before = Date.now();

    const scheduled = await scheduleTestNotification({
      delayMs: 15_000,
      title: "Título",
      body: "Cuerpo",
      data: { plantId: "p1", evalId: "15caja" },
    });

    expect(scheduled).toBe(true);
    const [call] = notifications().scheduleNotificationAsync.mock.calls;
    expect(call[0].content).toEqual({
      title: "Título",
      body: "Cuerpo",
      data: { plantId: "p1", evalId: "15caja" },
    });
    expect(call[0].trigger.type).toBe("date");
    expect(call[0].trigger.channelId).toBe("post-cosecha");
    const delay = call[0].trigger.date.getTime() - before;
    expect(delay).toBeGreaterThanOrEqual(15_000);
    expect(delay).toBeLessThan(16_000);
  });

  // El prefijo de los recordatorios lo cancela el repaso si no está en lo que se
  // quiere: con el mismo prefijo, el aviso de prueba se borraría solo.
  it("su identificador no cae en el prefijo que cancela el repaso", async () => {
    expect(DEV_TEST_PREFIX.startsWith(REMINDER_PREFIX)).toBe(false);

    await scheduleTestNotification({ delayMs: 1000, title: "t", body: "b" });
    const { identifier } =
      notifications().scheduleNotificationAsync.mock.calls[0][0];
    expect(identifier.startsWith(DEV_TEST_PREFIX)).toBe(true);

    notifications().getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier },
    ]);
    await syncReminders([]);

    expect(
      notifications().cancelScheduledNotificationAsync,
    ).not.toHaveBeenCalled();
  });

  it("sin permiso responde false y no programa nada", async () => {
    notifications().getPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });

    const scheduled = await scheduleTestNotification({
      delayMs: 1000,
      title: "t",
      body: "b",
    });

    expect(scheduled).toBe(false);
    expect(notifications().scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("refreshPostcosechaReminders", () => {
  let db: SQLiteDatabase;

  const guardarFruta = (fruta: Record<string, string>, evalId = "15plastico") =>
    savePostcosechaRespuesta(db, {
      plantId: "p1",
      evalId,
      seccion: "fruta",
      payload: { ...buildFrutaDefaults(), ...fruta },
      updatedAtLocal: "2026-09-29T10:00:00.000Z",
    });

  // Empacada mañana: la fecha toca a los 15 días, siempre en el futuro.
  const manana = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return toISODate(date);
  };

  beforeEach(async () => {
    db = createInMemoryDb();
    await runMigrations(db);
    await upsertPlant(db, buildRecord({ id: "p1", name: "518" }));
  });

  it("programa el recordatorio de lo que ya está empacado", async () => {
    await guardarFruta({ fecha_empaque: manana() });

    await refreshPostcosechaReminders(db);

    const [call] = notifications().scheduleNotificationAsync.mock.calls;
    expect(call[0].identifier).toMatch(/^postcosecha:p1:15plastico:\d{4}-/);
    expect(call[0].content.body).toContain("variedad 518");
  });

  it("sin nada empacado no programa nada", async () => {
    await refreshPostcosechaReminders(db);

    expect(notifications().scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  // El camino que el guardado no cubre: la fecha cambió o se borró y el aviso
  // viejo seguía vivo.
  it("la fecha borrada cancela el aviso que ya existía", async () => {
    await guardarFruta({ fecha_empaque: manana() });
    await refreshPostcosechaReminders(db);
    const scheduledId =
      notifications().scheduleNotificationAsync.mock.calls[0][0].identifier;

    notifications().getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: scheduledId },
    ]);
    await guardarFruta({ fecha_empaque: "" });
    await refreshPostcosechaReminders(db);

    expect(
      notifications().cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith(scheduledId);
  });

  // Guardar una captura no puede fallar porque un aviso no se pudo programar.
  it("nunca lanza, aunque el sistema falle", async () => {
    await guardarFruta({ fecha_empaque: manana() });
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    notifications().getAllScheduledNotificationsAsync.mockRejectedValue(
      new Error("el sistema no contesta"),
    );

    await expect(refreshPostcosechaReminders(db)).resolves.toBeUndefined();
  });

  // Dos repasos casi juntos —guardar y salir de la pantalla— no pueden
  // programar lo mismo dos veces: el segundo tiene que ver lo del primero.
  it("dos repasos seguidos se ejecutan uno detrás de otro", async () => {
    await guardarFruta({ fecha_empaque: manana() });
    const order: string[] = [];
    notifications().getAllScheduledNotificationsAsync.mockImplementation(
      async () => {
        order.push("lee");
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push("fin");
        return [];
      },
    );

    await Promise.all([
      refreshPostcosechaReminders(db),
      refreshPostcosechaReminders(db),
    ]);

    expect(order).toEqual(["lee", "fin", "lee", "fin"]);
  });
});
