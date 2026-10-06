// Marca de agua / isotipo de Playa y Sol. Antes esto era el PNG entero embebido
// como data URI (~37 KB de base64 en el bundle de JS, duplicado ademas en
// app/dashboard/losetas/markup.ts). Es exactamente el mismo archivo que ya vivia
// sin usarse en public/logo-mark.png, asi que ahora se sirve como imagen estatica:
// sale del JS, la cachea el navegador y la comparten el portal y las calculadoras.
export const LOGO_URL = "/logo-mark.png";

// Planilla de costos y pedidos (Google Sheets), guardada en la carpeta de Drive
// del proyecto. El catálogo web es la fuente de los precios de venta; la
// planilla es el apoyo para costos, proveedores y pedido de materiales.
export const PLANILLA_COSTOS_URL =
  "https://docs.google.com/spreadsheets/d/17GH_EoeKPUkNb7i4UjsmlWRyhZwcFVViT3zQv_8eBPE/edit";
export const CARPETA_DRIVE_URL =
  "https://drive.google.com/drive/folders/1VEttLyH8ZMBM3V92iKzeZZeKA0Bo0583";

// Datos de la empresa para los documentos formales (pedidos a proveedores).
// Son los mismos que ya figuran en el pie de los presupuestos.
export const EMPRESA = {
  nombre: "PLAYA Y SOL S.A.S.",
  direccion: "Corrientes 1210, 5900 Villa María, Córdoba",
  telefono: "0353-4531612",
  whatsapp: "3534224605",
  email: "piscinas@playaysol.com.ar",
  web: "www.playaysol.com.ar",
} as const;
