'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { money, prettyDate, type Data, type EventRecord } from '@/lib/crm';
export function CalendarView({
  data,
  onOpen,
}: {
  data: Data;
  onOpen: (e: EventRecord) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const start = month.getDay(),
    length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  function move(n: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  }
  return (
    <section className="panel calendar-panel">
      <div className="panel-heading">
        <h2>
          {month.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </h2>
        <div className="calendar-controls">
          <button aria-label="Previous month" onClick={() => move(-1)}>
            <ChevronLeft />
          </button>
          <button
            onClick={() =>
              setMonth(
                new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              )
            }
          >
            Today
          </button>
          <button aria-label="Next month" onClick={() => move(1)}>
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="calendar-scroll">
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <strong className="weekday" key={d}>
              {d}
            </strong>
          ))}
          {Array.from({ length: start }, (_, i) => (
            <div className="day-cell outside" key={'empty' + i} />
          ))}
          {Array.from({ length }, (_, i) => {
            const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            return (
              <div className="day-cell" key={date}>
                <span>{i + 1}</span>
                {data.events
                  .filter((e) => e.date === date)
                  .map((e) => (
                    <button
                      key={e.id}
                      className={`calendar-event ${e.status}`}
                      onClick={() => onOpen(e)}
                    >
                      <small>{e.time || e.status}</small>
                      {e.title}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
export function PaymentsView({ data }: { data: Data }) {
  const rows = data.payments || [];
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Recorded payments</h2>
        <span>{money(rows.reduce((s, p) => s + p.amount, 0))} received</span>
      </div>
      <p className="capability-note">
        Record payments from an event’s Payments tab. Card processing is not
        connected.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{prettyDate(p.date)}</TableCell>
              <TableCell>
                {data.events.find((e) => e.id === p.event_id)?.title}
              </TableCell>
              <TableCell>{p.method}</TableCell>
              <TableCell>{p.reference || '—'}</TableCell>
              <TableCell>{money(p.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && (
        <p className="padded muted">No payments recorded yet.</p>
      )}
    </section>
  );
}
export function ReportsView({ data }: { data: Data }) {
  const paid = (data.payments || []).reduce((s, p) => s + p.amount, 0),
    expenses = (data.resources || [])
      .filter((r) => r.kind === 'expenses' && !r.archived)
      .reduce((s, r) => s + Math.round(Number(r.data.amount) * 100), 0),
    booked = data.events
      .filter((e) => e.status === 'confirmed')
      .reduce((s, e) => s + e.total, 0);
  return (
    <>
      <section className="stats">
        {[
          ['Confirmed booking value', booked],
          ['Recorded payments', paid],
          ['Recorded expenses', expenses],
          ['Payments less expenses', paid - expenses],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{money(Number(value))}</strong>
            <small>All dates · USD</small>
          </article>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Booking value by service</h2>
        </div>
        <div className="report-bars">
          {(data.business?.services || []).map((service) => {
            const value = data.events
              .filter((e) => e.status === 'confirmed')
              .flatMap((e) => e.items)
              .filter((p) => p.service === service)
              .reduce((s, p) => s + p.price, 0);
            return (
              <div key={service}>
                <span>{service}</span>
                <div>
                  <i
                    style={{
                      width: `${booked ? Math.min(100, (value / booked) * 100) : 0}%`,
                    }}
                  />
                </div>
                <b>{money(value)}</b>
              </div>
            );
          })}
        </div>
        <p className="padded fine-print">
          Service totals show package value only; extras, tax, travel and
          discounts appear in event totals.
        </p>
      </section>
    </>
  );
}
