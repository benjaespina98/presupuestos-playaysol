# Headers de seguridad y CSP

Los headers se definen en `lib/seguridad/headers.ts` y los aplica `next.config.ts`
a todas las rutas.

## Qué está activo hoy

| Header | Estado | Para qué |
|---|---|---|
| `X-Content-Type-Options: nosniff` | enforzado | El navegador no adivina tipos de archivo. |
| `Referrer-Policy: strict-origin-when-cross-origin` | enforzado | No filtra rutas completas a otros sitios. |
| `Permissions-Policy` | enforzado | Cámara, micrófono, geolocalización, pagos y USB apagados (el portal no los usa). |
| `Strict-Transport-Security: max-age=31536000` | enforzado | Obliga HTTPS un año. Sin `includeSubDomains` ni `preload` a propósito. |
| `Content-Security-Policy: frame-ancestors 'none'` | **enforzado** | Anti-clickjacking: nadie puede meter el portal en un `<iframe>`. Es lo ÚNICO que enforza la CSP. |
| `Content-Security-Policy-Report-Only: default-src 'self'; ...` | **sólo reporta** | La política completa, para validarla en uso real antes de enforzarla. |

El dominio de Supabase (`connect-src` e `img-src`) sale de
`NEXT_PUBLIC_SUPABASE_URL`; no está escrito en el código.

## Cómo ver qué rompería la CSP

1. Desplegá (o corré `npm run build && npm start`) y abrí el portal en Chrome.
2. Abrí DevTools → Consola. Cada violación aparece como
   `[Report Only] Refused to load ... because it violates the following Content Security Policy directive: ...`.
3. Recorré los flujos reales: login, las 5 calculadoras (con fotos), guardar,
   historial, catálogo, pedidos, y **descargar Word, PDF, Excel e imagen**
   (usan `blob:` y descargan fotos de Storage). Probalo también en el celular.
4. Anotá cada violación. Para cada una, decidí: ¿es legítima (se agrega la
   fuente a la directiva) o es algo que no debería estar?

Con 1–2 semanas de uso normal sin violaciones nuevas, está lista para enforzarse.

## Cómo pasarla de Report-Only a enforce

En `lib/seguridad/headers.ts`, función `headersDeSeguridad`:

1. Cambiá la clave `Content-Security-Policy-Report-Only` por
   `Content-Security-Policy`.
2. Eliminá la línea de `Content-Security-Policy: frame-ancestors 'none'`: la
   política completa ya incluye `frame-ancestors 'none'`. **Dos headers
   `Content-Security-Policy` distintos se combinan y se aplican los dos**, así
   que dejar ambos no rompe nada, pero queda redundante.
3. Actualizá `headers.test.ts` (hoy exige que la completa sea sólo Report-Only).
4. Desplegá primero en un preview y repetí el recorrido de arriba. Con
   enforce, lo bloqueado deja de funcionar de verdad: tené a mano cómo
   revertir (volver el nombre a `...-Report-Only`).

## Punto flojo conocido: `'unsafe-inline'` en `script-src`

Next inyecta scripts inline para hidratar, y una CSP estática de
`next.config.ts` no puede ponerles un nonce por request. Por eso `script-src`
lleva `'unsafe-inline'`, lo que le quita casi toda su protección contra XSS.
Para una CSP estricta hay que:

- Generar un nonce por request en `proxy.ts` y poner `script-src 'self'
  'nonce-<nonce>' 'strict-dynamic'` (guía: `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
- Ampliar el `matcher` de `proxy.ts` (hoy sólo `/dashboard`) para que cubra
  también `/login`.
- Forzar renderizado dinámico: `/login` hoy se prerenderiza estático y los
  nonces no funcionan en páginas estáticas. Tiene un costo de rendimiento.

Es un paso aparte: no se hizo acá para no cambiar cómo se renderiza el portal.
