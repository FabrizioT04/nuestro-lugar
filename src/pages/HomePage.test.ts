import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { HomeResponse } from "@shared/api";
import { useAsync } from "@/hooks/useAsync";
import { HomePage } from "./HomePage";

vi.mock("@/hooks/useAsync", () => ({ useAsync: vi.fn() }));

const home: HomeResponse = {
  relationship: {
    id: "r1", name: "Nuestro Lugar", startedOn: "2025-01-01", timezone: "America/Lima",
    coverMediaId: null, members: [],
  },
  today: "2026-10-13", together: { days: 650, years: 1, months: 9 },
  nextMoment: null, highlightedMemory: null, unopenedLetters: 0, pending: [],
};

function renderHome(data: Omit<HomeResponse, "pending"> & Partial<Pick<HomeResponse, "pending">>) {
  vi.mocked(useAsync).mockReturnValue({ status: "success", data, stale: true, reload: vi.fn() });
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(HomePage)));
}

describe("pendientes de Inicio con copias antiguas", () => {
  it.each([1, 2])("conserva el aviso de %i cartas cuando falta pending", (count) => {
    const { pending: _pending, ...legacy } = home;
    const html = renderHome({ ...legacy, unopenedLetters: count });
    expect(html).toContain(count === 1 ? "Tienes una carta sin abrir" : "Tienes 2 cartas sin abrir");
    expect(html).toContain('href="/cartas"');
    expect(html).not.toContain("Todo abierto");
  });

  it("no da por abiertas las cápsulas desconocidas aunque no hubiera cartas", () => {
    const { pending: _pending, ...legacy } = home;
    const html = renderHome(legacy);
    expect(html).not.toContain("Todo abierto");
    expect(html).not.toContain("No tienen cartas ni cápsulas pendientes");
    expect(html).toContain("Conéctate para actualizar");
  });

  it("muestra Todo abierto cuando la respuesta sí incluye una lista vacía", () => {
    expect(renderHome(home)).toContain("Todo abierto");
  });

  it("sigue mostrando los elementos de una copia con el campo pending", () => {
    const html = renderHome({ ...home, pending: [
      { kind: "letter", id: "l1", title: "Para ti", from: "Fabrizio", isLocked: false, unlockAt: null },
    ] });
    expect(html).toContain("Para ti");
    expect(html).toContain('href="/cartas/l1"');
    expect(html).not.toContain("Todo abierto");
  });
});
