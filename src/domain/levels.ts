import type { FireRules } from "./calc";
import { BILL_LEVELS } from "./defaults";

// Рівень — віха на шляху до FIRE. Кілька видів віх (дні свободи, круглий капітал, рахунки, % цілі) зливаються в одну лінійку.
export interface Level {
  n: number;
  capital: number;
  icon: string;
  title: string;
}

interface RawLevel {
  capital: number;
  icon: string;
  title: string;
  priority: number;
  // Поріг першої віхи групи: нові віхи зливаються з групою лише поки вони близько до неї, тож ланцюжок не розтягується
  anchor?: number;
}

// Віхи ближче за 3% одна до одної зливаються в одну: два рівні за той самий долар не потрібні
const MERGE_RATIO = 1.03;

const plural = (n: number, one: string, few: string, many: string): string => {
  const t = n % 10;
  const h = n % 100;
  return t === 1 && h !== 11 ? one : t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
};

export function formatCapitalShort(n: number): string {
  if (n < 10000) return `$${Math.round(n).toLocaleString("en-US")}`;
  const k = n / 1000;
  return `$${(k >= 100 ? k.toFixed(0) : k.toFixed(1)).replace(/\.0$/, "")}k`;
}

export function freedomDaysLabel(days: number): string {
  if (days < 365) {
    return days % 30 === 0
      ? `${days / 30} ${plural(days / 30, "місяць", "місяці", "місяців")} свободи`
      : `${days} днів свободи`;
  }
  const totalMonths = Math.round(days / 30.4375);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${years} ${plural(years, "рік", "роки", "років")}${months ? ` ${months} міс` : ""} свободи`;
}

export function buildLevels(rules: FireRules): Level[] {
  const dayCost = (rules.targetMonthlyPassive * 12) / 365;
  const target = rules.targetFireCapital;
  const raw: RawLevel[] = [];

  const days: number[] = [];
  for (let d = 30; d <= 365; d += 30) days.push(d);
  for (let d = 425; d <= 1095; d += 61) days.push(d);
  for (let d = 1186; d <= 1825; d += 91) days.push(d);
  for (let d = 2007; d < 9125; d += 182) days.push(d);
  for (const d of days) raw.push({ capital: d * dayCost, icon: "⏳", title: freedomDaysLabel(d), priority: 2 });

  for (let c = 2500; c <= 50000; c += 2500) raw.push({ capital: c, icon: "💰", title: `Капітал ${formatCapitalShort(c)}`, priority: 1 });
  for (let c = 60000; c < target; c += 10000) raw.push({ capital: c, icon: "💰", title: `Капітал ${formatCapitalShort(c)}`, priority: 1 });
  raw.push({ capital: 1000, icon: "🌱", title: "Перша $1,000", priority: 1 });

  if (rules.divDecimal > 0) {
    const scale = rules.targetMonthlyPassive / 1000;
    let cumulative = 0;
    BILL_LEVELS.forEach((bill, i) => {
      cumulative += Math.round(bill.baseCost * scale);
      const last = i === BILL_LEVELS.length - 1;
      raw.push({
        capital: (cumulative * 12) / rules.divDecimal,
        icon: bill.icon,
        title: last ? "FIRE: дивіденди платять за все" : `Дивіденди платять: ${bill.name}`,
        priority: 4,
      });
    });
  }

  for (const pct of [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]) {
    raw.push({ capital: (target * pct) / 100, icon: "🎯", title: `${pct}% до FIRE`, priority: 0 });
  }

  raw.sort((a, b) => a.capital - b.capital);
  const merged: RawLevel[] = [];
  for (const m of raw) {
    const last = merged[merged.length - 1];
    if (last && m.capital <= (last.anchor ?? last.capital) * MERGE_RATIO) {
      // На злитому рівні лишається назва найціннішої віхи, а поріг — найвищий
      if (m.priority > last.priority) {
        last.icon = m.icon;
        last.title = m.title;
        last.priority = m.priority;
      }
      last.capital = Math.max(last.capital, m.capital);
    } else {
      merged.push({ ...m, anchor: m.capital });
    }
  }
  return merged.map((l, i) => ({ n: i + 1, capital: l.capital, icon: l.icon, title: l.title }));
}

// Скільки рівнів уже пройдено при цьому капіталі (0 — ще нічого)
export function levelAt(levels: Level[], capital: number): number {
  let n = 0;
  for (const l of levels) {
    if (capital >= l.capital) n = l.n;
    else break;
  }
  return n;
}

export interface LevelProgress {
  level: number;
  next: Level | null;
  pct: number;
  toNext: number;
}

export function getLevelProgress(levels: Level[], capital: number): LevelProgress {
  const level = levelAt(levels, capital);
  const next = levels[level] ?? null;
  const prev = level > 0 ? levels[level - 1].capital : 0;
  return {
    level,
    next,
    pct: next ? Math.min(100, Math.max(0, ((capital - prev) / (next.capital - prev)) * 100)) : 100,
    toNext: next ? Math.max(0, next.capital - capital) : 0,
  };
}
