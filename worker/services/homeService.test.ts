import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CapsuleSummary, LetterSummary } from "@shared/api";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createFakeD1 } from "../testing/fakeD1";
import { getHome, pendingItems } from "./homeService";

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

describe("pendientes de Inicio con la base de datos", () => {
  let db: D1Database;
  let env: Bindings;
  const user: AuthenticatedUser = {
    id: "viewer", email: "viewer@example.com", displayName: "Zuleyka", introSeenAt: null, relationshipId: "r1",
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00.000Z"));
    db = createFakeD1();
    env = { DB: db } as Bindings;
    await db.exec(`
      INSERT INTO users (id, email, display_name) VALUES
        ('viewer', 'viewer@example.com', 'Zuleyka'), ('partner', 'partner@example.com', 'Fabrizio');
      INSERT INTO relationships (id, started_on, timezone) VALUES
        ('r1', '2025-01-01', 'America/Lima'), ('other', '2025-01-01', 'America/Lima');
      INSERT INTO relationship_members (relationship_id, user_id) VALUES ('r1', 'viewer'), ('r1', 'partner');
    `);
  });

  afterEach(() => vi.useRealTimers());

  it("encuentra una carta pendiente anterior a 300 cartas abiertas", async () => {
    await db.exec(`
      WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < 300)
      INSERT INTO letters (id, relationship_id, author_id, recipient_id, title, body, opened_at, created_at)
        SELECT 'opened-' || n, 'r1', 'partner', 'viewer', 'Abierta', 'Privado',
          '2026-10-12T00:00:00.000Z', '2026-10-10T00:00:00.000Z' FROM numbers;
      INSERT INTO letters (id, relationship_id, author_id, recipient_id, title, body, created_at)
        VALUES ('pending', 'r1', 'partner', 'viewer', 'Pendiente', 'Privado', '2026-01-01T00:00:00.000Z');
    `);
    const home = await getHome(env, user);
    expect(home.unopenedLetters).toBe(1);
    expect(home.pending).toEqual([
      { kind: "letter", id: "pending", title: "Pendiente", from: "Fabrizio", isLocked: false, unlockAt: null },
    ]);
  });

  it("encuentra cápsulas pendientes después de 300 abiertas o propias", async () => {
    await db.exec(`
      WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < 300)
      INSERT INTO future_capsules (id, relationship_id, created_by, title, unlock_at, opened_at)
        SELECT 'old-' || n, 'r1', CASE WHEN n % 2 = 0 THEN 'viewer' ELSE 'partner' END,
          'Anterior', '2026-01-01T00:00:00.000Z',
          CASE WHEN n % 2 = 0 THEN NULL ELSE '2026-01-02T00:00:00.000Z' END FROM numbers;
      INSERT INTO future_capsules (id, relationship_id, created_by, recipient_id, title, unlock_at) VALUES
        ('both', 'r1', 'partner', NULL, 'Para ambos', '2026-10-01T00:00:00.000Z'),
        ('partner', 'r1', 'partner', 'viewer', 'Para ti', '2026-11-01T00:00:00.000Z');
    `);
    const home = await getHome(env, user);
    expect(home.pending.map(({ id, isLocked }) => ({ id, isLocked }))).toEqual([
      { id: "both", isLocked: false }, { id: "partner", isLocked: true },
    ]);
  });

  it("mantiene las sorpresas ocultas, los borrados y los límites de la relación", async () => {
    await db.exec(`
      INSERT INTO letters (id, relationship_id, author_id, recipient_id, letter_type, title, body, unlock_at, deleted_at) VALUES
        ('hidden', 'r1', 'partner', 'viewer', 'surprise', 'Oculta', 'Privado', '2026-11-01T00:00:00.000Z', NULL),
        ('ready', 'r1', 'partner', 'viewer', 'surprise', 'Lista', 'Privado', '2026-10-13T12:00:00.000Z', NULL),
        ('locked', 'r1', 'partner', 'viewer', 'scheduled', 'Programada', 'Privado', '2026-11-01T00:00:00.000Z', NULL),
        ('deleted', 'r1', 'partner', 'viewer', 'normal', 'Borrada', 'Privado', NULL, '2026-10-01T00:00:00.000Z'),
        ('mine', 'r1', 'viewer', 'partner', 'normal', 'Mía', 'Privado', NULL, NULL),
        ('other', 'other', 'partner', 'viewer', 'normal', 'Otra relación', 'Privado', NULL, NULL);
      INSERT INTO future_capsules (id, relationship_id, created_by, title, unlock_at, deleted_at) VALUES
        ('deleted', 'r1', 'partner', 'Borrada', '2026-01-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
        ('other', 'other', 'partner', 'Otra relación', '2026-01-01T00:00:00.000Z', NULL);
    `);
    const home = await getHome(env, user);
    expect(home.pending.map(({ id, isLocked }) => ({ id, isLocked }))).toEqual([
      { id: "ready", isLocked: false }, { id: "locked", isLocked: true },
    ]);
    expect(JSON.stringify(home.pending)).not.toContain("Privado");
  });

  it("elige los seis primeros del conjunto, ordenados antes de limitar cada consulta", async () => {
    await db.exec(`
      WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < 305)
      INSERT INTO letters (id, relationship_id, author_id, recipient_id, title, body, unlock_at, created_at)
        SELECT 'later-' || n, 'r1', 'partner', 'viewer', 'Más tarde', 'Privado',
          '2028-01-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z' FROM numbers;
      INSERT INTO letters (id, relationship_id, author_id, recipient_id, title, body, unlock_at, created_at) VALUES
        ('ready', 'r1', 'partner', 'viewer', 'Lista', 'Privado', NULL, '2026-01-01T00:00:00.000Z'),
        ('soon', 'r1', 'partner', 'viewer', 'Pronto', 'Privado', '2026-11-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
      WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < 8)
      INSERT INTO future_capsules (id, relationship_id, created_by, title, unlock_at)
        SELECT 'capsule-' || n, 'r1', 'partner', 'Cápsula', '2026-12-01T00:00:00.000Z' FROM numbers;
    `);
    const home = await getHome(env, user);
    expect(home.pending.map((item) => item.id)).toEqual(["ready", "soon", "capsule-1", "capsule-2", "capsule-3", "capsule-4"]);
  });
});
