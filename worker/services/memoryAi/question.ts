// Lo poco que se interpreta de la pregunta sin IA: si piden la primera o la última vez,
// un año concreto, y las palabras clave para la búsqueda por texto (respaldo de la IA).

export type MemoryOrder = "first" | "last" | null;

export interface ParsedQuestion {
  order: MemoryOrder;
  year: number | null;
  terms: string[];
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Palabras que no ayudan a encontrar un recuerdo ("muéstrame cuando fuimos a…").
const STOPWORDS = new Set(
  `a al algo alguna algun alguno algunos ante con como cual cuales cuando de del donde el ella ellas en entre era eramos es esa ese eso esta estabamos
  este esto fue fuimos fueron ha hace hicimos hay la las le les lo los mas me mi mis muestrame muestra nos nosotros nuestra nuestro nuestros para
  pero por primera primer que quiero recordar recuerdo recuerdos se sea ser si sin sobre su sus te tu un una uno unos unas vez veces y ya ultima
  ultimo cuantas cuantos fuiste hicieron dime ensename busca buscar ver vimos estuvimos juntos juntas bonito bonita lindo linda dia`.split(/\s+/),
);

export function parseQuestion(question: string): ParsedQuestion {
  const text = normalize(question);
  const order: MemoryOrder = /\b(primera vez|primer[ao]?\b|por primera)/.test(text)
    ? "first"
    : /\b(ultima vez|ultim[ao]\b|mas reciente)/.test(text)
      ? "last"
      : null;
  const yearMatch = text.match(/\b(19[89]\d|20\d\d)\b/);
  const terms = [
    ...new Set(
      text
        .replace(/[^a-z0-9ñ\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 3 && !STOPWORDS.has(word) && !/^\d+$/.test(word)),
    ),
  ].slice(0, 6);
  return { order, year: yearMatch ? Number(yearMatch[1]) : null, terms };
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2025-10-12" → "12 de octubre de 2025" (sin depender de Intl en el Worker). */
export function spanishDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} de ${MONTHS[(month ?? 1) - 1]} de ${year}`;
}

/** Texto que se convierte en vector. Junta todo lo que describe el recuerdo. */
export function memoryText(memory: {
  title: string;
  description: string | null;
  happened_on: string;
  category: string | null;
  place_name: string | null;
  tags: string[];
}): string {
  return [
    `Recuerdo: ${memory.title}.`,
    `Fecha: ${spanishDate(memory.happened_on)}.`,
    memory.place_name ? `Lugar: ${memory.place_name}.` : null,
    memory.category ? `Categoría: ${memory.category}.` : null,
    memory.tags.length > 0 ? `Etiquetas: ${memory.tags.join(", ")}.` : null,
    memory.description ? memory.description.slice(0, 2000) : null,
  ]
    .filter(Boolean)
    .join(" ");
}
