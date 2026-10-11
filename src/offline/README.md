# src/offline

Capa offline (Fase 9):

- `db.ts`: IndexedDB (con Dexie) — caché de recuerdos recientes, planes, cartas ya desbloqueadas.
- `outbox.ts`: cola de acciones pendientes. Cada acción lleva un `client_action_id` (UUID)
  que el Worker registra en la tabla `sync_actions` para que un reintento no duplique nada.
- `sync.ts`: vacía la cola al recuperar conexión y marca ✓ sincronizado / ⏳ pendiente / ⚠ error.

Nunca se guarda aquí contenido bloqueado (cartas o cápsulas antes de su fecha): el Worker no lo envía.
