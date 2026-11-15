import type { FireRules } from "./calc";
import { BILL_LEVELS, DEFAULT_BILL_LEVEL_ORDER } from "./defaults";

// Рівень — віха на шляху до FIRE. Кілька видів віх (дні свободи, круглий капітал, рахунки, % цілі) зливаються в одну лінійку.
export type LevelKind = "freedom" | "capital" | "bill" | "percent" | "start";

export interface Level {
  n: number;
  capital: number;
  icon: string;
  title: string;
  kind: LevelKind;
  // Інші віхи, що потрапили на цей самий рівень при злитті
  also: string[];
  // Лише для рівня-рахунку: скільки коштує цей рахунок на місяць
  billCost?: number;
}

interface RawLevel {
  capital: number;
  icon: string;
  title: string;
  kind: LevelKind;
  priority: number;
  also?: string[];
  billCost?: number;
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

// `billOrder` — порядок рахунків, який користувач налаштував: рівні-рахунки йдуть саме в ньому
export function buildLevels(rules: FireRules, billOrder: number[] = DEFAULT_BILL_LEVEL_ORDER): Level[] {
  const dayCost = (rules.targetMonthlyPassive * 12) / 365;
  const target = rules.targetFireCapital;
  const raw: RawLevel[] = [];

  const days: number[] = [];
  for (let d = 30; d <= 365; d += 30) days.push(d);
  for (let d = 425; d <= 1095; d += 61) days.push(d);
  for (let d = 1186; d <= 1825; d += 91) days.push(d);
  for (let d = 2007; d < 9125; d += 182) days.push(d);
  for (const d of days) raw.push({ capital: d * dayCost, icon: "⏳", title: freedomDaysLabel(d), kind: "freedom", priority: 2 });

  for (let c = 2500; c <= 50000; c += 2500) raw.push({ capital: c, icon: "💰", title: `Капітал ${formatCapitalShort(c)}`, kind: "capital", priority: 1 });
  for (let c = 60000; c < target; c += 10000) raw.push({ capital: c, icon: "💰", title: `Капітал ${formatCapitalShort(c)}`, kind: "capital", priority: 1 });
  raw.push({ capital: 1000, icon: "🌱", title: "Перша $1,000", kind: "start", priority: 1 });

  if (rules.divDecimal > 0) {
    const scale = rules.targetMonthlyPassive / 1000;
    let cumulative = 0;
    const bills = billOrder.flatMap((id) => BILL_LEVELS.find((b) => b.id === id) ?? []);
    bills.forEach((bill, i) => {
      const cost = Math.round(bill.baseCost * scale);
      cumulative += cost;
      const last = i === bills.length - 1;
      raw.push({
        capital: (cumulative * 12) / rules.divDecimal,
        icon: bill.icon,
        title: last ? "FIRE: дивіденди платять за все" : `Дивіденди платять: ${bill.name}`,
        kind: "bill",
        priority: 4,
        billCost: cost,
      });
    });
  }

  for (const pct of [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]) {
    raw.push({ capital: (target * pct) / 100, icon: "🎯", title: `${pct}% до FIRE`, kind: "percent", priority: pct % 25 === 0 ? 3 : 0 });
  }

  raw.sort((a, b) => a.capital - b.capital);
  const merged: RawLevel[] = [];
  for (const m of raw) {
    const last = merged[merged.length - 1];
    if (last && m.capital <= (last.anchor ?? last.capital) * MERGE_RATIO) {
      // На злитому рівні лишається найцінніша віха: її назва і її поріг
      if (m.priority > last.priority) {
        last.also = [...(last.also ?? []), last.title];
        last.icon = m.icon;
        last.title = m.title;
        last.kind = m.kind;
        last.billCost = m.billCost;
        last.priority = m.priority;
        // Поріг рівня — поріг віхи-переможця, щоб числа в поясненні (дивіденди, дні) були точними
        last.capital = m.capital;
      } else {
        last.also = [...(last.also ?? []), m.title];
      }
    } else {
      merged.push({ ...m, anchor: m.capital });
    }
  }
  return merged.map((l, i) => ({ n: i + 1, capital: l.capital, icon: l.icon, title: l.title, kind: l.kind, also: l.also ?? [], ...(l.billCost !== undefined ? { billCost: l.billCost } : {}) }));
}

export const LEVEL_KIND_LABEL: Record<LevelKind, string> = {
  freedom: "Дні свободи",
  capital: "Круглий капітал",
  bill: "Рахунки з дивідендів",
  percent: "Частка цілі FIRE",
  start: "Початок шляху",
};

// Пояснення для вікна рівня: що саме означає ця віха при поточних налаштуваннях
export function describeLevel(level: Level, rules: FireRules): string[] {
  const dayCost = (rules.targetMonthlyPassive * 12) / 365;
  const monthlyDividends = (level.capital * rules.divDecimal) / 12;
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const yieldPct = +(rules.divDecimal * 100).toFixed(2);
  switch (level.kind) {
    case "freedom":
      return [
        `З капіталом ${money(level.capital)} ти покриваєш ≈ ${Math.round(level.capital / dayCost)} днів життя з витратами ${money(rules.targetMonthlyPassive)}/міс (${money(dayCost)} на день).`,
        "Це запас: скільки днів ти міг би не працювати, якби довелося жити з накопиченого.",
      ];
    case "bill":
      return [
        `Дивіденди з ${money(level.capital)} (${yieldPct}% на рік) дають ≈ ${money(monthlyDividends)} на місяць.`,
        "Цього вистачає, щоб портфель сам оплачував цей рахунок і всі, що вище в порядку покриття. Порядок рахунків можна змінити внизу списку рівнів на вкладці FIRE.",
      ];
    case "percent":
      return [
        `Ціль FIRE: ${money(rules.targetFireCapital)}. Це ${money(rules.targetMonthlyPassive)}/міс пасивного доходу при ${yieldPct}% дивідендів.`,
        `${money(level.capital)} це ${Math.round((level.capital / rules.targetFireCapital) * 100)}% цієї суми.`,
      ];
    case "start":
      return ["Перший тисячник. Найважче почати, далі капітал росте разом з внесками і дивідендами."];
    default:
      return [`Круглий капітал ${money(level.capital)}: позначка на шляху до ${money(rules.targetFireCapital)}.`];
  }
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
