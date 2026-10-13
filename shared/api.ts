// Tipos compartidos entre React (src/) y el Worker (worker/).
// Solo tipos y esquemas: nada de código que dependa del navegador o de Cloudflare.
import type { Ambience, PlaceCategory, PlaceInteractionType } from "./places";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "misconfigured"
  | "rate_limited"
  | "payload_too_large"
  | "unsupported_media_type"
  | "upstream_error"
  | "service_unavailable"
  | "internal_error";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId?: string;
  };
}

export interface HealthResponse {
  status: "ok";
  environment: string;
  time: string;
}

export interface DatabaseHealthResponse {
  status: "ok";
  tables: number;
  latencyMs: number;
}

export interface MemberSummary {
  id: string;
  displayName: string;
  email: string;
}

export interface RelationshipSummary {
  id: string;
  name: string;
  startedOn: string;
  timezone: string;
  /** Foto principal del inicio (id de media), o null. */
  coverMediaId: string | null;
  members: MemberSummary[];
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    introSeenAt: string | null;
  };
  /** null hasta que uno de los dos complete la configuración inicial. */
  relationship: RelationshipSummary | null;
  /** Correo del otro usuario permitido, para mostrarlo en la configuración inicial. */
  partnerEmail: string | null;
}

export interface UpcomingMoment {
  title: string;
  emoji: string;
  date: string; // YYYY-MM-DD
  daysUntil: number;
  /** Años que se cumplen (aniversarios y fechas anuales); null si no aplica. */
  years: number | null;
  /** Ruta de la app a la que lleva (por ejemplo, un plan); null si no aplica. */
  link: string | null;
}

export interface HighlightedMemory {
  id: string;
  title: string;
  happenedOn: string;
  placeName: string | null;
  cover: PhotoRef | null;
}

export interface HomeResponse {
  relationship: RelationshipSummary;
  today: string;
  together: { days: number; years: number; months: number };
  nextMoment: UpcomingMoment | null;
  highlightedMemory: HighlightedMemory | null;
  /** Cartas recibidas que ya se pueden abrir y todavía no se abrieron. */
  unopenedLetters: number;
}

export interface PhotoRef {
  id: string;
  width: number | null;
  height: number | null;
}

export interface MemorySummary {
  id: string;
  title: string;
  happenedOn: string;
  placeName: string | null;
  category: string | null;
  tags: string[];
  isFavorite: boolean;
  isHighlighted: boolean;
  cover: PhotoRef | null;
  photoCount: number;
}

export interface MemoryListResponse {
  items: MemorySummary[];
  /** Pásalo como `cursor` para pedir la siguiente página; null si no hay más. */
  nextCursor: string | null;
}

export interface MemoryDetail extends MemorySummary {
  description: string | null;
  photos: PhotoRef[];
  author: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export interface MemoryFilters {
  categories: string[];
  tags: string[];
}

export interface UploadedMedia extends PhotoRef {
  sizeBytes: number;
}

export type LetterTypeName = "normal" | "open_when" | "scheduled" | "surprise";

export interface LetterSummary {
  id: string;
  type: LetterTypeName;
  title: string;
  openWhenLabel: string | null;
  /** Instante UTC a partir del cual se puede abrir; null = disponible ya. */
  unlockAt: string | null;
  /** true mientras unlockAt esté en el futuro (lo decide el Worker). */
  isLocked: boolean;
  /** Primera vez que el destinatario la abrió; null = sin abrir. */
  openedAt: string | null;
  /** true si la escribió quien la está viendo. */
  isMine: boolean;
  author: { id: string; displayName: string };
  recipient: { id: string; displayName: string };
  createdAt: string;
}

export interface LetterListResponse {
  items: LetterSummary[];
}

export interface LetterDetail extends LetterSummary {
  /** null si quien la ve todavía no puede leerla (bloqueada o sin abrir). */
  body: string | null;
  /** El autor puede editarla mientras el destinatario no la haya abierto. */
  canEdit: boolean;
  updatedAt: string;
}

export type PlanTypeName = "date" | "restaurant" | "trip" | "activity" | "movie" | "goal" | "place_to_visit" | "other";
export type PlanStatusName = "pending" | "done" | "cancelled";

export interface PlanSummary {
  id: string;
  type: PlanTypeName;
  status: PlanStatusName;
  title: string;
  /** Fecha de calendario (YYYY-MM-DD) o null si no tiene fecha. */
  plannedFor: string | null;
  /** Presupuesto en céntimos; null si no se indicó. */
  budget: { amountCents: number; currency: string } | null;
  placeName: string | null;
  completedAt: string | null;
  cover: PhotoRef | null;
  photoCount: number;
  /** Recuerdo creado a partir de este plan (si sigue existiendo). */
  resultingMemoryId: string | null;
  createdAt: string;
}

export interface PlanListResponse {
  items: PlanSummary[];
}

export interface PlanDetail extends PlanSummary {
  description: string | null;
  photos: PhotoRef[];
  author: { id: string; displayName: string };
  updatedAt: string;
}

export type ImportantDateTypeName = "anniversary" | "birthday" | "first_time" | "trip" | "custom";

export interface ImportantDate {
  id: string;
  title: string;
  type: ImportantDateTypeName;
  /** Fecha original (YYYY-MM-DD). */
  eventDate: string;
  recursYearly: boolean;
  emoji: string;
  notes: string | null;
  /** Próxima vez que toca (hoy incluido); null si no se repite y ya pasó. */
  nextDate: string | null;
  daysUntil: number | null;
  /** Años que se cumplen en nextDate (solo si se repite). */
  years: number | null;
}

export interface UsStats {
  daysTogether: number;
  memories: number;
  photos: number;
  /** Lugares distintos de recuerdos y planes realizados. */
  places: number;
  plansDone: number;
  /** Cartas ya abiertas (las bloqueadas o sorpresa no cuentan). */
  lettersOpened: number;
  /** Recuerdos que alguno de los dos marcó como favorito. */
  favorites: number;
}

export interface UsResponse {
  relationship: RelationshipSummary;
  today: string;
  together: { days: number; years: number; months: number };
  stats: UsStats;
  /** El aniversario de la relación (calculado, no editable). */
  anniversary: UpcomingMoment;
  importantDates: ImportantDate[];
  /** Favoritos de cualquiera de los dos, los más recientes primero. */
  favorites: MemorySummary[];
}

export type TimelineEventKind = "start" | "anniversary" | "memory" | "plan" | "date";

export interface TimelineEvent {
  /** Estable para React: tipo + id de origen. */
  key: string;
  kind: TimelineEventKind;
  date: string; // YYYY-MM-DD
  title: string;
  subtitle: string | null;
  emoji: string;
  /** Ruta de la app a la que lleva, o null. */
  link: string | null;
  cover: PhotoRef | null;
}

export interface TimelineResponse {
  today: string;
  /** Del más antiguo al más reciente. */
  events: TimelineEvent[];
}

/** partner: para la otra persona · both: para los dos. */
export type CapsuleRecipientName = "partner" | "both";

export interface CapsuleSummary {
  id: string;
  title: string;
  recipient: CapsuleRecipientName;
  /** Instante UTC a partir del cual se puede abrir. */
  unlockAt: string;
  /** true mientras unlockAt esté en el futuro (lo decide el Worker). */
  isLocked: boolean;
  /** Primera vez que la abrió la otra persona; null = sin abrir. */
  openedAt: string | null;
  /** true si la guardó quien la está viendo. */
  isMine: boolean;
  author: { id: string; displayName: string };
  createdAt: string;
}

export interface CapsuleListResponse {
  items: CapsuleSummary[];
}

export interface CapsuleAudio {
  id: string;
  durationMs: number | null;
}

export interface CapsuleContents {
  message: string | null;
  letter: string | null;
  photos: PhotoRef[];
  audio: CapsuleAudio | null;
}

export interface CapsuleDetail extends CapsuleSummary {
  /** null mientras quien la ve no pueda abrirla (bloqueada o sin abrir). */
  contents: CapsuleContents | null;
  /** Quien la guardó puede editarla mientras siga cerrada. */
  canEdit: boolean;
  updatedAt: string;
}

export interface UploadedAudio {
  id: string;
  durationMs: number | null;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Lugares: "¿Qué hacemos hoy?"
// ---------------------------------------------------------------------------

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Un lugar tal como lo devuelve Google en esta búsqueda. No se guarda en D1:
 * de Google solo se guarda el Place ID (políticas de Google Maps Platform).
 */
export interface PlaceSummary {
  id: string;
  name: string;
  category: PlaceCategory | null;
  address: string | null;
  location: GeoPoint;
  /** Metros desde donde están (null si no hay ubicación de referencia). */
  distanceM: number | null;
  rating: number | null;
  ratingCount: number | null;
  /** 0 gratis · 1 $ · 2 $$ · 3 $$$ · 4 $$$$ */
  priceLevel: number | null;
  openNow: boolean | null;
  mapsUrl: string | null;
}

/** Lo que el Worker entendió del pedido (texto + filtros), para mostrarlo y poder corregirlo. */
export interface PlaceIntent {
  categories: PlaceCategory[];
  budget: number | null;
  maxDistanceKm: number;
  openNow: boolean;
  ambience: Ambience[];
  food: string | null;
  dietary: string[];
}

export interface PlaceStatus {
  mine: PlaceInteractionType[];
  partner: PlaceInteractionType[];
}

export interface PlaceRecommendation {
  place: PlaceSummary;
  /** Por qué se recomienda, en frases cortas ("A 800 m", "Les encantan los cafés"). */
  reasons: string[];
  status: PlaceStatus;
}

export interface PlaceRecommendationsResponse {
  understood: PlaceIntent;
  items: PlaceRecommendation[];
  /** Cuántos candidatos devolvió Google antes de filtrar y ordenar. */
  candidates: number;
}

export interface SavedPlace {
  placeId: string;
  /** null si Google ya no lo encuentra (cerró, cambió de id). */
  place: PlaceSummary | null;
  category: PlaceCategory | null;
  status: PlaceStatus;
  lastInteractionAt: string;
}

export interface SavedPlacesResponse {
  items: SavedPlace[];
}

export interface PlacePreferences {
  maxDistanceKm: number | null;
  budgetMax: number | null;
  likedCategories: PlaceCategory[];
  dislikedCategories: PlaceCategory[];
  ambience: Ambience[];
  dietary: string[];
}

export interface PlacePreferencesResponse {
  mine: PlacePreferences;
  partner: { displayName: string; preferences: PlacePreferences } | null;
}

export interface GeocodeResponse {
  location: GeoPoint;
  label: string;
}

// ---------------------------------------------------------------------------
// Búsqueda de recuerdos con IA (Memory AI)
// ---------------------------------------------------------------------------

export interface MemorySearchResponse {
  /** Respuesta corta basada solo en los recuerdos encontrados; null si no hay nada que decir. */
  answer: string | null;
  items: MemorySummary[];
  /** "ai": por significado (Workers AI + Vectorize). "keywords": solo por palabras (la IA no estaba disponible). */
  mode: "ai" | "keywords";
  /** Recuerdos que todavía no se pudieron preparar para la búsqueda por significado. */
  pendingIndex: number;
}

// ---------------------------------------------------------------------------
// Sesión de la app móvil (fase 12)
// ---------------------------------------------------------------------------

export interface MobileSessionResponse {
  /** Va en `Authorization: Bearer …`. Dura 15 minutos. */
  accessToken: string;
  /** Milisegundos desde 1970 en que vence el token de acceso. */
  accessTokenExpiresAt: number;
  /** Se cambia por tokens nuevos en /api/auth/mobile/refresh. Rota en cada uso. Guardar en almacenamiento seguro. */
  refreshToken: string;
  /** Solo para ver fotos y audios (`?mt=` en la URL, porque <img> no puede llevar cabeceras). */
  mediaToken: string;
}

/** Por qué no se pudo entrar desde la app (llega a la app en el deep link). */
export type MobileLoginError = "forbidden" | "cancelled" | "expired" | "failed";

// ---------------------------------------------------------------------------
// Notificaciones push (fase 13)
// ---------------------------------------------------------------------------

/** Qué avisos quiere recibir cada persona (en todos sus dispositivos). */
export interface PushPreferences {
  /** Carta nueva y carta programada que ya se puede abrir. */
  letters: boolean;
  /** La otra persona guardó un recuerdo. */
  memories: boolean;
  /** Cápsula nueva y cápsula que ya se puede abrir. */
  capsules: boolean;
  /** Aniversario, mesiversario y fechas importantes (hoy y mañana). */
  dates: boolean;
  /** Planes con fecha de hoy. */
  plans: boolean;
}

export interface PushConfigResponse {
  /** false si el servidor todavía no tiene las claves VAPID. */
  enabled: boolean;
  /** Clave pública VAPID (base64url) para `pushManager.subscribe`. No es secreta. */
  publicKey: string | null;
  preferences: PushPreferences;
}

/** Lo que llega al service worker dentro del aviso (cifrado). */
export interface PushPayload {
  title: string;
  body: string;
  /** Ruta de la app que se abre al tocar el aviso (siempre empieza con "/"). */
  url: string;
  /** Avisos con el mismo tag se reemplazan en el teléfono en vez de acumularse. */
  tag: string;
}
