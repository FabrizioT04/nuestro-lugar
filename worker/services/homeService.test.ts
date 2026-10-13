import { describe, expect, it } from "vitest";
import type { CapsuleSummary, LetterSummary } from "@shared/api";
import { pendingItems } from "./homeService";

const person = (displayName: string) => ({ id: displayName.toLowerCase(), displayName });

const letter = (over: Partial<LetterSummary>): LetterSummary => ({
  id: "l1",
  type: "normal",
  title: "Carta",
  openWhenLabel: null,
  unlockAt: null,
  isLocked: false,
  openedAt: null,
  isMine: false,
  author: person("Fabrizio"),
  recipient: person("Zuleyka"),
  createdAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

const capsule = (over: Partial<CapsuleSummary>): CapsuleSummary => ({
  id: "c1",
  title: "Cápsula",
  recipient: "partner",
  unlockAt: "2026-10-01T00:00:00.000Z",
  isLocked: false,
  openedAt: null,
  isMine: false,
  author: person("Fabrizio"),
  createdAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

describe("pendingItems", () => {
  it("junta cartas y cápsulas sin abrir, con lo que ya se puede abrir primero", () => {
    const items = pendingItems(
      [
        letter({ id: "bloqueada-lejos", isLocked: true, unlockAt: "2027-02-14T05:00:00.000Z" }),
        letter({ id: "lista" }),
        letter({ id: "bloqueada-cerca", isLocked: true, unlockAt: "2026-11-01T05:00:00.000Z" }),
      ],
      [capsule({ id: "capsula-lista" })],
    );
    expect(items.map((item) => item.id)).toEqual(["lista", "capsula-lista", "bloqueada-cerca", "bloqueada-lejos"]);
    expect(items[1]).toMatchObject({ kind: "capsule", from: "Fabrizio", isLocked: false });
  });

  it("no incluye lo ya abierto ni lo que escribió quien mira", () => {
    const items = pendingItems(
      [letter({ id: "abierta", openedAt: "2026-10-02T00:00:00.000Z" }), letter({ id: "mia", isMine: true })],
      [capsule({ id: "mia", isMine: true }), capsule({ id: "abierta", openedAt: "2026-10-02T00:00:00.000Z" })],
    );
    expect(items).toEqual([]);
  });

  it("muestra como máximo 6", () => {
    const letters = Array.from({ length: 9 }, (_, i) => letter({ id: `l${i}` }));
    expect(pendingItems(letters, [])).toHaveLength(6);
  });
});
