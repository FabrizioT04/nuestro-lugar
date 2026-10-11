import { describe, expect, it } from "vitest";
import { mediaObjectKey, parseDimension, sniffImageType } from "./media";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe("sniffImageType", () => {
  it("reconoce JPEG, PNG y WebP por sus primeros bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBPVP8 ")]))).toBe("image/webp");
  });

  it("rechaza todo lo demás aunque se llame .jpg", () => {
    expect(sniffImageType(ascii("<svg xmlns=..."))).toBeNull();
    expect(sniffImageType(ascii("<html><script>"))).toBeNull();
    expect(sniffImageType(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull(); // PDF
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("mediaObjectKey", () => {
  it("solo usa ids del servidor", () => {
    expect(mediaObjectKey("rel", "memory", "abc", "webp")).toBe("rel/memory/abc.webp");
    expect(mediaObjectKey("rel", "memory", "abc", "webp", "thumb")).toBe("rel/memory/abc_thumb.webp");
  });
});

describe("parseDimension", () => {
  it("acepta enteros razonables", () => {
    expect(parseDimension("1920")).toBe(1920);
    expect(parseDimension("0")).toBeNull();
    expect(parseDimension("-5")).toBeNull();
    expect(parseDimension("99999")).toBeNull();
    expect(parseDimension("12abc")).toBeNull();
    expect(parseDimension(null)).toBeNull();
  });
});
