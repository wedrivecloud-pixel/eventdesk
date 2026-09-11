'use client';
import { useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  CircleDashed,
  Clock3,
  Inbox,
  Wallet,
  Check,
  AlertCircle,
} from 'lucide-react';
import { money, prettyDate, type Data, type EventRecord } from '@/lib/crm';
import {
  eventReadiness,
  overviewSummary,
  proposalExpiry,
  type AttentionItem,
} from '@/lib/overview-priorities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { STabs } from './sales-ui';

type Open = (e: EventRecord, tab?: string) => void;
export function DailySummary({
  data,
  today,
  onSelect,
}: {
  data: Data;
  today: string;
  onSelect: (key: string) => void;
}) {
  const s = overviewSummary(data, today);
  return (
    <section className="daily-summary" aria-label="Business at a glance">
      {[
        {
          key: 'collected',
          label: 'Collected this month',
          value: money(s.collected),
          note: 'Recorded payments · excluding tips',
          Icon: Wallet,
        },
        {
          key: 'outstanding',
          label: 'Outstanding',
          value: money(s.outstanding),
          note: 'Confirmed & postponed bookings',
          Icon: Clock3,
        },
        {
          key: 'next30',
          label: 'Upcoming events',
          value: String(s.upcoming),
          note: 'Confirmed · next 30 days',
          Icon: CalendarDays,
        },
        {
          key: 'requests',
          label: 'Requests to approve',
          value: String(s.requests),
          note: 'Online booking requests',
          Icon: Inbox,
        },
      ].map(({ key, label, value, note, Icon }) => (
        <button
          key={key}
          className={'daily-stat daily-stat-' + key}
          onClick={() => onSelect(key)}
        >
          <span className="daily-stat-top">
            <Icon size={18} />
            <ArrowUpRight size={16} />
          </span>
          <span className="daily-stat-label">{label}</span>
          <strong>{value}</strong>
          <small>{note}</small>
        </button>
      ))}
    </section>
  );
}
export function Readiness({
  event,
  data,
  today,
  onOpen,
}: {
  event: EventRecord;
  data: Data;
  today: string;
  onOpen: Open;
}) {
  const checks = eventReadiness(event, data, today),
    complete = checks.filter((c) => c.state === 'done').length;
  return (
    <div className="event-readiness">
      <div className="readiness-heading">
        <span>Event preparation</span>
        <span>
          {complete} of {checks.length} checked
        </span>
      </div>
      <div className="readiness-track" aria-hidden="true">
        {checks.map((c) => (
          <i key={c.key} data-state={c.state} />
        ))}
      </div>
      <div className="readiness-checks">
        {checks.map((c) => (
          <button
            key={c.key}
            data-state={c.state}
            onClick={() =>
              onOpen(
                event,
                event.status !== 'lead' && c.key === 'questions'
                  ? 'Questionnaires'
                  : event.status !== 'lead' && c.key === 'checklist'
                    ? 'Checklists'
                    : c.tab,
              )
            }
            title={c.detail}
          >
            {c.state === 'done' ? (
              <CircleCheck size={15} />
            ) : c.state === 'needed' ? (
              <AlertCircle size={15} />
            ) : (
              <CircleDashed size={15} />
            )}
            <span>
              {c.label}
              <small>{c.detail}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
export function Attention({
  items,
  limit,
  onOpen,
}: {
  items: AttentionItem[];
  limit: number;
  onOpen: Open;
}) {
  const [filter, setFilter] = useState('All'),
    [expanded, setExpanded] = useState(false);
  const matching = items.filter(
    (i) =>
      filter === 'All' ||
      (filter === 'Approvals'
        ? i.category === 'approval'
        : filter === 'Payments'
          ? i.category === 'payment'
          : filter === 'Follow-ups'
            ? i.category === 'followup'
            : filter === 'Proposals'
              ? i.category === 'proposal'
              : ['staff', 'questions', 'checklist'].includes(i.category)),
  );
  const row = (i: AttentionItem) => (
    <button
      className="attention-row"
      key={i.id}
      onClick={() => {
        setExpanded(false);
        onOpen(i.event, i.tab);
      }}
    >
      <span className={'attention-dot attention-level-' + i.urgency} />
      <span>
        <strong>{i.label}</strong>
        <span>{i.event.client || i.event.title}</span>
        <small>
          {i.detail} · {prettyDate(i.due)}
        </small>
      </span>
      <ArrowUpRight size={17} />
    </button>
  );
  return (
    <section className="panel attention-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Needs Your Attention{' '}
            <span className="overview-count">{items.length}</span>
          </h2>
        </div>
      </div>
      <STabs
        tabs={[
          'All',
          'Approvals',
          'Payments',
          'Follow-ups',
          'Proposals',
          'Preparation',
        ]}
        value={filter}
        onChange={setFilter}
      />
      {matching.length ? (
        matching.slice(0, limit).map(row)
      ) : (
        <div className="attention-clear">
          <span>
            <Check size={23} />
          </span>
          <div>
            <strong>
              {items.length
                ? 'Nothing in this category.'
                : 'You’re clear for now.'}
            </strong>
            <p>
              {items.length
                ? 'Choose another category to review.'
                : 'No pending items were found in your saved records.'}
            </p>
          </div>
        </div>
      )}
      {matching.length > limit && (
        <button
          className="overview-view-all record-link"
          onClick={() => setExpanded(true)}
        >
          View all {matching.length} items <ArrowUpRight size={15} />
        </button>
      )}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="crm-dialog attention-dialog">
          <DialogHeader>
            <DialogTitle>Needs Your Attention · {filter}</DialogTitle>
            <DialogDescription>
              Open an item to review its record and take the next step.
            </DialogDescription>
          </DialogHeader>
          {matching.map(row)}
        </DialogContent>
      </Dialog>
    </section>
  );
}
export function ProposalQueue({
  events,
  limit,
  today,
  onOpen,
  onAll,
}: {
  events: EventRecord[];
  limit: number;
  today: string;
  onOpen: Open;
  onAll: () => void;
}) {
  return (
    <section className="panel proposal-queue">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">KEEP CONVERSATIONS MOVING</span>
          <h2>Open Proposals</h2>
        </div>
        <span className="overview-count">{events.length}</span>
      </div>
      <div className="proposal-value">
        <strong>{money(events.reduce((n, e) => n + e.total, 0))}</strong>
        <span>potential booking value</span>
      </div>
      {events.slice(0, limit).map((e) => (
        <button
          className="proposal-queue-row"
          key={e.id}
          onClick={() => onOpen(e)}
        >
          <div>
            <strong>{e.client}</strong>
            <b>{money(e.total)}</b>
          </div>
          <span>{e.title}</span>
          <small>Event · {prettyDate(e.date)}</small>
          <small
            className={
              proposalExpiry(e) && proposalExpiry(e) < today
                ? 'proposal-expired'
                : ''
            }
          >
            {proposalExpiry(e)
              ? (proposalExpiry(e) < today ? 'Expired · ' : 'Expires · ') +
                prettyDate(proposalExpiry(e))
              : 'No expiration set'}
          </small>
          <small>
            Follow-up ·{' '}
            {e.follow_up ? prettyDate(e.follow_up) : 'Not scheduled'}
          </small>
        </button>
      ))}
      {!events.length && (
        <p className="overview-empty">Your open proposals will appear here.</p>
      )}
      <button className="overview-view-all record-link" onClick={onAll}>
        All proposals <ArrowUpRight size={15} />
      </button>
    </section>
  );
}
