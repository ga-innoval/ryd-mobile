import { buildPlantsDownloadNotification } from "../plants-download-notification";

describe("buildPlantsDownloadNotification", () => {
  it("nace sin leer, del tipo de descarga y con la hora de la detección", () => {
    expect(buildPlantsDownloadNotification(3, 1000)).toEqual({
      id: "plants-download:1000",
      kind: "plants-download",
      subject: "Actualizaciones por descargar",
      body: "Se detectaron cambios en 3 plantaciones.",
      createdAt: 1000,
      read: false,
    });
  });

  it("dice «1 plantación» en singular", () => {
    expect(buildPlantsDownloadNotification(1, 1).body).toBe(
      "Se detectaron cambios en 1 plantación.",
    );
  });

  // Dos detecciones son dos avisos: la bandeja descarta lo que repite id.
  it("detecciones en instantes distintos tienen ids distintos", () => {
    expect(buildPlantsDownloadNotification(2, 1).id).not.toBe(
      buildPlantsDownloadNotification(2, 2).id,
    );
  });
});
