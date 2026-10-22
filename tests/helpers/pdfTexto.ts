import { inflateSync } from "node:zlib";

/** Texto de un PDF: se inflan sus streams y se juntan los textos mostrados (literales y hexadecimales). */
export function textoDePdf(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const out: string[] = [];
  let i = 0;
  for (;;) {
    const ini = buf.indexOf("stream", i, "latin1");
    if (ini === -1) break;
    const fin = buf.indexOf("endstream", ini, "latin1");
    if (fin === -1) break;
    const desde = buf[ini + 6] === 0x0d ? ini + 8 : ini + 7;
    try {
      const txt = inflateSync(buf.subarray(desde, fin)).toString("latin1");
      // react-pdf escribe cada renglón como [<hex> 110 <hex> ...] TJ (con ajustes de kerning entre piezas).
      for (const m of txt.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
        let renglon = "";
        for (const p of m[1].matchAll(/<([0-9a-fA-F]*)>|\(((?:[^()\\]|\\.)*)\)/g)) {
          renglon += p[1] !== undefined ? Buffer.from(p[1], "hex").toString("latin1") : p[2];
        }
        out.push(renglon);
      }
    } catch {
      /* no es un stream comprimido */
    }
    i = fin + 9;
  }
  return out.join("\n");
}
