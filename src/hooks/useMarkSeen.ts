import { useEffect } from "react";
import type { HomeResponse } from "@shared/api";
import type { SeenSection } from "@shared/schemas";
import { readCache, writeCache } from "@/offline/cache";
import { homeApi } from "@/services/api/home";

/** Al entrar a una sección, su globito del inicio se apaga (también en la copia guardada). */
export function useMarkSeen(section: SeenSection) {
  useEffect(() => {
    void homeApi.markSeen(section).catch(() => undefined);
    void readCache<HomeResponse>("home").then((entry) => {
      if (!entry?.value.badges || entry.value.badges[section] === 0) return;
      return writeCache("home", { ...entry.value, badges: { ...entry.value.badges, [section]: 0 } });
    });
  }, [section]);
}
