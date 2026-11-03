# Seguridad: qué protege a qué

El navegador habla directo con Supabase usando la anon key, que es pública. **La barrera real son las reglas de la base
(RLS, permisos, triggers y CHECK)**: lo que la pantalla oculta o valida es comodidad, no seguridad.

## Lo que garantiza la base

| Qué | Dónde |
|---|---|
| Sin sesión no se lee ni se escribe ninguna tabla (`anon` no tiene permisos) | `20261103000000_endurecimiento.sql` |
| Presupuestos: sólo su autor los edita o anula | `20261021000000_baseline.sql`, `20261021000200_anulacion.sql` |
| Nada se borra: anular y desactivar, con quién y cuándo los fija el servidor | `20261021000200_anulacion.sql`, `20261021000300_desactivacion.sql` |
| Auditoría de sólo agregar | `20261021000100_auditoria.sql` |
| Stock sólo por funciones atómicas, con libro de movimientos | `20261022000100_stock_movimientos.sql` |
| `updated_by`, `created_by` y `created_at` no se pueden falsear | `20261103000000_endurecimiento.sql` |
| Precios y textos con tope (y sin `NaN`), líneas de pedido con la forma correcta | `20261103000000_endurecimiento.sql` |
| Fotos: sólo imágenes de hasta 10 MB | `20261103000000_endurecimiento.sql` |

Se prueba con `npx supabase test db` (`supabase/tests/database/`).

## Lo que NO hay (decisión pendiente)

**Roles.** Todo usuario autenticado ve costos y proveedores y puede cambiar precios, materiales y pedidos. Sirve para un
equipo chico de confianza. Si entra alguien que no deba ver costos, hay que agregar roles antes, con las policies por rol en la base (no alcanza con ocultar botones). El rol no puede vivir en `perfiles`: cada usuario puede editar su propia fila.

## Lo que hay que revisar a mano en producción

El repo no puede ver esto; cada punto se revisa en el panel de Supabase o de Vercel.

1. **Alta pública cerrada.** Es lo más importante: con el alta abierta, cualquiera se crea una cuenta y lee todo.
   ```bash
   node scripts/verificar-auth-publica.mjs
   ```
2. **Fotos no listables:** `node scripts/verificar-storage-publico.mjs`.
3. **Contraseñas:** Authentication → Passwords: mínimo 10 caracteres y "Prevent use of leaked passwords" si el plan lo permite.
4. **Copias de seguridad:** plan y PITR, y haber probado una restauración (`docs/despliegue.md`).
5. **`SHEETS_SYNC_TOKEN`:** al menos 32 caracteres al azar (`openssl rand -hex 32`). Da acceso de lectura a todos los costos.
6. **`SUPABASE_SERVICE_ROLE_KEY`:** sólo en Vercel, nunca con prefijo `NEXT_PUBLIC_`.

## Salidas de la app

- **Pedidos a proveedores:** nada de precios, teléfonos ni notas internas (`paraSalida`, con prueba en `tests/unit/pedidos-sin-datos-internos.test.ts`).
- **Fórmulas:** un texto que empieza con `= + - @` no se ejecuta ni en la planilla (`celdaParaEscribir_`) ni en el CSV (`celdaCsv`). El Excel guarda los textos como texto.
- **Logs:** nunca filas enteras, sólo id y motivo (`lib/logs.ts`).
- **Headers:** `lib/seguridad/headers.ts` y `docs/seguridad-csp.md`.
