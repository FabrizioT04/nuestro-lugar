import { describe, expect, it } from "vitest";
import { slideDirection, swipeTarget } from "./pageTransition";

describe("cambio de pantalla deslizando", () => {
  it("entre pestañas entra desde el lado al que vas", () => {
    expect(slideDirection("/", "/recuerdos")).toBe("right");
    expect(slideDirection("/perfil", "/nosotros")).toBe("left");
  });

  it("al abrir un detalle entra desde la derecha y al volver desde la izquierda", () => {
    expect(slideDirection("/cartas", "/cartas/abc")).toBe("right");
    expect(slideDirection("/cartas/abc", "/cartas")).toBe("left");
  });

  it("sin pantalla anterior o en la misma no se desliza", () => {
    expect(slideDirection(null, "/")).toBe("none");
    expect(slideDirection("/planes", "/planes")).toBe("none");
  });

  it("deslizar el dedo lleva a la pestaña vecina", () => {
    expect(swipeTarget("/", -120, 10)).toBe("/recuerdos");
    expect(swipeTarget("/recuerdos", 120, 10)).toBe("/");
    expect(swipeTarget("/", 120, 10)).toBeNull();
    expect(swipeTarget("/perfil", -120, 0)).toBeNull();
  });

  it("ignora gestos cortos, verticales o fuera de las pestañas", () => {
    expect(swipeTarget("/", -40, 0)).toBeNull();
    expect(swipeTarget("/", -120, 90)).toBeNull();
    expect(swipeTarget("/cartas/abc", -120, 0)).toBeNull();
  });
});
