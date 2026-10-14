import { Hono } from "hono";
import { songCreateSchema, songLoveSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { idempotent } from "../middleware/idempotency";
import { limitWrites } from "../middleware/rateLimit";
import { inBackground, notifyNewSong, notifySongLoved } from "../services/notificationService";
import { createSong, deleteSong, listSongs, markSongListened, setSongLoved } from "../services/songService";
import { parseIdParam, parseJsonBody } from "../utils/validation";

/** Canciones que uno le recomienda al otro. */
export const songRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship, limitWrites, idempotent)
  .get("/", async (c) => c.json(await listSongs(c.env, c.get("user"))))
  .post("/", async (c) => {
    const input = await parseJsonBody(c, songCreateSchema);
    const created = await createSong(c.env, c.get("user"), input);
    inBackground(c, notifyNewSong(c.env, c.get("user"), created));
    return c.json(created, 201);
  })
  .post("/:id/listened", async (c) => c.json(await markSongListened(c.env, c.get("user"), parseIdParam(c))))
  .put("/:id/love", async (c) => {
    const id = parseIdParam(c);
    const { loved } = await parseJsonBody(c, songLoveSchema);
    const { song, newlyLoved } = await setSongLoved(c.env, c.get("user"), id, loved);
    if (newlyLoved) inBackground(c, notifySongLoved(c.env, c.get("user"), song));
    return c.json(song);
  })
  .delete("/:id", async (c) => {
    await deleteSong(c.env, c.get("user"), parseIdParam(c));
    return c.body(null, 204);
  });
