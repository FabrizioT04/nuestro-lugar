import { describe, expect, it } from "vitest";
import { isAllowedEmail, parseAllowedEmails, partnerEmailOf } from "./allowedEmails";

describe("allowedEmails", () => {
  const allowed = parseAllowedEmails(" Ana@Example.com , beto@example.com,,ana@example.com ");

  it("normaliza, quita vacíos y duplicados", () => {
    expect(allowed).toEqual(["ana@example.com", "beto@example.com"]);
  });

  it("compara sin importar mayúsculas", () => {
    expect(isAllowedEmail("BETO@example.com", allowed)).toBe(true);
    expect(isAllowedEmail("intruso@example.com", allowed)).toBe(false);
  });

  it("una lista vacía no permite a nadie", () => {
    expect(isAllowedEmail("ana@example.com", parseAllowedEmails(undefined))).toBe(false);
  });

  it("encuentra a la pareja solo si hay exactamente dos correos", () => {
    expect(partnerEmailOf("ana@example.com", allowed)).toBe("beto@example.com");
    expect(partnerEmailOf("ana@example.com", ["ana@example.com"])).toBeNull();
  });
});
