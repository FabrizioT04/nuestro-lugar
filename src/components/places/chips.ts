export const chipClass = (active: boolean) =>
  `nl-chip ${
    active ? "border-blush-200 bg-blush-100 text-blush-700" : "border-blush-200 bg-paper text-ink-soft hover:text-ink"
  }`;
