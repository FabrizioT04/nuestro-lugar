export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  introSeenAt: string | null;
  /** null hasta completar la configuración inicial de la relación. */
  relationshipId: string | null;
}
