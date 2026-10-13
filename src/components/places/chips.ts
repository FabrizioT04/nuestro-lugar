export const chipClass = (active: boolean) =>
  `flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition ${
    active ? "border-blush-200 bg-blush-200 text-blush-700" : "border-blush-100 bg-paper text-ink-soft hover:text-ink"
  }`;
