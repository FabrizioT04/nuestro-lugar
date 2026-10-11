import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./memoryService";
import { likePattern } from "../repositories/memoryRepository";

describe("cursor de paginación", () => {
  it("ida y vuelta", () => {
    const cursor = { happenedOn: "2026-02-01", createdAt: "2026-10-11T07:00:00.000Z", id: "abc" };
    const encoded = encodeCursor(cursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it("rechaza cursores manipulados", () => {
    expect(() => decodeCursor("no-es-un-cursor")).toThrow("Cursor inválido");
    expect(() => decodeCursor(btoa(JSON.stringify([1, 2, 3])))).toThrow("Cursor inválido");
  });
});

describe("likePattern", () => {
  it("trata %, _ y \\ como texto literal", () => {
    expect(likePattern("pizza")).toBe("%pizza%");
    expect(likePattern("100%")).toBe("%100\\%%");
    expect(likePattern("a_b")).toBe("%a\\_b%");
    expect(likePattern("c:\\")).toBe("%c:\\\\%");
  });
});
