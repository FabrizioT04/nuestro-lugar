import { describe, expect, it } from "vitest";
import { deepLinkPath } from "./nativeApp";

describe("deep links de la app", () => {
  it.each([
    ["nuestrolugar://recuerdos/123", "/recuerdos/123"],
    ["nuestrolugar://recuerdos/", "/recuerdos"],
    ["nuestrolugar://planes?tipo=date", "/planes?tipo=date"],
    ["nuestrolugar://auth?code=abc", "/auth?code=abc"],
    ["nuestrolugar://", "/"],
  ])("%s → %s", (url, path) => {
    expect(deepLinkPath(url)).toBe(path);
  });

  it("ignora enlaces de otras apps o de la web", () => {
    expect(deepLinkPath("https://app.nuestro-lugar.workers.dev/recuerdos")).toBeNull();
    expect(deepLinkPath("otraapp://recuerdos")).toBeNull();
    expect(deepLinkPath("no es una url")).toBeNull();
  });
});
