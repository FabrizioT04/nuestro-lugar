// Tipos compartidos entre React (src/) y el Worker (worker/).
// Solo tipos y esquemas: nada de código que dependa del navegador o de Cloudflare.

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
