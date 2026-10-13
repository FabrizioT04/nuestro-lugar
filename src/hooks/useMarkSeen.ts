import { useEffect } from "react";
import type { HomeBadges, HomeResponse } from "@shared/api";
import type { SeenSection } from "@shared/schemas";
import { readCache, writeCache } from "@/offline/cache";
import { homeApi } from "@/services/api/home";

/** Apaga un globito en la copia guardada del inicio (la de la red llega al volver). */
export async function clearHomeBadge(badge: keyof HomeBadges): Promise<void> {
  const entry = await readCache<HomeResponse>("home");
  if (!entry?.value.badges || !entry.value.badges[badge]) return;
  await writeCache("home", { ...entry.value, badges: { ...entry.value.badges, [badge]: 0 } });
}

/** Al entrar a una sección, su globito del inicio se apaga (también en la copia guardada). */
export function useMarkSeen(section: SeenSection) {
  useEffect(() => {
    void homeApi.markSeen(section).catch(() => undefined);
    void clearHomeBadge(section);
  }, [section]);
}
