import { daysBetween, nextYearlyOccurrence, todayIn, utcToZoned } from "@shared/dates";
import type { Bindings } from "../env";
import { createImportantDateRepository } from "../repositories/importantDateRepository";
import { createPushRepository } from "../repositories/pushRepository";
import { toImportantDate } from "./importantDateService";
import { deliver, vapidKeys, type Notice } from "./notificationService";

// Avisos programados (fase 13). Los dispara el Cron Trigger del Worker `app` cada 15 minutos.
// Cada aviso tiene una clave única, así que aunque el cron corra muchas veces se envía una sola vez.

/** Cartas y cápsulas que se desbloquearon hace más de esto ya no se avisan (p. ej. al activar los avisos). */
const UNLOCK_LOOKBACK_MS = 36 * 3600 * 1000;
/** Los avisos del día (fechas, planes) solo entre estas horas locales de la pareja: nada de madrugada. */
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 21;
/** Las claves de avisos enviados se olvidan después de esto. */
const SENT_RETENTION_DAYS = 60;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;


/**
 * Meses cumplidos si hoy es "mesiversario" (mismo día del mes que el inicio; si ese día no existe en
 * este mes, el último día del mes). null si hoy no toca.
 */
export function monthsTogetherToday(startedOn: string, today: string): number | null {
  const [sy, sm, sd] = startedOn.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const months = (ty - sy) * 12 + (tm - sm);
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return months > 0 && td === Math.min(sd, lastDay) ? months : null;
}

interface Relationship {
  id: string;
  started_on: string;
  timezone: string;
}

/** Aniversario y mesiversario (hoy) y aviso del aniversario un día antes. */
export function anniversaryNotices(relationship: Relationship, today: string): Notice[] {
  const notices: Notice[] = [];
  const base = { category: "dates" as const, ttl: 12 * 3600 };
  const next = nextYearlyOccurrence(relationship.started_on, today);

  if (next.date === today) {
    notices.push({
      ...base,
      key: `anniversary:${relationship.id}:${today}`,
      payload: {
        title: next.years === 1 ? "💞 Hoy es su primer aniversario" : `💞 Hoy cumplen ${next.years} años juntos`,
        body: "Feliz aniversario. Un buen día para guardar un recuerdo.",
        url: "/nosotros",
        tag: "anniversary",
      },
    });
  } else {
    const total = monthsTogetherToday(relationship.started_on, today);
    if (total !== null) {
      const years = Math.floor(total / 12);
      const months = total % 12;
      const time = years === 0 ? plural(months, "mes", "meses") : `${plural(years, "año", "años")} y ${plural(months, "mes", "meses")}`;
      notices.push({ ...base, key: `monthiversary:${relationship.id}:${today}`, payload: { title: `💗 Hoy cumplen ${time} juntos`, body: "Feliz mesiversario.", url: "/nosotros", tag: "anniversary" } });
    }
    if (daysBetween(today, next.date) === 1) {
      notices.push({
        ...base,
        key: `anniversary-eve:${relationship.id}:${next.date}`,
        payload: { title: "💞 Mañana es su aniversario", body: next.years === 1 ? "Su primer año juntos." : `Cumplen ${next.years} años juntos.`, url: "/nosotros", tag: "anniversary-eve" },
      });
    }
  }
  return notices;
}

export async function runReminders(env: Bindings, now: Date = new Date(), fetcher?: typeof fetch): Promise<number> {
  if (!vapidKeys(env)) return 0;
  const repository = createPushRepository(env.DB);
  const nowIso = now.toISOString();
  const since = new Date(now.getTime() - UNLOCK_LOOKBACK_MS).toISOString();
  let sent = 0;

  for (const relationship of await repository.listRelationships()) {
    const members = await repository.listMembers(relationship.id);
    const everyone = members.map((m) => m.id);
    const pending: { userIds: string[]; notice: Notice }[] = [];

    // Cartas programadas y sorpresas que llegaron a su fecha.
    for (const letter of await repository.listUnlockedLetters(relationship.id, since, nowIso)) {
      pending.push({
        userIds: [letter.recipient_id],
        notice: {
          key: `letter-unlock:${letter.id}`,
          category: "letters",
          payload: { title: `💌 Ya puedes abrir la carta de ${letter.author_name}`, body: "Te está esperando.", url: `/cartas/${letter.id}`, tag: `letter-${letter.id}` },
        },
      });
    }

    // Cápsulas que llegaron a su fecha.
    for (const capsule of await repository.listUnlockedCapsules(relationship.id, since, nowIso)) {
      pending.push({
        userIds: capsule.recipient_id ? [capsule.recipient_id] : everyone,
        notice: {
          key: `capsule-unlock:${capsule.id}`,
          category: "capsules",
          payload: { title: "⏳ Ya se puede abrir una cápsula del tiempo", body: `“${capsule.title}”`, url: `/futuro/${capsule.id}`, tag: `capsule-${capsule.id}` },
        },
      });
    }

    // Lo del día: solo de día en la zona horaria de la pareja.
    const hour = Number(utcToZoned(nowIso, relationship.timezone).time.slice(0, 2));
    if (hour >= DAY_START_HOUR && hour <= DAY_END_HOUR) {
      const today = todayIn(relationship.timezone, now);
      for (const notice of anniversaryNotices(relationship, today)) pending.push({ userIds: everyone, notice });

      for (const row of await createImportantDateRepository(env.DB).list(relationship.id)) {
        const date = toImportantDate(row, today);
        if (date.daysUntil === 0) {
          let body = "Que tengan un lindo día.";
          if (date.type === "birthday" && date.years) body = `Cumple ${date.years} años 🎂`;
          else if (date.years) body = `Se cumplen ${plural(date.years, "año", "años")}.`;
          pending.push({
            userIds: everyone,
            notice: { key: `date:${row.id}:${today}`, category: "dates", ttl: 12 * 3600, payload: { title: `${date.emoji} Hoy: ${date.title}`, body, url: "/nosotros", tag: `date-${row.id}` } },
          });
        } else if (date.daysUntil === 1) {
          pending.push({
            userIds: everyone,
            notice: {
              key: `date-eve:${row.id}:${date.nextDate}`,
              category: "dates",
              ttl: 12 * 3600,
              payload: { title: `${date.emoji} Mañana: ${date.title}`, body: "Para que lo tengan presente.", url: "/nosotros", tag: `date-${row.id}` },
            },
          });
        }
      }

      for (const plan of await repository.listPlansOn(relationship.id, today)) {
        pending.push({
          userIds: everyone,
          notice: { key: `plan:${plan.id}:${today}`, category: "plans", ttl: 12 * 3600, payload: { title: "📅 Hoy tienen un plan", body: plan.title, url: `/planes/${plan.id}`, tag: `plan-${plan.id}` } },
        });
      }
    }

    for (const { userIds, notice } of pending) sent += await deliver(env, userIds, notice, fetcher);
  }

  await repository.pruneSent(new Date(now.getTime() - SENT_RETENTION_DAYS * 86_400_000).toISOString());
  return sent;
}

