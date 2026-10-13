import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createFakeD1 } from "../testing/fakeD1";
import { createDrawing, deleteDrawing, listDrawings, serveDrawing } from "./drawingService";
import { getHome, markSectionSeen } from "./homeService";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

const person = (id: string, displayName: string, relationshipId = "r1"): AuthenticatedUser => ({
  id, email: `${id}@example.com`, displayName, introSeenAt: null, relationshipId,
});
const zuleyka = person("zuleyka", "Zuleyka");
const fabrizio = person("fabrizio", "Fabrizio");
const stranger = person("stranger", "Otra", "other");

/** R2 en memoria: solo lo que usa el servicio. */
function fakeR2() {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    bucket: {
      async put(key: string, bytes: Uint8Array) {
        objects.set(key, bytes);
      },
      async delete(keys: string | string[]) {
        for (const key of [keys].flat()) objects.delete(key);
      },
      async get(key: string) {
        const bytes = objects.get(key);
        if (!bytes) return null;
        return {
          body: new Blob([bytes]).stream(),
          httpEtag: '"e"',
          size: bytes.byteLength,
          writeHttpMetadata: (headers: Headers) => headers.set("content-type", "image/png"),
        };
      },
    },
  };
}

function drawingForm(caption = "Para ti") {
  const form = new FormData();
  form.append("file", new File([PNG], "dibujo.png", { type: "image/png" }));
  form.append("thumb", new File([PNG], "miniatura.png", { type: "image/png" }));
  form.append("width", "800");
  form.append("height", "600");
  form.append("caption", caption);
  return form;
}

describe("dibujos", () => {
  let env: Bindings;
  let r2: ReturnType<typeof fakeR2>;

  beforeEach(async () => {
    const db = createFakeD1();
    r2 = fakeR2();
    env = { DB: db, MEDIA: r2.bucket, UPLOAD_LIMITER: { limit: async () => ({ success: true }) } } as unknown as Bindings;
    await db.exec(`
      INSERT INTO users (id, email, display_name) VALUES
        ('zuleyka', 'zuleyka@example.com', 'Zuleyka'), ('fabrizio', 'fabrizio@example.com', 'Fabrizio'),
        ('stranger', 'stranger@example.com', 'Otra');
      INSERT INTO relationships (id, started_on, timezone) VALUES
        ('r1', '2025-01-01', 'America/Lima'), ('other', '2025-01-01', 'America/Lima');
      INSERT INTO relationship_members (relationship_id, user_id) VALUES
        ('r1', 'zuleyka'), ('r1', 'fabrizio'), ('other', 'stranger');
    `);
  });

  it("guarda la foto en R2 y la muestra a los dos, no a otra pareja", async () => {
    const drawing = await createDrawing(env, zuleyka, drawingForm("  Un gatito  "));
    expect(drawing).toMatchObject({ caption: "Un gatito", width: 800, height: 600, isMine: true, author: { displayName: "Zuleyka" } });
    expect([...r2.objects.keys()].every((key) => key.startsWith("r1/drawing/"))).toBe(true);
    expect(r2.objects.size).toBe(2);

    const seenByPartner = await listDrawings(env, fabrizio);
    expect(seenByPartner.items).toHaveLength(1);
    expect(seenByPartner.items[0]?.isMine).toBe(false);
    expect((await serveDrawing(env, fabrizio, drawing.id, "thumb", new Headers())).status).toBe(200);

    expect((await listDrawings(env, stranger)).items).toEqual([]);
    await expect(serveDrawing(env, stranger, drawing.id, "full", new Headers())).rejects.toMatchObject({ status: 404 });
  });

  it("sin texto guarda null y rechaza textos largos", async () => {
    expect((await createDrawing(env, zuleyka, drawingForm("   "))).caption).toBeNull();
    await expect(createDrawing(env, zuleyka, drawingForm("a".repeat(141)))).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza archivos que no son fotos", async () => {
    const form = drawingForm();
    form.set("file", new File([new Uint8Array([1, 2, 3, 4])], "virus.png", { type: "image/png" }));
    await expect(createDrawing(env, zuleyka, form)).rejects.toMatchObject({ status: 415 });
    expect(r2.objects.size).toBe(0);
  });

  it("solo quien lo subió puede borrarlo, y se borra también de R2", async () => {
    const drawing = await createDrawing(env, zuleyka, drawingForm());
    await expect(deleteDrawing(env, fabrizio, drawing.id)).rejects.toMatchObject({ status: 403 });
    await deleteDrawing(env, zuleyka, drawing.id);
    expect(r2.objects.size).toBe(0);
    expect((await listDrawings(env, fabrizio)).items).toEqual([]);
  });

  it("el globito del inicio cuenta los dibujos nuevos de la otra persona hasta entrar a verlos", async () => {
    await createDrawing(env, zuleyka, drawingForm());
    await createDrawing(env, fabrizio, drawingForm());
    expect((await getHome(env, fabrizio)).badges.drawings).toBe(1);
    await markSectionSeen(env, fabrizio, "drawings");
    expect((await getHome(env, fabrizio)).badges.drawings).toBe(0);
  });
});
