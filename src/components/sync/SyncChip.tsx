import type { OutboxStatus } from "@/offline/types";

const STYLES: Record<OutboxStatus | "synced", { text: string; className: string }> = {
  synced: { text: "✓ Sincronizado", className: "bg-sage-100 text-sage-700" },
  pending: { text: "⏳ Pendiente", className: "bg-lavender-100 text-lavender-500" },
  syncing: { text: "⏳ Enviando…", className: "bg-lavender-100 text-lavender-500" },
  error: { text: "⚠ Error de sincronización", className: "bg-blush-50 text-blush-700" },
};

/** Estado de una acción: ✓ sincronizado · ⏳ pendiente · ⚠ error de sincronización. */
export function SyncChip({ status }: { status: OutboxStatus | "synced" }) {
  const style = STYLES[status];
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${style.className}`}>{style.text}</span>;
}
