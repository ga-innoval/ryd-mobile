import { getDownloadStatus } from "../get-download-status";
import { DownloadStatus } from "../../types";

const input = (overrides = {}) => ({
  isDownloading: false,
  hasError: false,
  pendingCount: 0,
  lastDownloadAt: 1_700_000_000_000,
  ...overrides,
});

describe("getDownloadStatus", () => {
  it("marca descargada cuando ya se descargó y no hay nada pendiente", () => {
    expect(getDownloadStatus(input())).toBe(DownloadStatus.downloaded);
  });

  it("marca sin descargar cuando no hay watermark", () => {
    expect(getDownloadStatus(input({ lastDownloadAt: null }))).toBe(
      DownloadStatus.notDownloaded,
    );
  });

  it("marca pendiente cuando el servidor reporta cambios", () => {
    expect(getDownloadStatus(input({ pendingCount: 3 }))).toBe(
      DownloadStatus.pending,
    );
  });

  it("la descarga en curso gana sobre todo lo demás", () => {
    expect(
      getDownloadStatus(
        input({ isDownloading: true, hasError: true, pendingCount: 3 }),
      ),
    ).toBe(DownloadStatus.downloading);
  });

  it("el error gana sobre los pendientes", () => {
    expect(getDownloadStatus(input({ hasError: true, pendingCount: 3 }))).toBe(
      DownloadStatus.error,
    );
  });

  it("los pendientes ganan sobre el sin-descargar", () => {
    // Caso inalcanzable hoy (sin watermark no se consulta el endpoint), pero
    // fija la precedencia por si el orden se toca.
    expect(
      getDownloadStatus(input({ pendingCount: 3, lastDownloadAt: null })),
    ).toBe(DownloadStatus.pending);
  });
});
