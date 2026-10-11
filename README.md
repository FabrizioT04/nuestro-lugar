# Nuestro Lugar ❤️

Aplicación privada para dos personas. React + Vite + Tailwind en el frontend, un Cloudflare Worker
(Hono) como backend y Cloudflare D1 como base de datos.

La arquitectura y las decisiones técnicas están en [ARCHITECTURE.md](./ARCHITECTURE.md).

## Requisitos

- Node.js 22 LTS (o 20+)
- Git
- Una cuenta de Cloudflare (solo para desplegar)

## Desarrollo local

```bash
npm install
cp .dev.vars.example .dev.vars      # variables locales
npm run db:migrate:local            # crea la base D1 local en .wrangler/
npm run dev                         # http://localhost:5173
```

`npm run dev` ejecuta React y el Worker juntos, dentro del mismo runtime que usa Cloudflare en
producción. La pantalla de inicio muestra "React → Worker" y "Worker → D1"; si ves ambos con ✓,
la Fase 1 funciona.

Comprobaciones rápidas:

```bash
curl http://localhost:5173/api/health      # {"status":"ok",...}
curl http://localhost:5173/api/health/db   # {"status":"ok","tables":18,...}
curl http://localhost:5173/api/no-existe   # 404 en JSON
```

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (React + Worker + D1 local) |
| `npm run build` | Verifica tipos y genera `dist/` |
| `npm run typecheck` | Solo verificación de tipos |
| `npm run preview` | Build + servidor que imita producción |
| `npm run deploy` | Build + `wrangler deploy` |
| `npm run cf-typegen` | Regenera los tipos de bindings tras cambiar `wrangler.jsonc` |
| `npm run db:migrate:local` / `:remote` | Aplica migraciones a D1 local / en Cloudflare |
| `npm run db:new-migration -- nombre` | Crea una nueva migración vacía |

## Desplegar en Cloudflare

> Recomendación: no publiques hasta terminar la Fase 2 (Access). Antes de eso la URL sería pública.

```bash
npx wrangler login
npx wrangler d1 create nuestro-lugar-db     # copia el database_id en wrangler.jsonc
npm run db:migrate:remote
npm run deploy
```

## Variables

| Nombre | Fase | Dónde |
| --- | --- | --- |
| `ENVIRONMENT` | 1 | `wrangler.jsonc` (`production`) y `.dev.vars` (`development`) |
| `ALLOWED_EMAILS`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | 2 | `wrangler secret put` |
| `GOOGLE_PLACES_API_KEY` | 10 | `wrangler secret put` |

Ningún secreto va en el frontend ni en el repositorio.
