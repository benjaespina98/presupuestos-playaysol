# Presupuestos Playa y Sol

Portal interno para generar y gestionar presupuestos del negocio familiar de piscinas (Playa y Sol S.A.S., Villa María, Córdoba). Reemplaza un flujo anterior de calculadoras HTML sueltas, cada una con su propio guardado local, por un sistema centralizado con login, historial de presupuestos por cliente y persistencia real en base de datos.

## Qué resuelve

El negocio cotiza cinco tipos de trabajo (piscinas, revestimientos, cobertores, cercos y losetas perimetrales), cada uno con su propia lógica de cálculo de materiales y m². Antes, cada presupuesto se armaba en una calculadora HTML aislada y se guardaba en el disco de quien la usaba — sin historial compartido, sin forma de que dos personas vean los mismos presupuestos, y con riesgo de perder información si se borraba el archivo local.

Este proyecto centraliza las cinco calculadoras en un solo portal con:

- Login con usuario y contraseña (sin registro público — los usuarios se crean manualmente)
- Guardado de cada presupuesto en base de datos, asociado al cliente y a quien lo generó
- Historial filtrable por tipo de trabajo, reabrible para editar o volver a exportar
- Exportación a imagen/PDF para enviar al cliente, separada de la vista interna con precios

## Stack

- **Next.js 16** (App Router) — Server Components para todo lo que lee datos, Client Components solo donde hace falta interactividad
- **Supabase** — Postgres con Row Level Security, autenticación y storage de archivos
- **TypeScript**
- **Tailwind CSS**
- **Vercel** — deploy automático desde `master`, previews automáticos por rama

## Arquitectura

```
app/
├── login/                          Autenticación
└── dashboard/
    ├── layout.tsx                  Guarda de sesión + cromo del portal
    ├── page.tsx                    Selección de calculadora
    ├── historial/                  Historial centralizado (las 5 calculadoras)
    └── <tipo>/                     piscinas | revestimientos | cobertores | cercos | losetas
        └── page.tsx                Carga el componente React de la calculadora
components/calculadoras/<tipo>/     Formulario (React Hook Form + Zod), documento/editor
                                     y motor de dominio de cada calculadora
public/
└── seeds/                          Fotos de ejemplo precargadas
lib/
├── presupuestos.ts                 Lectura/escritura de presupuestos
├── catalogo.ts                     Catálogo y textos compartidos por el equipo
├── domain/                         Motores de precio y de dibujo, puros — sin DOM ni React
├── supabase.ts                     Cliente de browser
└── supabase-server.ts              Cliente de servidor
proxy.ts                            Protege /dashboard/* — redirige a /login sin sesión
supabase/*.sql                      Esquema y migraciones (el orden importa, ver schema.sql)
```

### Las 5 calculadoras son React (Fase 5, completa)

Las 5 calculadoras vinieron originalmente de un flujo de archivos HTML sueltos,
JavaScript vanilla que buscaba sus elementos por `#id` y hablaba con la app de
Next a través de un puñado de funciones colgadas de `window`. La Fase 5 migró
las cinco, una por una, a componentes React (`components/calculadoras/<tipo>/`)
sobre motores de dominio puros (`lib/domain/precios/`, `lib/domain/plano/`) —
sin DOM, sin `window`, testeables en milisegundos. Losetas ("Plano de Piscina")
fue la última: a diferencia de las otras cuatro no genera un documento con
líneas de precio sino un editor SVG interactivo (luces arrastrables, colores,
espejo de agua) exportado a PNG.

Cada motor de dominio quedó verificado contra la aritmética/geometría del
código legacy que reemplazó (`lib/domain/precios/contra-oraculo.test.ts` y los
tests de cada motor), así que un cambio de UI no puede desviar silenciosamente
un cálculo de precios.

La tabla `presupuestos` guarda el estado completo de cada cálculo como JSON (`datos jsonb`), en vez de modelar una tabla distinta por tipo de trabajo. Esto evita cinco esquemas paralelos para cinco calculadoras con campos parecidos pero no idénticos, a costa de no poder hacer queries SQL finas sobre campos internos — un trade-off razonable para el volumen de uso de un negocio de este tamaño.

La seguridad no depende de que el código sea privado: cualquier lectura o escritura sobre `presupuestos` pasa por Row Level Security en Postgres, exigiendo un usuario autenticado. El repositorio puede ser público sin exponer datos de clientes.

## Cómo correrlo local

```bash
npm install
cp .env.local.example .env.local
# completar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Requiere un proyecto de Supabase con los archivos de `supabase/` ya aplicados **en
orden** (`schema.sql` → `migration_catalogo_items.sql` →
`migration_perfiles_ownership.sql` → `migration_limpieza.sql`) y al menos un
usuario creado manualmente en Authentication → Users (no hay registro público).

## Tests

```bash
npx playwright test tests/assets.spec.ts    # sin credenciales: peso, assets y contrato DOM
E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e   # flujo completo con login real
```

## Flujo de trabajo

Desarrollo en `develop`, merge a `master` vía pull request. Cada push a `develop` genera un preview deployment en Vercel; el merge a `master` dispara el deploy de producción.