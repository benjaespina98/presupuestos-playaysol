// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { compartirArchivoYTexto, compartirOdescargarArchivo } from "./compartir";

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

  it("una imagen PNG sin extensión en el nombre se descarga como .png", async () => {
    // El plano de piscina (losetas) comparte PNG por acá desde que dejó de
    // usar html2canvas + <a download> a mano — sin esta rama, `extensionDe`
    // no reconocía "image/png" y el archivo se descargaba sin extensión.
    vi.stubGlobal("navigator", { userAgentData: { mobile: false }, userAgent: "Windows NT 10.0" });
    let nombreDescargado = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      nombreDescargado = this.download;
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    await compartirOdescargarArchivo(new Blob(["x"]), "Plano_cliente", "image/png");

    expect(nombreDescargado).toBe("Plano_cliente.png");
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

/** "Compartir" de UN proveedor desde el celular: archivo y texto, sólo texto, o descarga (iOS Safari incluido). */
describe("compartirArchivoYTexto", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const blob = () => new Blob(["%PDF-"]);

  function stubDescarga() {
    const click = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(click);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    return click;
  }

  it("si el navegador puede compartir archivos (canShare), comparte el PDF con el texto", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: (d: ShareData) => !!d.files?.length, userAgent: "iPhone" });
    const r = await compartirArchivoYTexto(blob(), "Pedido_PED-0007", "application/pdf", "Pedido a Corralón");
    expect(r).toBe("compartido");
    const datos = share.mock.calls[0][0] as ShareData;
    expect(datos.files?.[0].name).toBe("Pedido_PED-0007.pdf");
    expect(datos.files?.[0].type).toBe("application/pdf");
    expect(datos.text).toBe("Pedido a Corralón");
  });

  it("si no puede compartir archivos, comparte sólo el texto", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => false, userAgent: "iPhone" });
    const r = await compartirArchivoYTexto(blob(), "Pedido.pdf", "application/pdf", "Pedido a Corralón");
    expect(r).toBe("texto");
    expect(share).toHaveBeenCalledWith({ text: "Pedido a Corralón" });
  });

  it("si no hay hoja de compartir, descarga el archivo", async () => {
    vi.stubGlobal("navigator", { userAgent: "iPhone" });
    const click = stubDescarga();
    const r = await compartirArchivoYTexto(blob(), "Pedido.pdf", "application/pdf", "x");
    expect(r).toBe("descargado");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("si la persona cancela la hoja de compartir, no se descarga nada", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("cancelado"), { name: "AbortError" }));
    vi.stubGlobal("navigator", { share, canShare: () => true, userAgent: "iPhone" });
    const click = stubDescarga();
    const r = await compartirArchivoYTexto(blob(), "Pedido.pdf", "application/pdf", "x");
    expect(r).toBe("cancelado");
    expect(click).not.toHaveBeenCalled();
  });

  it("si la hoja falla por otro motivo (por ejemplo el gesto venció en iOS), cae a descargar", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("gesto"), { name: "NotAllowedError" }));
    vi.stubGlobal("navigator", { share, canShare: () => true, userAgent: "iPhone" });
    const click = stubDescarga();
    const r = await compartirArchivoYTexto(blob(), "Pedido.pdf", "application/pdf", "x");
    expect(r).toBe("descargado");
    expect(click).toHaveBeenCalledTimes(1);
  });
});
