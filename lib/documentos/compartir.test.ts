// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { compartirOdescargarArchivo } from "./compartir";

/**
 * En desktop, `navigator.share` (Chrome/Edge en Windows) abre la hoja de
 * compartir nativa de Windows — pero esa hoja no tiene "Guardar en el
 * equipo" (ver el comentario de `esDispositivoMovil` en compartir.ts), así
 * que ahí `compartirOdescargarArchivo` tiene que ir derecho a la descarga de
 * toda la vida, sin intentar `navigator.share` primero. En un celular sí
 * tiene que preferir compartir.
 */
describe("compartirOdescargarArchivo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubDescarga() {
    // Deja que `document.createElement("a")` sea el elemento real de jsdom
    // (así `appendChild`/`removeChild` no se quejan) — sólo se stubea
    // `click()`, que en jsdom intentaría "navegar" a la blob: URL.
    const click = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(click);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    return click;
  }

  it("en desktop (userAgentData.mobile=false) descarga directo, sin pasar por navigator.share", async () => {
    const share = vi.fn();
    vi.stubGlobal("navigator", {
      userAgentData: { mobile: false },
      share,
      canShare: () => true,
      userAgent: "Windows NT 10.0",
    });
    const click = stubDescarga();

    await compartirOdescargarArchivo(new Blob(["x"]), "Presupuesto", "application/pdf");

    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("en celular (userAgentData.mobile=true) intenta navigator.share primero", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      userAgentData: { mobile: true },
      share,
      canShare: () => true,
      userAgent: "Android",
    });
    const click = stubDescarga();

    await compartirOdescargarArchivo(new Blob(["x"]), "Presupuesto", "application/pdf");

    expect(share).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
  });

  it("sin userAgentData (Safari/iOS), usa el user agent para detectar celular", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      share,
      canShare: () => true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });
    stubDescarga();

    await compartirOdescargarArchivo(new Blob(["x"]), "Presupuesto", "application/pdf");

    expect(share).toHaveBeenCalledTimes(1);
  });
});
