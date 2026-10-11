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
