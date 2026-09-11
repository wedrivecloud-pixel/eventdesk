import type { LineItem } from './crm';
import { eventDates } from './package-pricing';
export function eventWindow(e: {
  date: string;
  time: string;
  items: LineItem[];
}) {
  const days = eventDates(e.items, e.date),
    allDay =
      !e.time ||
      e.items.some((p) => p.packageSettings?.dateMode === 'Date Only');
  const start = Date.parse(e.date + 'T' + (allDay ? '00:00' : e.time) + ':00Z');
  const minutes = allDay
    ? Math.max(1, days.length) * 1440
    : Math.max(
        1,
        ...e.items.map(
          (p) =>
            (p.minutes || p.packageSettings?.includedMinutes || 240) +
            (p.extraMinutes || 0),
        ),
      );
  return { start, end: start + minutes * 60000 };
}
export function windowsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
) {
  return a.start < b.end && b.start < a.end;
}
