import {
  overviewWidgets as legacyWidgets,
  type DashboardLayout,
  type RevenueFilter,
  revenueRanges,
  revenueGroups,
  revenuePeriod,
  revenueSnapshot,
} from './overview';
import type { Data } from './crm';
import { dateAdd } from './sales';

export const overviewWidgets = {
  ...legacyWidgets,
  attention: 'Needs Your Attention',
  proposals: 'Open Proposals',
};
export type WidgetId = keyof typeof overviewWidgets;
export type OverviewWidget = {
  id: WidgetId;
  enabled: boolean;
  column: 'full' | 'main' | 'side';
  limit: number;
  hideEmpty: boolean;
};
export type OverviewLayout = { widgets: OverviewWidget[] };
export function defaultOverview(legacy?: DashboardLayout): OverviewLayout {
  const order: WidgetId[] = [
    'summary',
    'attention',
    'upcoming',
    'revenue',
    'proposals',
    'recent',
    'messages',
    'leads',
    'payments',
    'followups',
    'services',
    'tools',
  ];
  return {
    widgets: order.map((id) => {
      const old = legacy?.widgets.find((w) => w.id === id);
      return {
        id,
        enabled: old?.enabled ?? true,
        column: ['attention', 'recent', 'leads'].includes(id)
          ? 'main'
          : ['upcoming', 'proposals', 'messages', 'payments'].includes(id)
            ? 'side'
            : 'full',
        limit: old?.limit ?? 3,
        hideEmpty:
          old?.hideEmpty ??
          !['summary', 'attention', 'upcoming', 'revenue'].includes(id),
      };
    }),
  };
}
export function checkedOverview(input: unknown): OverviewLayout {
  const widgets = (input as OverviewLayout)?.widgets;
  if (
    !Array.isArray(widgets) ||
    widgets.length !== Object.keys(overviewWidgets).length ||
    new Set(widgets.map((w) => w?.id)).size !== widgets.length
  )
    throw Error('Include each dashboard widget once.');
  return {
    widgets: widgets.map((w) => {
      if (
        !w ||
        !Object.hasOwn(overviewWidgets, w.id) ||
        !['full', 'main', 'side'].includes(w.column) ||
        typeof w.enabled !== 'boolean' ||
        typeof w.hideEmpty !== 'boolean' ||
        !Number.isInteger(w.limit) ||
        w.limit < 1 ||
        w.limit > 50
      )
        throw Error('Choose valid widget settings (1–50 results).');
      return {
        id: w.id,
        enabled: w.enabled,
        column: w.column,
        limit: w.limit,
        hideEmpty: w.hideEmpty,
      };
    }),
  };
}
// Refresh the previous default arrangement without overwriting customized layouts.
export function presentOverview(layout: OverviewLayout): OverviewLayout {
  const priorOrder = [
    'summary',
    'attention',
    'proposals',
    'upcoming',
    'revenue',
    'recent',
    'messages',
    'leads',
    'payments',
    'followups',
    'services',
    'tools',
  ];
  const priorColumn = (id: string) =>
    ['attention', 'recent', 'leads'].includes(id)
      ? 'main'
      : ['proposals', 'messages', 'payments'].includes(id)
        ? 'side'
        : 'full';
  if (
    layout.widgets.length !== priorOrder.length ||
    !layout.widgets.every(
      (w, i) => w.id === priorOrder[i] && w.column === priorColumn(w.id),
    )
  )
    return layout;
  return {
    widgets: defaultOverview().widgets.map((w) => {
      const old = layout.widgets.find((previous) => previous.id === w.id)!;
      return {
        ...old,
        column: w.column,
        limit: old.id === 'attention' && old.limit === 6 ? 3 : old.limit,
      };
    }),
  };
}
export type RevenuePreferences = RevenueFilter & { compare: boolean };
export const defaultRevenue = (today: string): RevenuePreferences => ({
  basis: 'Payment',
  range: 'This month',
  group: 'Day',
  from: today.slice(0, 7) + '-01',
  to: today,
  compare: true,
});
export function checkedRevenue(input: unknown): RevenuePreferences {
  const p = input as RevenuePreferences;
  if (
    !p ||
    !['Payment', 'Scheduled', 'Booked'].includes(p.basis) ||
    !revenueRanges.includes(p.range) ||
    !revenueGroups.includes(p.group) ||
    typeof p.compare !== 'boolean' ||
    typeof p.from !== 'string' ||
    typeof p.to !== 'string'
  )
    throw Error('Choose valid revenue preferences.');
  revenuePeriod('Custom', '2026-01-01', p.from, p.to);
  return {
    basis: p.basis,
    range: p.range,
    group: p.group,
    from: p.from,
    to: p.to,
    compare: p.compare,
  };
}
export function previousRevenuePeriod(filter: RevenueFilter, today: string) {
  const current = revenuePeriod(filter.range, today, filter.from, filter.to);
  const [y, m] = current.from.split('-').map(Number);
  if (['This year', 'Last year', 'Next year'].includes(filter.range))
    return { from: y - 1 + '-01-01', to: y - 1 + '-12-31' };
  if (filter.range === 'Year to date') {
    const month = Number(current.to.slice(5, 7)),
      last = new Date(Date.UTC(y - 1, month, 0)).getUTCDate();
    return {
      from: y - 1 + '-01-01',
      to:
        y -
        1 +
        current.to.slice(4, 8) +
        String(Math.min(Number(current.to.slice(8)), last)).padStart(2, '0'),
    };
  }
  if (
    ['Last 3 months', 'Last 12 months', '+/- 3 Months'].includes(filter.range)
  ) {
    const months =
      filter.range === 'Last 3 months'
        ? 3
        : filter.range === 'Last 12 months'
          ? 12
          : 7;
    return {
      from: new Date(Date.UTC(y, m - 1 - months, 1)).toISOString().slice(0, 10),
      to: dateAdd(current.from, -1),
    };
  }
  if (['This month', 'Month to date'].includes(filter.range)) {
    const from = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
    return {
      from,
      to:
        filter.range === 'This month'
          ? last
          : from.slice(0, 8) +
            String(
              Math.min(Number(today.slice(8)), Number(last.slice(8))),
            ).padStart(2, '0'),
    };
  }
  const length =
    Math.round((Date.parse(current.to) - Date.parse(current.from)) / 86400000) +
    1;
  return {
    from: dateAdd(current.from, -length),
    to: dateAdd(current.from, -1),
  };
}
export function revenueComparison(
  data: Data,
  filter: RevenueFilter,
  today: string,
) {
  const period = previousRevenuePeriod(filter, today);
  return revenueSnapshot(
    data,
    { ...filter, range: 'Custom', ...period },
    today,
  );
}
