import { describe, expect, it } from "vitest";
import type { CapsuleMediaRow, CapsuleRowWithContents } from "../repositories/capsuleRepository";
import { canRead, toDetail, toSummary } from "./capsuleService";

const AUTHOR = "author-id";
const PARTNER = "partner-id";
const NOW = "2026-10-11T12:00:00.000Z";

function capsule(patch: Partial<CapsuleRowWithContents> = {}): CapsuleRowWithContents {
  return {
    id: "c1",
    title: "Para dentro de un año",
    recipient_id: PARTNER,
    unlock_at: "2027-10-11T05:00:00.000Z",
    opened_at: null,
    created_at: "2026-10-01T10:00:00.000Z",
    updated_at: "2026-10-01T10:00:00.000Z",
    created_by: AUTHOR,
    author_name: "Fabrizio",
    message: "texto secreto",
    letter: "carta secreta",
    ...patch,
  };
}

const MEDIA: CapsuleMediaRow[] = [
  { id: "p1", kind: "photo", width: 800, height: 600, duration_ms: null },
  { id: "a1", kind: "audio", width: null, height: null, duration_ms: 12_000 },
];

describe("toDetail", () => {
  it("antes de la fecha la otra persona no recibe nada del contenido", () => {
    const detail = toDetail(capsule(), MEDIA, PARTNER, NOW);
    expect(detail.isLocked).toBe(true);
    expect(detail.contents).toBeNull();
    expect(JSON.stringify(detail)).not.toContain("secret");
    expect(JSON.stringify(detail)).not.toContain("p1");
  });

  it("tampoco si alguien marcó opened_at a mano antes de la fecha", () => {
    expect(toDetail(capsule({ opened_at: "2026-10-10T00:00:00.000Z" }), MEDIA, PARTNER, NOW).contents).toBeNull();
  });

  it("llegada la fecha, sigue cerrada hasta que la abre", () => {
    const due = capsule({ unlock_at: NOW });
    expect(toDetail(due, MEDIA, PARTNER, NOW).isLocked).toBe(false);
    expect(toDetail(due, MEDIA, PARTNER, NOW).contents).toBeNull();
  });

  it("después de abrirla ve texto, carta, fotos y audio", () => {
    const opened = toDetail(capsule({ unlock_at: NOW, opened_at: NOW }), MEDIA, PARTNER, NOW);
    expect(opened.contents).toEqual({
      message: "texto secreto",
      letter: "carta secreta",
      photos: [{ id: "p1", width: 800, height: 600 }],
      audio: { id: "a1", durationMs: 12_000 },
    });
    expect(opened.canEdit).toBe(false);
  });

  it("quien la guardó siempre ve su contenido y puede editarla mientras siga cerrada", () => {
    const mine = toDetail(capsule(), MEDIA, AUTHOR, NOW);
    expect(mine.contents?.message).toBe("texto secreto");
    expect(mine.canEdit).toBe(true);
    expect(toDetail(capsule({ unlock_at: NOW }), MEDIA, AUTHOR, NOW).canEdit).toBe(false);
  });
});

describe("toSummary", () => {
  it("sin destinatario es para los dos", () => {
    expect(toSummary(capsule({ recipient_id: null }), PARTNER, NOW).recipient).toBe("both");
    expect(toSummary(capsule(), PARTNER, NOW).recipient).toBe("partner");
  });

  it("no lleva contenido", () => {
    expect(JSON.stringify(toSummary(capsule(), AUTHOR, NOW))).not.toContain("secret");
  });
});

describe("canRead", () => {
  it("se decide con la hora del servidor, al milisegundo", () => {
    const row = capsule({ unlock_at: "2026-10-11T12:00:00.001Z", opened_at: NOW });
    expect(canRead(row, PARTNER, NOW)).toBe(false);
    expect(canRead(row, PARTNER, "2026-10-11T12:00:00.001Z")).toBe(true);
  });
});
