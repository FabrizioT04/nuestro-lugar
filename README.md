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

## Cartas

- Cuatro tipos: **carta** (se abre ya), **Ábreme cuando…** (se abre cuando la otra persona lo necesite),
  **programada** (se ve el sobre cerrado con la fecha) y **sorpresa** (no aparece hasta su fecha).
- El destinatario siempre es la otra persona; el Worker lo decide, no el navegador.
- La fecha y hora de apertura se interpretan en la zona horaria de la pareja y se guardan en UTC.
- Antes de esa fecha el Worker no envía el contenido al destinatario, y una sorpresa responde 404.
- Abrir una carta queda registrado (`opened_at`). Desde ese momento el autor ya no puede editarla.
- Crear, editar y borrar tiene un límite de 60 escrituras por minuto por persona (`WRITE_LIMITER`).

## Planes

- Tipos: cita, restaurante, viaje, actividad, película, meta, lugar por conocer y otro.
- Estados: pendiente, realizado (guarda cuándo) y cancelado. Se puede volver a pendiente.
- Fecha, lugar y presupuesto opcionales. El presupuesto se guarda en céntimos con su moneda (PEN, USD, EUR).
- Los dos pueden crear y editar cualquier plan de la pareja.
- Al realizarlo se pueden subir fotos de cómo fue y guardarlo como recuerdo: el recuerdo comparte las
  fotos y queda enlazado al plan (pulsar otra vez abre el mismo recuerdo, no crea otro).
- Los planes pendientes con fecha aparecen en "Próximo momento" del inicio.

## Nosotros y línea de tiempo

- Resumen con contadores reales: días juntos, recuerdos, fotos, lugares, planes realizados,
  cartas abiertas y favoritos. No hay puntajes ni porcentajes.
- Las cartas sorpresa o programadas solo cuentan cuando ya se abrieron, así el contador no delata nada.
- Fechas importantes (cumpleaños, primera vez, viaje, aniversario u otra), con emoji y notas.
  Las que se repiten cada año tienen cuenta regresiva y entran en "Próximo momento" del inicio.
- "Nuestra historia" junta, del más antiguo al más nuevo: el día que empezaron, cada aniversario
  cumplido, los recuerdos, los planes realizados que no se guardaron como recuerdo y las fechas
  importantes ya pasadas (sin cumpleaños). Todo se calcula en la zona horaria de la pareja.

## App instalable y sin conexión

- Se instala en la pantalla de inicio (Android: Perfil → Instalar; iPhone: Safari → Compartir →
  Añadir a pantalla de inicio) y se abre a pantalla completa.
- `public/sw.js` guarda la app, las fotos ya vistas y las tipografías. Solo funciona con
  `npm run build` / `npm run preview` / producción, no con `npm run dev`.
- IndexedDB (`src/offline/`) guarda una copia de lo último visto (inicio, recuerdos, planes,
  cartas ya desbloqueadas…) y la cola de cambios hechos sin conexión.
- Sin conexión se puede crear recuerdos (con fotos), planes y cartas, marcar favoritos y cambiar
  el estado de un plan. Se ven como ⏳ pendiente y se envían solos al volver Internet
  (✓ sincronizado, o ⚠ error con Reintentar/Descartar en Perfil). Editar y borrar necesitan conexión.
- Cada cambio lleva un `X-Client-Action-Id` único: si se reintenta, el Worker devuelve la misma
  respuesta (tabla `sync_actions`) y no se duplica nada.
- Las cápsulas del futuro nunca se guardan en el dispositivo. Al cerrar sesión se borra todo.

## ¿Qué hacemos hoy? (Descubrir)

- Escriben lo que quieren ("un lugar tranquilo para comer algo dulce y conversar") y/o usan filtros
  (tipo, presupuesto, distancia, ambiente, abierto ahora). Los filtros mandan sobre el texto.
- El Worker entiende el texto con reglas en español (`worker/services/places/intent.ts`), busca en
  Google Places API (New) y ordena con un recomendador por reglas (`recommender.ts`): cercanía,
  rating ponderado, precio, gustos de los dos, historial y lo que ya marcaron. Muestra los 5 mejores con el porqué.
- Me interesa / Favorito / Fuimos aquí / Nos encantó / No me interesa se guardan por persona en D1.
  De Google solo se guarda el Place ID (y una categoría propia); nombres y ratings se piden en el momento.
- La clave de Google vive solo en el Worker. Sin ella, Descubrir avisa "Falta activar Google Maps".

**Para no gastar dinero (Google Cloud, proyecto "Nuestro Lugar"):**
1. Habilita **Places API (New)** y vincula la facturación.
2. En Places API (New) → Cuotas, pon **100 por día** en Search Nearby, Search Text y Place Details.
3. Crea un presupuesto con alerta de **1 USD**.
4. Crea una clave de API restringida solo a Places API (New) y súbela:
   `npx wrangler secret put GOOGLE_PLACES_API_KEY --name app`
5. Además, el Worker limita a 20 búsquedas por minuto por persona (`PLACES_LIMITER`).

## Pregúntale a sus recuerdos (IA)

- En Recuerdos → "Pregúntale a sus recuerdos": "¿Cuándo fuimos por primera vez a la playa?",
  "Muéstrame cuando fuimos a comer pizza". Busca por significado y responde en una o dos frases.
- Cada recuerdo se convierte en un vector con Workers AI (`@cf/baai/bge-m3`, multilingüe) y se guarda en
  Vectorize con el id de la relación. El texto sigue solo en D1. El índice se pone al día solo antes de
  cada búsqueda (recuerdos nuevos, editados o borrados; columna `memories.search_indexed_at`).
- "La primera/última vez" se responde con los datos, sin IA. Las demás preguntas, con
  `@cf/meta/llama-3.3-70b-instruct-fp8-fast` usando solo los recuerdos encontrados.
- Costo S/ 0: entra en el cupo gratis diario. Si se acaba o la IA falla, busca por palabras.
- En `npm run dev` no hay IA (busca por palabras). Para probarla en local: `REMOTE_BINDINGS=1 npm run dev`
  (usa tu cuenta y su cupo).

**Una sola vez, antes de publicar:**
```
npx wrangler vectorize create nuestro-lugar-memories --dimensions=1024 --metric=cosine
npx wrangler vectorize create-metadata-index nuestro-lugar-memories --propertyName=relationshipId --type=string
```

## Variables

| Nombre | Fase | Dónde |
| --- | --- | --- |
| `ENVIRONMENT` | 1 | `wrangler.jsonc` (`production`) y `.dev.vars` (`development`) |
| `ALLOWED_EMAILS` | 2 | `.dev.vars` y `wrangler secret put` |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | 2 | `wrangler secret put` (no hacen falta en local) |
| `DEV_USER_EMAIL` | 2 | Solo `.dev.vars` (nunca en producción) |
| `GOOGLE_PLACES_API_KEY` | 10 | `wrangler secret put` |

Ningún secreto va en el frontend ni en el repositorio.
