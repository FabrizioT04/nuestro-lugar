/** Normaliza la lista ALLOWED_EMAILS ("a@x.com, B@y.com") a minúsculas y sin espacios. */
export function parseAllowedEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    ),
  ];
}

export function isAllowedEmail(email: string, allowed: readonly string[]): boolean {
  return allowed.includes(email.trim().toLowerCase());
}

/** Con exactamente dos correos permitidos, devuelve el del otro usuario. */
export function partnerEmailOf(email: string, allowed: readonly string[]): string | null {
  if (allowed.length !== 2) return null;
  const normalized = email.trim().toLowerCase();
  return allowed.find((candidate) => candidate !== normalized) ?? null;
}
