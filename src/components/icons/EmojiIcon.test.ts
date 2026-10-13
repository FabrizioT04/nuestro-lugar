import { describe, expect, it } from "vitest";
import { IMPORTANT_DATE_TYPE_INFO } from "@shared/importantDates";
import { PLACE_CATEGORY_INFO, PLACE_INTERACTION_INFO } from "@shared/places";
import { PLAN_TYPE_INFO } from "@shared/plans";
import { iconFor } from "./EmojiIcon";

describe("iconFor", () => {
  it("todos los tipos de la app tienen un ícono moderno (ninguno se queda en emoji)", () => {
    const all = [PLAN_TYPE_INFO, IMPORTANT_DATE_TYPE_INFO, PLACE_CATEGORY_INFO, PLACE_INTERACTION_INFO].flatMap((info) =>
      Object.values(info).map((item) => item.emoji),
    );
    for (const emoji of all) expect(iconFor(emoji), emoji).not.toBeNull();
  });

  it("reconoce el emoji con o sin el selector de variación", () => {
    expect(iconFor("✈️")).toBe(iconFor("✈"));
    expect(iconFor("❤")).not.toBeNull();
  });

  it("un emoji elegido por ustedes que no está en la lista se deja tal cual", () => {
    expect(iconFor("🦄")).toBeNull();
    expect(iconFor(null)).toBeNull();
  });
});
