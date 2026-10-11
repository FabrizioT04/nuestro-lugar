# Nuestro Lugar · Arquitectura (Fase 1)

## ¿Es posible hacer todo esto?

Sí. Todo lo que pides cabe en Cloudflare + React sin un servidor propio ni una computadora encendida.
Hay tres puntos que necesitan una solución específica (los detallo abajo): Cloudflare Access dentro de
la app móvil, la instalación de la PWA detrás de Access, y el costo de Google Places si se usa mucho.
Ninguno bloquea el proyecto.

---

## 1. Arquitectura propuesta

```
                ┌──────────────────────── Cloudflare ────────────────────────┐
 Navegador /    │                                                            │
 PWA / App  ──► │  Cloudflare Access (Google, solo 2 correos)                │
                │        │                                                   │
                │        ▼                                                   │
                │  Worker "nuestro-lugar" (un solo dominio)                  │
                │   ├─ /*      → assets estáticos de React (SPA)             │
                │   └─ /api/*  → Hono: auth → autorización → validación      │
                │                 → servicios → repositorios                 │
                │                        │        │        │        │        │
                │                        ▼        ▼        ▼        ▼        │
                │                       D1       R2   Workers AI  Vectorize  │
                │                                          Google Places ◄───┼── API key como secreto
                └────────────────────────────────────────────────────────────┘
```

- **Un único Worker** sirve el frontend (Workers Static Assets) y la API. Mismo origen: una sola
  aplicación en Access, las cookies viajan solas y no hay CORS.
- **Capas del Worker:** `routes/` (HTTP) → `services/` (reglas de negocio, p. ej. "esta carta aún no se
  puede abrir") → `repositories/` (único lugar con SQL, siempre con prepared statements).
- **`shared/`**: tipos y esquemas Zod usados por React y por el Worker. Una sola definición de cada
  contrato; el Worker siempre vuelve a validar, nunca confía en el cliente.
- **Frontend:** `pages/` (pantallas) → `hooks/` (lógica de UI) → `services/api/` (único punto que llama
  a `/api`). `offline/` (IndexedDB + Outbox) y `platform/` (web vs. Capacitor) quedan aislados.

## 2. Árbol de carpetas (creado)

```
nuestro-lugar/
├── index.html
├── package.json
├── vite.config.ts            React + Tailwind + plugin de Cloudflare (Worker real en dev)
├── wrangler.jsonc            Worker, assets, D1 (R2/AI/Vectorize comentados para fases futuras)
├── tsconfig*.json            app / worker / node separados
├── .dev.vars.example         variables locales (copiar a .dev.vars)
├── migrations/
│   └── 0001_initial_schema.sql
├── public/
│   └── favicon.svg
├── shared/
│   └── api.ts                contratos compartidos React ↔ Worker
├── src/
│   ├── main.tsx
│   ├── router.tsx            rutas: /, /recuerdos, /nosotros, /planes, /perfil, /bienvenida
│   ├── components/ (ui/)
│   ├── pages/
│   ├── layouts/AppLayout.tsx
│   ├── hooks/                useOnlineStatus, useSystemStatus
│   ├── services/api/         client.ts (fetch + errores tipados), health.ts
│   ├── stores/
│   ├── types/
│   ├── utils/
│   ├── offline/              (Fase 9)
│   ├── platform/             (Fase 12) abstracciones de cámara, GPS, push, deep links
│   ├── styles/index.css      paleta crema / rosa palo / lavanda
│   └── assets/
└── worker/
    ├── index.ts              app Hono en /api
    ├── env.ts
    ├── worker-configuration.d.ts   (generado con `npm run cf-typegen`)
    ├── routes/health.ts
    ├── middleware/           requestId, securityHeaders, errorHandler
    ├── services/healthService.ts
    ├── repositories/systemRepository.ts
    ├── auth/                 (Fase 2)
    └── utils/errors.ts
```

## 3. Cómo se conectan React, Worker y D1

1. React llama `apiFetch("/health/db")` → `GET /api/health/db` en el mismo dominio.
2. `run_worker_first: ["/api/*"]` hace que esa petición llegue al Worker; cualquier otra ruta
   (`/recuerdos`) la sirve Cloudflare con `index.html` y la resuelve React Router.
3. Desde la Fase 2, antes de llegar a la ruta: Access ya autenticó → el Worker verifica el JWT de Access
   → compara el correo con `ALLOWED_EMAILS` → carga el usuario y su relación.
4. El servicio aplica reglas y el repositorio consulta D1 con `env.DB.prepare(...).bind(...)`.
5. Errores: respuestas JSON `{ error: { code, message, requestId } }`; los detalles internos solo van a
   los logs del Worker.

React **nunca** habla con D1 ni R2 directamente; no hay credenciales en el frontend.

## 4. Qué instalar

Ahora:
- **Node.js 22 LTS** (o 20+) y npm.
- **Git**.
- **Cuenta de Cloudflare** (gratis). Wrangler viene en el proyecto; solo ejecuta `npx wrangler login`.

Más adelante:
- Fase 2: un proyecto en Google Cloud (pantalla de consentimiento OAuth) y Cloudflare Zero Trust
  (gratis hasta 50 usuarios). Recomendado: un dominio propio en Cloudflare (Access también funciona
  sobre `*.workers.dev`).
- Fase 10: facturación activada en Google Cloud para Places API.
- Fase 12: Android Studio; Xcode (solo en Mac) para iOS.

## 5. Decisiones técnicas que cambiaría o precisaría

1. **Workers en lugar de Pages.** Cloudflare está concentrando lo nuevo en Workers con Static Assets.
   Un solo Worker sirve React y la API: un deploy, un dominio, una aplicación de Access.

2. **No confiar en la cabecera de Access.** El Worker debe verificar la firma del JWT
   `Cf-Access-Jwt-Assertion` (audiencia, emisor, expiración) y volver a comprobar la whitelist.
   Si alguien cambia la política de Access por error, el Worker sigue cerrado.

3. **Access y la app móvil (lo más importante).** Access funciona con cookies en el navegador; dentro de
   Capacitor el WebView vive en `https://localhost` o `capacitor://localhost`, así que esas cookies no
   sirven. Propongo dejar el módulo `auth` del Worker con dos "puertas":
   - Web/PWA: JWT de Access (Fase 2).
   - Móvil (Fase 12): Authorization Code + PKCE con Google en el navegador del sistema, regreso por deep
     link, el Worker valida el ID token de Google, aplica la whitelist y emite su propio token de corta
     duración + refresh token guardado en almacenamiento seguro. La ruta de API de la app se excluye de
     Access y la protege el Worker.
   Nunca Service Tokens en el APK, como pediste.

4. **PWA detrás de Access.** El navegador pide `manifest.webmanifest` sin cookies, Access lo redirige al
   login y la app deja de ser instalable. Solución: `crossorigin="use-credentials"` en el manifest o una
   política *Bypass* de Access solo para el manifest y los iconos. Además, cuando la sesión de Access
   expira, un `fetch` a la API recibe una redirección que falla por CORS; el cliente debe detectarlo y
   recargar la página para volver a iniciar sesión. Lo resuelvo en las fases 2 y 9.

5. **R2 privado.** El bucket no será público. Las fotos se sirven a través del Worker (comprobando la
   relación) y las de cápsulas no se entregan antes de su fecha. Las claves de R2 las genera el Worker
   (`{relationshipId}/{uuid}.webp`), nunca el cliente.

6. **Zona horaria explícita.** "Ábreme en nuestro aniversario" depende de la hora local. La relación
   guarda su zona IANA y el Worker compara `unlock_at` en UTC. Sin esto una carta podría abrirse horas
   antes o después.

7. **IDs generados en el cliente (UUID).** Permiten crear recuerdos offline y enlazar fotos antes de
   sincronizar. Junto con `client_action_id` en `sync_actions`, los reintentos no duplican nada.

8. **Librerías que añadiría en su fase:** Hono (router del Worker, ya instalado), Zod (validación
   compartida, ya instalado), TanStack Query (caché de datos del servidor), Dexie (IndexedDB),
   `vite-plugin-pwa` (service worker), `browser-image-compression` (fotos antes de subir), `motion`
   (sucesor de Framer Motion, solo donde aporte). Zustand solo si aparece estado global real.

9. **Modelo de datos.** Además de tus tablas añadí: `relationship_members` (quién pertenece a qué
   relación; base de toda autorización y de la futura integración con la granja), `media_objects`
   (todos los archivos de R2 en un solo lugar), `tags`/`memory_tags` (etiquetas normalizadas) y
   `plan_photos`. `favorites` es por usuario (cada uno marca sus favoritos); el "recuerdo destacado" del
   Home es un campo compartido del recuerdo (`memories.is_highlighted`).

10. **Google Places.** Usar Places API (New) con *field masks* para pagar solo los campos que se piden.
    Guardar solo el `place_id` y datos propios; los detalles se piden al mostrar. Hay crédito mensual
    gratuito, pero conviene poner un límite de cuota en Google Cloud.

11. **Push en iOS.** Las notificaciones push en una PWA de iOS exigen que esté instalada y son
    limitadas; las notificaciones "de verdad" llegan con Capacitor (Fase 12).

12. **Costo.** Para dos personas, D1, R2, Workers y Access deberían quedar dentro del plan gratuito
    (estimación, no medido). Workers AI y Vectorize tienen cuota gratuita diaria; el plan Workers Paid
    (5 USD/mes) es opcional si alguna vez se supera.

## 6. Fuera de la Fase 1 (a propósito)

Autenticación, diseño definitivo, recuerdos, cartas, planes, IA, Google Maps, PWA y Capacitor.
Las rutas existen con pantallas provisionales para probar la navegación.
