import { describe, expect, it } from "vitest";
import type { LetterRowWithBody } from "../repositories/letterRepository";
import { isHiddenFrom, toDetail } from "./letterService";

const AUTHOR = "author-id";
const RECIPIENT = "recipient-id";
const NOW = "2026-10-11T12:00:00.000Z";

function letter(patch: Partial<LetterRowWithBody> = {}): LetterRowWithBody {
  return {
    id: "l1",
    letter_type: "normal",
    title: "Para ti",
    open_when_label: null,
    unlock_at: null,
    opened_at: null,
    created_at: "2026-10-01T10:00:00.000Z",
    updated_at: "2026-10-01T10:00:00.000Z",
    author_id: AUTHOR,
    author_name: "Fabrizio",
    recipient_id: RECIPIENT,
    recipient_name: "Pareja",
    body: "contenido secreto",
    ...patch,
  };
}

describe("toDetail", () => {
  it("el autor siempre puede leer lo que escribió y editarlo mientras no se abra", () => {
    const detail = toDetail(letter({ letter_type: "scheduled", unlock_at: "2027-02-01T05:00:00.000Z" }), AUTHOR, NOW);
    expect(detail.body).toBe("contenido secreto");
    expect(detail.isLocked).toBe(true);
    expect(detail.canEdit).toBe(true);
  });

  it("el destinatario no recibe el contenido antes de abrirla", () => {
    const detail = toDetail(letter(), RECIPIENT, NOW);
    expect(detail.body).toBeNull();
    expect(detail.canEdit).toBe(false);
    expect(detail.isMine).toBe(false);
  });

  it("el destinatario no recibe el contenido mientras esté bloqueada", () => {
    const locked = letter({ letter_type: "scheduled", unlock_at: "2026-10-11T12:00:01.000Z", opened_at: "2026-10-01T00:00:00.000Z" });
    expect(toDetail(locked, RECIPIENT, NOW).body).toBeNull();
  });

  it("después de abrirla, el destinatario la lee y el autor ya no puede editarla", () => {
    const opened = letter({ opened_at: "2026-10-10T09:00:00.000Z" });
    expect(toDetail(opened, RECIPIENT, NOW).body).toBe("contenido secreto");
    expect(toDetail(opened, AUTHOR, NOW).canEdit).toBe(false);
  });

  it("se desbloquea exactamente en unlock_at", () => {
    const due = letter({ letter_type: "scheduled", unlock_at: NOW, opened_at: NOW });
    expect(toDetail(due, RECIPIENT, NOW).isLocked).toBe(false);
    expect(toDetail(due, RECIPIENT, NOW).body).toBe("contenido secreto");
  });
});

describe("isHiddenFrom", () => {
  const surprise = letter({ letter_type: "surprise", unlock_at: "2027-01-01T00:00:00.000Z" });
  it("una sorpresa pendiente no existe para el destinatario", () => {
    expect(isHiddenFrom(surprise, RECIPIENT, NOW)).toBe(true);
  });
  it("pero sí para quien la escribió", () => {
    expect(isHiddenFrom(surprise, AUTHOR, NOW)).toBe(false);
  });
  it("aparece cuando llega su fecha", () => {
    expect(isHiddenFrom(surprise, RECIPIENT, "2027-01-01T00:00:00.000Z")).toBe(false);
  });
  it("una programada sí se ve (bloqueada)", () => {
    expect(isHiddenFrom(letter({ letter_type: "scheduled", unlock_at: "2027-01-01T00:00:00.000Z" }), RECIPIENT, NOW)).toBe(false);
  });
});
