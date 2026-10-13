import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createFakeD1 } from "../testing/fakeD1";
import { getHome } from "./homeService";
import { getPlant, renamePlant, waterPlant } from "./plantService";

const person = (id: string, displayName: string, relationshipId = "r1"): AuthenticatedUser => ({
  id, email: `${id}@example.com`, displayName, introSeenAt: null, relationshipId,
});
const zuleyka = person("zuleyka", "Zuleyka");
const fabrizio = person("fabrizio", "Fabrizio");
const stranger = person("stranger", "Otra", "other");

describe("la plantita", () => {
  let env: Bindings;
  const at = (iso: string) => vi.setSystemTime(new Date(iso));

  beforeEach(async () => {
    vi.useFakeTimers();
    at("2026-10-13T15:00:00.000Z"); // 10:00 en Lima
    const db = createFakeD1();
    env = { DB: db } as Bindings;
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

  afterEach(() => vi.useRealTimers());

  it("se siembra la primera vez que alguien la mira", async () => {
    const plant = await getPlant(env, zuleyka);
    expect(plant).toMatchObject({
      name: "Nuestra plantita", plantedOn: "2026-10-13", careDays: 0, stage: { name: "Semilla" },
      mood: "happy", wateredToday: { me: false, partner: false }, partnerName: "Fabrizio",
    });
  });

  it("cada persona la riega una vez al día y un día de los dos cuenta como uno", async () => {
    await waterPlant(env, zuleyka);
    await waterPlant(env, zuleyka);
    const plant = await waterPlant(env, fabrizio);
    expect(plant.careDays).toBe(1);
    expect(plant.stage.name).toBe("Brote");
    expect(plant.wateredToday).toEqual({ me: true, partner: true });
  });

  it("el día cambia a medianoche de la pareja, no del servidor", async () => {
    at("2026-10-14T04:30:00.000Z"); // 23:30 del 13 en Lima
    await waterPlant(env, zuleyka);
    at("2026-10-14T05:30:00.000Z"); // 00:30 del 14 en Lima
    const plant = await waterPlant(env, zuleyka);
    expect(plant.careDays).toBe(2);
  });

  it("si nadie la riega le da sed", async () => {
    await waterPlant(env, zuleyka);
    at("2026-10-16T15:00:00.000Z");
    const plant = await getPlant(env, fabrizio);
    expect(plant.daysSinceWater).toBe(3);
    expect(plant.mood).toBe("very_thirsty");
    expect(plant.wateredToday).toEqual({ me: false, partner: false });
  });

  it("cada pareja tiene la suya", async () => {
    await waterPlant(env, zuleyka);
    expect((await getPlant(env, stranger)).careDays).toBe(0);
  });

  it("se le puede cambiar el nombre", async () => {
    expect((await renamePlant(env, fabrizio, "Rosita")).name).toBe("Rosita");
    expect((await getPlant(env, zuleyka)).name).toBe("Rosita");
  });

  it("el inicio avisa con una gota hasta que quien mira la riega hoy", async () => {
    expect((await getHome(env, zuleyka)).badges.plant).toBe(1);
    await waterPlant(env, fabrizio);
    expect((await getHome(env, zuleyka)).badges.plant).toBe(1);
    await waterPlant(env, zuleyka);
    expect((await getHome(env, zuleyka)).badges.plant).toBe(0);
  });
});
