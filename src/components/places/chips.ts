export const chipClass = (active: boolean) =>
  `flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
    active ? "bg-lavender-300 text-ink" : "bg-cream text-ink-soft hover:text-ink"
  }`;
