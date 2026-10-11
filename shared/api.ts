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
