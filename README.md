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
producción.

En local no hay Cloudflare Access delante, así que la app actúa como si hubieras entrado con
`DEV_USER_EMAIL` (en `.dev.vars`). Cambia ese valor y reinicia `npm run dev` para probar:

- el correo de tu pareja → entra a la misma relación;
- un correo que no esté en `ALLOWED_EMAILS` → pantalla "Este lugar es privado".

Para empezar de cero (borrar la base local): borra la carpeta `.wrangler/` y vuelve a ejecutar
`npm run db:migrate:local`.

Comprobaciones rápidas:

```bash
curl http://localhost:5173/api/health      # {"status":"ok",...}
curl http://localhost:5173/api/health/db   # {"status":"ok","tables":18,...}
curl http://localhost:5173/api/me          # tu usuario y la relación
curl http://localhost:5173/api/no-existe   # 404 en JSON
```

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (React + Worker + D1 local) |
| `npm run build` | Verifica tipos y genera `dist/` |
| `npm run typecheck` | Solo verificación de tipos |
| `npm test` | Pruebas unitarias (JWT de Access, whitelist, validaciones) |
| `npm run preview` | Build + servidor que imita producción |
| `npm run deploy` | Build + `wrangler deploy` |
| `npm run cf-typegen` | Regenera los tipos de bindings tras cambiar `wrangler.jsonc` |
| `npm run db:migrate:local` / `:remote` | Aplica migraciones a D1 local / en Cloudflare |
| `npm run db:new-migration -- nombre` | Crea una nueva migración vacía |

## Desplegar en Cloudflare

Sigue la guía paso a paso: [docs/configurar-access.md](./docs/configurar-access.md)
(base de datos, deploy, Google, Cloudflare Access y secretos).

Desde la Fase 4 también hace falta el bucket privado de fotos (una sola vez):

```bash
npx wrangler r2 bucket create nuestro-lugar-media
npm run db:migrate:remote
```

En local no hace falta crear nada: `npm run dev` simula R2 dentro de `.wrangler/`.

## Fotos

- El navegador comprime cada foto (máx. 1920 px, miniatura de 480 px, WebP o JPEG). Al redibujarla
  se pierden los metadatos EXIF, incluida la ubicación GPS.
- El Worker comprueba el tipo real por los primeros bytes (no por la extensión), limita el tamaño
  (8 MB la foto, 1 MB la miniatura) y 60 subidas por minuto por persona.
- El bucket es privado. Las fotos se piden a `/api/media/:id`, que comprueba que pertenecen a
  vuestra relación. Las claves de R2 las genera el Worker.
- D1 solo guarda metadatos; nunca la imagen.

## Variables

| Nombre | Fase | Dónde |
| --- | --- | --- |
| `ENVIRONMENT` | 1 | `wrangler.jsonc` (`production`) y `.dev.vars` (`development`) |
| `ALLOWED_EMAILS` | 2 | `.dev.vars` y `wrangler secret put` |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | 2 | `wrangler secret put` (no hacen falta en local) |
| `DEV_USER_EMAIL` | 2 | Solo `.dev.vars` (nunca en producción) |
| `GOOGLE_PLACES_API_KEY` | 10 | `wrangler secret put` |

Ningún secreto va en el frontend ni en el repositorio.
