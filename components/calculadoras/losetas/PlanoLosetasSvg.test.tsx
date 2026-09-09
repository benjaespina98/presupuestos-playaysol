// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { calcularGeometriaPlano } from "@/lib/domain/plano/losetas";
import { PlanoLosetasSvg } from "./PlanoLosetasSvg";

/**
 * Bug real, reportado: la escalera en modo "ubicarla a mano" arranca por
 * defecto en el centro de la pileta ({x:0.5, y:0.5}) — el mismo lugar donde
 * `calcularGeometriaPlano` dibuja el texto "8 x 4 m" del editor (dims, en
 * modo compacto). Si ese texto se pinta DESPUÉS del círculo de agarre
 * (invisible, `fill="transparent"`), queda arriba en el SVG y se roba el
 * click/touch: tocar la escalera tocaba el texto, no el círculo, y no
 * arrastraba nada. Mismo riesgo para cualquier luz que termine cerca de un
 * texto de cota.
 *
 * `fireEvent.pointerDown(circulo, ...)` (como hacen los tests de
 * LosetasCalculadora) despacha DIRECTO a la referencia del elemento — no
 * pasa por hit-testing real, así que no detecta este bug. jsdom tampoco
 * calcula layout real (`elementFromPoint` no sirve acá). La única forma de
 * probarlo sin un navegador real es por ORDEN en el DOM: en SVG, sin
 * z-index, lo que se pinta último queda arriba — así que el círculo de
 * agarre tiene que aparecer DESPUÉS de los dims/leyenda en el árbol,
 * siempre, sin importar dónde caiga cada uno.
 */
describe("PlanoLosetasSvg — capa de arrastre siempre arriba", () => {
  it("el círculo de agarre de la escalera libre queda después del texto de medidas, aunque coincidan en posición", () => {
    const geometria = calcularGeometriaPlano(
      { largo: 8, ancho: 4, solar: 1, opuesto: 1, lateral1: 1, lateral2: 1, escalera: true, escaleraMovible: true, escaleraPosLibre: { x: 0.5, y: 0.5 } },
      { viewW: 680, viewHmax: 420, showDims: false, interactive: true }
    );
    const { container } = render(<PlanoLosetasSvg geometria={geometria} interactive ariaLabel="Editor" />);

    const medida = [...container.querySelectorAll("text")].find((t) => t.textContent === "8 x 4 m");
    const agarre = container.querySelector("[data-escalera]");
    expect(medida, "no se encontró el texto de medidas").toBeTruthy();
    expect(agarre, "no se encontró el círculo de agarre de la escalera").toBeTruthy();

    // DOCUMENT_POSITION_FOLLOWING (4): el agarre viene DESPUÉS del texto.
    expect(medida!.compareDocumentPosition(agarre!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("el círculo de agarre de una luz también queda después de la leyenda (plano del cliente)", () => {
    const geometria = calcularGeometriaPlano(
      { largo: 8, ancho: 4, solar: 1, opuesto: 1, lateral1: 1, lateral2: 1, luces: true, cantLuces: 1, lucesPos: [{ x: 0.5, y: 0.5 }] },
      { viewW: 1000, viewHmax: 650, showDims: true, interactive: true }
    );
    const { container } = render(<PlanoLosetasSvg geometria={geometria} interactive ariaLabel="Cliente" />);

    const referencias = [...container.querySelectorAll("text")].find((t) => t.textContent === "REFERENCIAS");
    const agarre = container.querySelector('[data-luz="0"]');
    expect(referencias).toBeTruthy();
    expect(agarre).toBeTruthy();
    expect(referencias!.compareDocumentPosition(agarre!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
