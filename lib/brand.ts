// Marca de agua / isotipo de Playa y Sol. Antes esto era el PNG entero embebido
// como data URI (~37 KB de base64 en el bundle de JS, duplicado ademas en
// app/dashboard/losetas/markup.ts). Es exactamente el mismo archivo que ya vivia
// sin usarse en public/logo-mark.png, asi que ahora se sirve como imagen estatica:
// sale del JS, la cachea el navegador y la comparten el portal y las calculadoras.
export const LOGO_URL = "/logo-mark.png";
