export type ScaleMode = "auto" | "zero";

export interface Axis {
  min: number;
  max: number;
  ticks: number[];
}

const NICE_STEPS = [1, 2, 2.5, 5, 10];

function niceStep(span: number, count: number): number {
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return NICE_STEPS.map((f) => f * mag).find((s) => s >= raw) ?? raw;
}

/**
 * Вісь Y для графіка. "zero" — від $0 (чесні пропорції); "auto" — наближено до діапазону даних,
 * щоб внесок $1k на капіталі $100k було видно як помітний крок.
 */
export function buildAxis(values: number[], mode: ScaleMode, count = 4): Axis {
  const finite = values.filter(Number.isFinite);
  let lo = finite.length ? Math.min(...finite) : 0;
  let hi = finite.length ? Math.max(...finite) : 0;

  if (mode === "zero" || lo <= 0) {
    lo = Math.min(0, lo);
  } else {
    const span = hi - lo;
    // Плоскі дані (одна точка або без змін): даємо ±5% простору, щоб лінія не лежала на краю
    const pad = span > 0 ? span * 0.12 : Math.max(hi * 0.05, 1);
    lo = Math.max(0, lo - pad);
    hi = hi + (span > 0 ? span * 0.08 : pad);
  }
  if (hi <= lo) hi = lo + 1;

  const step = niceStep(hi - lo, count);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 1000; v += step) ticks.push(Number(v.toFixed(6)));
  return { min, max, ticks };
}
