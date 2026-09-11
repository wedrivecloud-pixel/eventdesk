'use client';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { money, prettyDate, type EventRecord } from '@/lib/crm';
import type { RevenueBasis, RevenueBucket } from '@/lib/overview';
import { downloadCsv } from '@/lib/sales';
import { SChoice, STable } from './sales-ui';

export const revenueSeries = (basis: RevenueBasis) =>
  (basis === 'Payment'
    ? [{ key: 'paid', label: 'Collected', color: '#168475' }]
    : [
        { key: 'paid', label: 'Collected', color: '#168475' },
        { key: 'projected', label: 'Expected balance', color: '#426ce8' },
        { key: 'postponed', label: 'Postponed', color: '#d99022' },
        { key: 'pastDue', label: 'Past Due', color: '#d23f40' },
      ]) as {
    key: 'paid' | 'projected' | 'postponed' | 'pastDue';
    label: string;
    color: string;
  }[];

function Breakdown({
  row,
  basis,
}: {
  row: RevenueBucket;
  basis: RevenueBasis;
}) {
  return (
    <dl className="revenue-breakdown">
      {revenueSeries(basis).map((s) => (
        <div key={s.key}>
          <dt>
            <i style={{ background: s.color }} />
            {s.label}
          </dt>
          <dd>{money(row[s.key])}</dd>
        </div>
      ))}
      <div>
        <dt>Bookings</dt>
        <dd>{row.count}</dd>
      </div>
      {basis === 'Payment' && (
        <div>
          <dt>Payments</dt>
          <dd>{row.entries.length}</dd>
        </div>
      )}
      <div className="revenue-breakdown-total">
        <dt>Total</dt>
        <dd>{money(row.total)}</dd>
      </div>
    </dl>
  );
}

export function RevenueChart({
  rows,
  basis,
  title,
  onOpen,
}: {
  rows: RevenueBucket[];
  basis: RevenueBasis;
  title: string;
  onOpen?: (event: EventRecord, tab?: string) => void;
}) {
  const [periodKey, setPeriodKey] = useState('');
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const selected =
    rows.find((r) => r.key === periodKey) ||
    rows.find((r) => r.count > 0) ||
    rows[0];
  const detail = rows.find((r) => r.key === detailKey);
  const series = revenueSeries(basis);
  const openPeriod = (row: RevenueBucket) => {
    setPeriodKey(row.key);
    setDetailKey(row.key);
  };
  const headers =
    basis === 'Payment'
      ? [
          'Booking',
          'Client',
          'Event date',
          'Payment date',
          'Method',
          'Collected',
        ]
      : [
          'Booking',
          'Client',
          'Status',
          'Event date',
          'Booked date',
          ...series.map((s) => s.label),
          'Total',
        ];
  return (
    <>
      <p className="revenue-chart-help">
        Hover for a breakdown. Click or tap a period to see its{' '}
        {basis === 'Payment' ? 'payments' : 'bookings'}.
      </p>
      <fieldset className="overview-chart" aria-label={title}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={rows}
            margin={{ top: 12, right: 20, bottom: 12, left: 12 }}
            accessibilityLayer
            onClick={(state) => {
              const index = state.activeTooltipIndex;
              if (
                !state.isTooltipActive ||
                index === null ||
                index === undefined ||
                index === ''
              )
                return;
              const row = rows[Number(index)];
              if (row) openPeriod(row);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" minTickGap={25} tick={{ fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => money(Number(v))}
              width={82}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              isAnimationActive={false}
              content={({ active, label }) => {
                const row = rows.find((r) => r.label === label);
                return active && row ? (
                  <div className="revenue-tooltip">
                    <strong>{row.label}</strong>
                    <Breakdown row={row} basis={basis} />
                    <small>
                      Click to view{' '}
                      {basis === 'Payment' ? 'payments' : 'bookings'}
                    </small>
                  </div>
                ) : null;
              }}
            />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                stackId="revenue"
                maxBarSize={32}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
                onClick={(entry, _index, event) => {
                  event.stopPropagation();
                  const row = rows.find((r) => r.key === entry.payload?.key);
                  if (row) openPeriod(row);
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </fieldset>
      <div className="overview-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="revenue-period-picker">
        <SChoice
          label="View period details"
          value={selected?.key || ''}
          options={rows.map((r) => ({ value: r.key, label: r.label }))}
          onChange={setPeriodKey}
        />
        <button
          className="secondary"
          disabled={!selected}
          onClick={() => selected && openPeriod(selected)}
        >
          View details
        </button>
      </div>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetailKey(null);
        }}
      >
        <DialogContent className="crm-dialog revenue-details-dialog">
          <DialogHeader>
            <DialogTitle>
              {detail?.label} ·{' '}
              {basis === 'Payment' ? 'Payment details' : 'Booking details'}
            </DialogTitle>
            <DialogDescription>
              {basis === 'Payment'
                ? 'Payment date'
                : basis === 'Booked'
                  ? 'Date booked'
                  : 'Scheduled date'}
              :{' '}
              {detail &&
                `${prettyDate(detail.from)} – ${prettyDate(detail.to)}`}
              . These records make up the selected graph period.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <>
              <Breakdown row={detail} basis={basis} />
              <button
                className="secondary revenue-detail-export"
                onClick={() =>
                  downloadCsv('revenue-details-' + detail.key, [
                    headers,
                    ...detail.entries.map((e) =>
                      basis === 'Payment'
                        ? [
                            e.event.title,
                            e.event.client,
                            e.event.date,
                            e.date,
                            e.method || '',
                            e.paid / 100,
                          ]
                        : [
                            e.event.title,
                            e.event.client,
                            e.event.lifecycle === 'Postponed'
                              ? 'Postponed'
                              : 'Confirmed',
                            e.event.date,
                            e.bookedDate,
                            ...series.map((s) => e[s.key] / 100),
                            e.total / 100,
                          ],
                    ),
                  ])
                }
              >
                Export details CSV
              </button>
              <STable
                headers={headers}
                empty={
                  basis === 'Payment'
                    ? 'No payments were recorded in this period.'
                    : 'No bookings match this period.'
                }
                rows={detail.entries.map((e) => {
                  const booking = onOpen ? (
                    <button
                      className="record-link"
                      onClick={() => {
                        setDetailKey(null);
                        onOpen(
                          e.event,
                          basis === 'Payment' ? 'payments' : undefined,
                        );
                      }}
                    >
                      {e.event.title}
                    </button>
                  ) : (
                    e.event.title
                  );
                  return basis === 'Payment'
                    ? [
                        booking,
                        e.event.client,
                        prettyDate(e.event.date),
                        prettyDate(e.date),
                        e.method || '—',
                        money(e.paid),
                      ]
                    : [
                        booking,
                        e.event.client,
                        e.event.lifecycle === 'Postponed'
                          ? 'Postponed'
                          : 'Confirmed',
                        prettyDate(e.event.date),
                        prettyDate(e.bookedDate),
                        ...series.map((s) => money(e[s.key])),
                        money(e.total),
                      ];
                })}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
