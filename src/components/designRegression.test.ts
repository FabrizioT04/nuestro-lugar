import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { CapsuleSummary, LetterSummary, PlanSummary } from "@shared/api";
import { BottomNav } from "./BottomNav";
import { LetterListItem } from "./letters/LetterListItem";
import { PlanCard } from "./plans/PlanCard";
import { FuturePage } from "@/pages/FuturePage";
import { useAsync } from "@/hooks/useAsync";

vi.mock("@/hooks/useAsync", () => ({ useAsync: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useMe: () => ({ user: { id: "me" }, relationship: { timezone: "America/Lima", members: [] } }) }));

const render = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(MemoryRouter, null, element));
const letter: LetterSummary = {
  id: "letter-1", title: "Una carta", type: "scheduled", openWhenLabel: null,
  unlockAt: "2099-10-17T05:00:00Z", isLocked: true, openedAt: null, isMine: false,
  author: { id: "partner", displayName: "Pareja" }, recipient: { id: "me", displayName: "Yo" },
  createdAt: "2026-10-01T05:00:00Z",
};

describe("Rosa minimal conserva navegación y estados", () => {
  it("mantiene todas las rutas y etiquetas de la navegación inferior", () => {
    const html = render(createElement(BottomNav));
    for (const route of ["/", "/recuerdos", "/nosotros", "/planes", "/perfil"]) expect(html).toContain(`href="${route}"`);
    for (const label of ["Inicio", "Recuerdos", "Nosotros", "Planes", "Perfil"]) expect(html).toContain(`<span>${label}</span>`);
  });

  it("no presenta una carta bloqueada como lista para abrir", () => {
    const html = render(createElement(LetterListItem, { letter, timezone: "America/Lima" }));
    expect(html).toContain('href="/cartas/letter-1"');
    expect(html).toContain("Disponible el");
    expect(html).not.toContain('aria-label="Sin abrir"');
  });

  it("distingue cartas recibidas sin abrir de cartas enviadas", () => {
    const ready = { ...letter, isLocked: false, unlockAt: null };
    expect(render(createElement(LetterListItem, { letter: ready, timezone: "America/Lima" }))).toContain('aria-label="Sin abrir"');
    expect(render(createElement(LetterListItem, { letter: { ...ready, isMine: true }, timezone: "America/Lima" }))).not.toContain('aria-label="Sin abrir"');
  });

  it("mantiene lugar, presupuesto y fotos en los planes", () => {
    const plan: PlanSummary = { id: "p1", title: "Cena", type: "restaurant", status: "pending", plannedFor: "2026-10-17", budget: { amountCents: 12000, currency: "PEN" }, placeName: "Nuestro café", completedAt: null, cover: null, photoCount: 3, resultingMemoryId: null, createdAt: "2026-10-01T00:00:00Z" };
    const html = render(createElement(PlanCard, { plan, today: "2026-10-13" }));
    expect(html).toContain('href="/planes/p1"');
    expect(html).toContain("Nuestro café");
    expect(html).toContain("120");
    expect(html).toContain("3</span>");
  });

  it.each([0, 1, 3])("muestra cada cápsula una sola vez, con %i bloqueadas", (count) => {
    const base: CapsuleSummary = { id: "ready", title: "Lista", recipient: "both", unlockAt: "2026-01-01T00:00:00Z", isLocked: false, openedAt: null, isMine: false, author: { id: "partner", displayName: "Pareja" }, createdAt: "2026-01-01T00:00:00Z" };
    const items = [base, ...Array.from({ length: count }, (_, i) => ({ ...base, id: `locked-${i}`, title: `Guardada ${i}`, isLocked: true, unlockAt: `2099-10-${17 + i}T05:00:00Z` }))];
    vi.mocked(useAsync).mockReturnValue({ status: "success", data: { items }, stale: false, reload: vi.fn() });
    const html = render(createElement(FuturePage));
    for (const item of items) expect(html.split(`href="/futuro/${item.id}"`)).toHaveLength(2);
    expect(html.includes("La próxima en abrirse")).toBe(count > 0);
    expect(html).toContain('href="/futuro/nueva"');
  });
});
