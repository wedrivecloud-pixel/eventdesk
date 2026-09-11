'use client';
import { useEffect, useState } from 'react';
import { RevenueChart, revenueSeries } from './revenue-chart';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Settings2,
  ArrowUpRight,
  CalendarDays,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { money, prettyDate, type Data, type EventRecord } from '@/lib/crm';
import {
  activeEvent,
  balance,
  downloadCsv,
  localToday,
  salesRows,
  dateAdd,
} from '@/lib/sales';
import {
  bookedAt,
  businessDay,
  recentlyBooked,
  revenueGroups,
  revenueRanges,
  revenueSnapshot,
  type RevenueBasis,
  type RevenueFilter,
  type RevenueGroup,
} from '@/lib/overview';
import {
  defaultOverview as defaultDashboard,
  checkedOverview as checkedDashboard,
  overviewWidgets,
  defaultRevenue,
  revenueComparison,
  presentOverview,
  type OverviewLayout as DashboardLayout,
  type OverviewWidget as DashboardWidget,
  type RevenuePreferences,
} from '@/lib/overview-preferences';
import {
  overviewPriorities,
  pendingRequest,
  proposalExpiry,
} from '@/lib/overview-priorities';
import {
  DailySummary,
  Readiness,
  Attention,
  ProposalQueue,
} from './overview-focus';
import { packageSettings, imageUrl } from '@/lib/package-config';
import { SChoice, SField, STable, STabs, SToggle } from './sales-ui';
import type { AccountController } from './user-options';
import type { Editor } from './sales-ui';
import './overview.css';
import './overview-v2.css';

type Props = {
  data: Data;
  controller: AccountController;
  onNavigate: (view: string) => void;
  onOpen: (event: EventRecord, tab?: string) => void;
  onEdit: (event: EventRecord) => void;
  onCreate: (status: 'lead' | 'proposal' | 'confirmed') => void;
  onAppointment: (editor: Editor) => void;
};
function Menu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="secondary overview-menu">
        {label}
        <ChevronDown size={15} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="overview-empty">{children}</p>
);
function DateRail({ date }: { date: string }) {
  const day = new Date(date + 'T12:00:00Z');
  return (
    <span className="event-date-rail" aria-label={prettyDate(date)}>
      <span>
        {day.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
      </span>
      <strong>{date.slice(8)}</strong>
    </span>
  );
}
export function OverviewDashboard(p: Props) {
  const { data, controller } = p,
    today = localToday(data),
    zone = String(data.settings?.timezone || 'America/Los_Angeles');
  const layout = presentOverview(
    controller.account?.overview || defaultDashboard(),
  );
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<DashboardLayout>(layout),
    [editError, setEditError] = useState(''),
    [availability, setAvailability] = useState(false),
    [expanded, setExpanded] = useState<
      'upcoming' | 'recent' | 'requests' | 'outstanding' | 'next30' | null
    >(null),
    [shown, setShown] = useState(25),
    [horizon, setHorizon] = useState('Next 30 days');
  const confirmed = data.events.filter(
      (e) => e.status === 'confirmed' && activeEvent(e),
    ),
    upcoming = confirmed
      .filter((e) => e.date >= today)
      .slice()
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    recent = recentlyBooked(data),
    leads = data.events
      .filter((e) => e.status === 'lead' && activeEvent(e))
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    followups = data.events
      .filter(
        (e) =>
          e.status !== 'confirmed' &&
          activeEvent(e) &&
          e.follow_up &&
          e.follow_up <= today,
      )
      .slice()
      .sort((a, b) => a.follow_up.localeCompare(b.follow_up)),
    messages = salesRows(data, 'message')
      .filter((r) => r.data.state === 'Recorded incoming')
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    payments = (data.payments || [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const attention = overviewPriorities(data, today);
  const proposals = data.events
    .filter((e) => e.status === 'proposal' && activeEvent(e))
    .sort((a, b) =>
      (proposalExpiry(a) || '9999').localeCompare(proposalExpiry(b) || '9999'),
    );
  const comingSoon = upcoming.filter(
    (e) =>
      horizon === 'All upcoming' ||
      e.date <= dateAdd(today, horizon === 'Next 7 days' ? 6 : 29),
  );
  const expandedTitles = {
    upcoming: 'All Upcoming Bookings',
    recent: 'All Recently Booked',
    requests: 'Requests to Approve',
    outstanding: 'Outstanding Balances',
    next30: 'Events in the Next 30 Days',
  };
  const expandedRows =
    expanded === 'recent'
      ? recent
      : expanded === 'requests'
        ? data.events.filter(pendingRequest)
        : expanded === 'outstanding'
          ? data.events.filter(
              (e) =>
                e.status === 'confirmed' &&
                (activeEvent(e) || e.lifecycle === 'Postponed') &&
                balance(e, data) > 0,
            )
          : expanded === 'next30'
            ? upcoming.filter((e) => e.date <= dateAdd(today, 29))
            : upcoming;
  const counts: Record<string, number> = {
    upcoming: comingSoon.length,
    attention: attention.length,
    proposals: proposals.length,
    recent: recent.length,
    leads: leads.length,
    followups: followups.length,
    messages: messages.length,
    payments: payments.length,
    services: data.business?.services.length || 0,
  };
  const bookingCard = (e: EventRecord) => {
    const cover = data.packages.find((p) => p.id === e.items[0]?.id)
      ?.images?.[0];
    return (
      <article key={e.id} className="overview-booking">
        <div className="event-date-rail">
          <span>
            {new Date(e.date + 'T12:00:00Z').toLocaleDateString('en-US', {
              month: 'short',
              timeZone: 'UTC',
            })}
          </span>
          <strong>{e.date.slice(8)}</strong>
          <small>
            {new Date(e.date + 'T12:00:00Z').toLocaleDateString('en-US', {
              weekday: 'short',
              timeZone: 'UTC',
            })}
          </small>
        </div>
        <div className="overview-booking-date">
          <span>
            {prettyDate(e.date)}
            {e.time ? ' · ' + e.time : ''}
          </span>
          <span className="overview-status">
            {e.lifecycle === 'Postponed'
              ? 'Postponed'
              : e.status === 'confirmed'
                ? 'Confirmed'
                : pendingRequest(e)
                  ? 'Awaiting approval'
                  : e.status === 'proposal'
                    ? 'Proposal'
                    : 'Lead'}
          </span>
        </div>
        <button
          className="record-link overview-event-title"
          onClick={() => p.onOpen(e)}
        >
          {e.title}
        </button>
        <div className="overview-booking-details">
          <div>
            {cover && (
              <img
                className="overview-package-image"
                src={imageUrl(cover.id)}
                alt={cover.alt || ''}
                loading="lazy"
              />
            )}
            {e.items[0] && (
              <>
                <strong>{e.items.map((i) => i.name).join(', ')}</strong>
                <small>
                  {e.items
                    .map((i) => i.service)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .join(' · ')}
                </small>
              </>
            )}
          </div>
          <div>
            <strong>{e.client}</strong>
            <small>{e.email}</small>
            <small>{e.phone}</small>
          </div>
          <div>
            <strong>{e.venue || 'Venue to be confirmed'}</strong>
            <small>
              {(e.operations?.staffIds || [])
                .map((id) => data.resources?.find((r) => r.id === id)?.name)
                .filter(Boolean)
                .join(', ') || 'No staff assigned'}
            </small>
          </div>
        </div>
        {e.status === 'confirmed' && (
          <Readiness event={e} data={data} today={today} onOpen={p.onOpen} />
        )}
        <div className="overview-booking-footer">
          <div>
            <strong>
              {e.status === 'confirmed'
                ? money(balance(e, data)) + ' outstanding'
                : money(e.total) + ' quoted'}
            </strong>
            <small>
              {e.operations?.sales?.confirmedAt
                ? 'Booked'
                : e.status === 'confirmed'
                  ? 'Created (booking date unavailable)'
                  : 'Created'}{' '}
              {prettyDate(businessDay(bookedAt(e), zone))}
              {e.source ? ' · ' + e.source : ''}
            </small>
          </div>
          <Menu label="Manage">
            <DropdownMenuItem onClick={() => p.onOpen(e)}>
              Overview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.onOpen(e, 'payments')}>
              Payments & Balance
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.onOpen(e, 'team')}>
              Assign Staff
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.onEdit(e)}>
              Edit Booking / Notes
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                p.onAppointment({
                  kind: 'appointment',
                  data: {
                    eventId: e.id,
                    name: e.client,
                    email: e.email,
                    phone: e.phone,
                  },
                })
              }
            >
              Create Appointment
            </DropdownMenuItem>
          </Menu>
        </div>
      </article>
    );
  };
  function widget(w: DashboardWidget) {
    if (!w.enabled) return null;
    if (w.id === 'attention')
      return <Attention items={attention} limit={w.limit} onOpen={p.onOpen} />;
    if (w.id === 'proposals')
      return (
        <ProposalQueue
          events={proposals}
          limit={w.limit}
          today={today}
          onOpen={p.onOpen}
          onAll={() => p.onNavigate('Proposals')}
        />
      );
    const title = overviewWidgets[w.id],
      head = (action?: React.ReactNode) => (
        <div className="panel-heading">
          <h2>{title}</h2>
          {action}
        </div>
      );
    if (w.id === 'revenue')
      return (
        <RevenueSnapshot
          key={w.id}
          data={data}
          controller={controller}
          onOpen={p.onOpen}
        />
      );
    if (w.id === 'tools')
      return (
        <section key={w.id} className="panel overview-widget">
          <div className="overview-toolbar">
            <Menu label="Tools">
              <DropdownMenuItem onClick={() => setAvailability(true)}>
                Check Availability
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => p.onNavigate('Travel zones')}>
                Check Travel Fees
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => p.onNavigate('Tax zones')}>
                Check Tax Rates
              </DropdownMenuItem>
            </Menu>
          </div>
        </section>
      );
    if (w.id === 'upcoming' || w.id === 'recent') {
      const rows = w.id === 'upcoming' ? comingSoon : recent;
      return (
        <section key={w.id} className="panel overview-widget">
          {head(<span className="overview-count">{rows.length}</span>)}
          {w.id === 'upcoming' && (
            <STabs
              tabs={['Next 7 days', 'Next 30 days', 'All upcoming']}
              value={horizon}
              onChange={setHorizon}
            />
          )}
          {rows.length ? (
            w.id === 'upcoming' ? (
              rows.slice(0, w.limit).map((e) => (
                <button
                  key={e.id}
                  className="overview-upcoming-row"
                  onClick={() => p.onOpen(e)}
                >
                  <DateRail date={e.date} />
                  <span>
                    <strong>{e.client || e.title}</strong>
                    <span>
                      {e.items.map((item) => item.name).join(', ') || e.title}
                    </span>
                    <small>
                      {e.time || 'Time to be confirmed'}
                      {e.venue ? ' · ' + e.venue : ''}
                    </small>
                  </span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </button>
              ))
            ) : (
              rows.slice(0, w.limit).map(bookingCard)
            )
          ) : (
            <Empty>
              {w.id === 'upcoming'
                ? 'No confirmed bookings in this view. Choose All upcoming to see later dates.'
                : 'No confirmed bookings yet.'}
            </Empty>
          )}
          <button
            className="overview-view-all record-link"
            onClick={() => {
              setExpanded(w.id as 'upcoming' | 'recent');
              setShown(25);
            }}
          >
            All {title} →
          </button>
        </section>
      );
    }
    if (w.id === 'messages')
      return (
        <section key={w.id} className="panel overview-widget">
          {head()}
          {messages.length ? (
            messages.slice(0, w.limit).map((r) => (
              <button
                key={r.id}
                className="overview-compact-row"
                onClick={() => p.onNavigate('Messages')}
              >
                <strong>{r.data.subject || '(No subject)'}</strong>
                <span>
                  {r.data.recipient || 'Recorded message'} · {r.data.channel}
                </span>
                <small>{prettyDate(businessDay(r.created_at, zone))}</small>
              </button>
            ))
          ) : (
            <Empty>
              No received messages have been recorded. Email and text delivery
              are not connected.
            </Empty>
          )}
          <button
            className="overview-view-all record-link"
            onClick={() => p.onNavigate('Messages')}
          >
            All Messages →
          </button>
        </section>
      );
    if (w.id === 'leads' || w.id === 'followups') {
      const rows = w.id === 'leads' ? leads : followups;
      return (
        <section key={w.id} className="panel overview-widget">
          {head()}
          {rows.length ? (
            rows.slice(0, w.limit).map((e) => (
              <button
                key={e.id}
                className="overview-compact-row"
                onClick={() => p.onOpen(e)}
              >
                <strong>{e.client}</strong>
                <span>{e.title}</span>
                <small>
                  {e.email}
                  {e.phone ? ' · ' + e.phone : ''}
                </small>
                <small>
                  {w.id === 'leads'
                    ? `${e.source || 'No source recorded'} · ${prettyDate(businessDay(e.created_at, zone))}`
                    : 'Next contact: ' + prettyDate(e.follow_up)}
                </small>
              </button>
            ))
          ) : (
            <Empty>
              {w.id === 'leads' ? 'No recent leads.' : 'No follow-ups due.'}
            </Empty>
          )}
          <button
            className="overview-view-all record-link"
            onClick={() => p.onNavigate('Leads')}
          >
            All Leads →
          </button>
        </section>
      );
    }
    if (w.id === 'payments')
      return (
        <section key={w.id} className="panel overview-widget">
          {head()}
          {payments.length ? (
            payments.slice(0, w.limit).map((payment) => {
              const e = data.events.find((e) => e.id === payment.event_id);
              return (
                <button
                  className="overview-compact-row"
                  key={payment.id}
                  onClick={() =>
                    e ? p.onOpen(e, 'payments') : p.onNavigate('Payments')
                  }
                >
                  <strong>
                    {money(payment.amount)} · {payment.method}
                  </strong>
                  <span>{e?.title || 'Booking payment'}</span>
                  <small>
                    {prettyDate(payment.date)}
                    {payment.tip ? ' · ' + money(payment.tip) + ' tip' : ''}
                  </small>
                </button>
              );
            })
          ) : (
            <Empty>No payments have been recorded.</Empty>
          )}
          <button
            className="overview-view-all record-link"
            onClick={() => p.onNavigate('Payments')}
          >
            All Recent Payments →
          </button>
        </section>
      );
    if (w.id === 'services')
      return (
        <section key={w.id} className="panel overview-widget">
          {head()}
          <div className="overview-services">
            {data.business?.services.slice(0, w.limit).map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <button
            className="overview-view-all record-link"
            onClick={() => p.onNavigate('Business settings')}
          >
            Manage Services →
          </button>
        </section>
      );
    return (
      <DailySummary
        data={data}
        today={today}
        onSelect={(key) => {
          if (key === 'collected') p.onNavigate('Payments');
          else {
            setExpanded(key as 'requests' | 'outstanding' | 'next30');
            setShown(25);
          }
        }}
      />
    );
  }
  const toolsWidget = layout.widgets.find((w) => w.id === 'tools');
  return (
    <div className="overview-dashboard">
      <div className="overview-heading">
        <div>
          <p className="overview-day">
            {new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <h1 tabIndex={-1} data-workspace-heading>
            Overview
          </h1>
        </div>
        <div className="overview-heading-actions">
          {toolsWidget?.enabled && widget(toolsWidget)}
          <button
            className="secondary"
            disabled={!controller.account}
            onClick={() => {
              setDraft(structuredClone(layout));
              setEditError('');
              setEditing(true);
            }}
          >
            <Settings2 size={16} /> Customize
          </button>
        </div>
      </div>
      {controller.error && (
        <p role="alert" className="error">
          {controller.error}
          <button
            className="record-link"
            onClick={() => void controller.reload()}
          >
            Reload account
          </button>
        </p>
      )}
      {controller.notice && (
        <p role="status" className="sales-notice">
          {controller.notice}
        </p>
      )}
      <div className="overview-widget-grid">
        {layout.widgets
          .filter((w) => w.id !== 'tools' && w.enabled)
          .map((w) => (
            <div
              key={w.id}
              className={'overview-grid-item overview-width-' + w.column}
              data-widget={w.id}
            >
              {w.hideEmpty && counts[w.id] === 0 ? (
                <details className="overview-collapsed">
                  <summary>
                    {overviewWidgets[w.id]}
                    <span>
                      {w.id === 'upcoming'
                        ? 'None in this date range'
                        : 'No items'}{' '}
                      <ChevronDown size={15} />
                    </span>
                  </summary>
                  {widget(w)}
                </details>
              ) : (
                widget(w)
              )}
            </div>
          ))}
      </div>
      {!layout.widgets.some((w) => w.enabled) && (
        <Empty>
          Your dashboard is empty. Choose widgets in Customize Dashboard.
        </Empty>
      )}
      <Dialog
        open={editing}
        onOpenChange={(open) => {
          if (!controller.busy) setEditing(open);
        }}
      >
        <DialogContent className="crm-dialog dashboard-editor">
          <DialogHeader>
            <DialogTitle>Customize Dashboard</DialogTitle>
            <DialogDescription>
              Choose widgets, their order and display settings. Saved for your
              account.
            </DialogDescription>
          </DialogHeader>
          <div className="dashboard-widget-editor">
            {draft.widgets.map((w, index) =>
              w.id === 'tools' ? (
                <section className="dashboard-widget-setting" key={w.id}>
                  <SToggle
                    label={overviewWidgets[w.id]}
                    value={w.enabled}
                    onChange={(enabled) =>
                      setDraft((d) => ({
                        widgets: d.widgets.map((x) =>
                          x.id === w.id ? { ...x, enabled } : x,
                        ),
                      }))
                    }
                  />
                  <p className="muted">
                    Quick actions stay at the top of your Overview.
                  </p>
                </section>
              ) : (
                <section className="dashboard-widget-setting" key={w.id}>
                  <div>
                    <SToggle
                      label={overviewWidgets[w.id]}
                      value={w.enabled}
                      onChange={(enabled) =>
                        setDraft((d) => ({
                          widgets: d.widgets.map((x) =>
                            x.id === w.id ? { ...x, enabled } : x,
                          ),
                        }))
                      }
                    />
                    <div className="sales-actions">
                      <button
                        type="button"
                        className="secondary"
                        aria-label={'Move ' + overviewWidgets[w.id] + ' up'}
                        disabled={!index}
                        onClick={() =>
                          setDraft((d) => {
                            const a = [...d.widgets];
                            [a[index - 1], a[index]] = [a[index], a[index - 1]];
                            return { widgets: a };
                          })
                        }
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        aria-label={'Move ' + overviewWidgets[w.id] + ' down'}
                        disabled={
                          index === draft.widgets.length - 1 ||
                          draft.widgets[index + 1]?.id === 'tools'
                        }
                        onClick={() =>
                          setDraft((d) => {
                            const a = [...d.widgets];
                            [a[index + 1], a[index]] = [a[index], a[index + 1]];
                            return { widgets: a };
                          })
                        }
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="dashboard-widget-fields">
                    <SChoice
                      label={'Width · ' + overviewWidgets[w.id]}
                      value={w.column}
                      options={[
                        { value: 'full', label: 'Full width' },
                        { value: 'main', label: 'Larger column' },
                        { value: 'side', label: 'Smaller column' },
                      ]}
                      onChange={(column) =>
                        setDraft((d) => ({
                          widgets: d.widgets.map((x) =>
                            x.id === w.id
                              ? {
                                  ...x,
                                  column: column as DashboardWidget['column'],
                                }
                              : x,
                          ),
                        }))
                      }
                    />
                    {Object.hasOwn(counts, w.id) && (
                      <>
                        <SField
                          label={'Max results · ' + overviewWidgets[w.id]}
                          value={w.limit}
                          type="number"
                          onChange={(limit) =>
                            setDraft((d) => ({
                              widgets: d.widgets.map((x) =>
                                x.id === w.id
                                  ? { ...x, limit: Number(limit) }
                                  : x,
                              ),
                            }))
                          }
                        />
                        <SToggle
                          label={
                            'Collapse ' + overviewWidgets[w.id] + ' when empty'
                          }
                          value={w.hideEmpty}
                          onChange={(hideEmpty) =>
                            setDraft((d) => ({
                              widgets: d.widgets.map((x) =>
                                x.id === w.id ? { ...x, hideEmpty } : x,
                              ),
                            }))
                          }
                        />
                      </>
                    )}
                  </div>
                </section>
              ),
            )}
          </div>
          {(editError || controller.error) && (
            <p className="error" role="alert">
              {editError || controller.error}
            </p>
          )}
          <div className="sales-actions">
            <button
              className="secondary"
              disabled={controller.busy}
              onClick={() => setDraft(defaultDashboard())}
            >
              Restore Default Layout
            </button>
            <button
              className="secondary"
              disabled={controller.busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button
              className="primary"
              disabled={controller.busy}
              onClick={async () => {
                try {
                  setEditError('');
                  const dashboard = checkedDashboard(draft);
                  if (
                    await controller.run({
                      action: 'save_overview',
                      overview: dashboard,
                    })
                  )
                    setEditing(false);
                } catch (e) {
                  setEditError(
                    e instanceof Error ? e.message : 'Unable to save.',
                  );
                }
              }}
            >
              {controller.busy ? 'Saving…' : 'Save Dashboard'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!expanded}
        onOpenChange={(open) => {
          if (!open) setExpanded(null);
        }}
      >
        <DialogContent className="crm-dialog dashboard-bookings-dialog">
          <DialogHeader>
            <DialogTitle>
              {expanded ? expandedTitles[expanded] : 'Bookings'}
            </DialogTitle>
            <DialogDescription>
              {expanded === 'recent'
                ? 'Newest booking confirmations first; older records without a booked date use their creation date.'
                : expanded === 'requests'
                  ? 'Review each request before confirming. Dates are not reserved yet.'
                  : expanded === 'outstanding'
                    ? 'Confirmed and postponed bookings with an unpaid balance.'
                    : 'Confirmed bookings ordered by scheduled date.'}
            </DialogDescription>
          </DialogHeader>
          {expandedRows.slice(0, shown).map(bookingCard)}
          {expandedRows.length > shown && (
            <button
              className="secondary"
              onClick={() => setShown((n) => n + 25)}
            >
              Show More
            </button>
          )}
          {!expandedRows.length && <Empty>No bookings match this view.</Empty>}
        </DialogContent>
      </Dialog>
      <Dialog open={availability} onOpenChange={setAvailability}>
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>Check Availability</DialogTitle>
            <DialogDescription>
              Check package booking rules and capacity without creating a
              booking.
            </DialogDescription>
          </DialogHeader>
          {availability && (
            <AvailabilityCheck data={data} onNavigate={p.onNavigate} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RevenueSnapshot({
  data,
  controller,
  onOpen,
}: {
  data: Data;
  controller?: AccountController;
  onOpen?: (event: EventRecord, tab?: string) => void;
}) {
  const today = localToday(data);
  const [filter, updateFilter] = useState<RevenuePreferences>(
    () => controller?.account?.overviewRevenue || defaultRevenue(today),
  );
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && controller?.account?.overviewRevenue)
      updateFilter(controller.account.overviewRevenue);
  }, [controller?.account?.overviewRevenue, touched]);
  const setFilter = (change: (f: RevenuePreferences) => RevenuePreferences) => {
    setTouched(true);
    updateFilter(change);
  };
  let report: ReturnType<typeof revenueSnapshot> | undefined,
    previous: ReturnType<typeof revenueSnapshot> | undefined,
    error = '';
  try {
    report = revenueSnapshot(data, filter, today);
    if (filter.compare) previous = revenueComparison(data, filter, today);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unable to calculate snapshot.';
  }
  const series = revenueSeries(filter.basis);
  const title =
    filter.basis === 'Payment'
      ? 'Collected Revenue by Payment Date'
      : filter.basis === 'Booked'
        ? 'Projected Revenue by Date Booked'
        : 'Projected Revenue by Scheduled Date';
  return (
    <section className="panel overview-revenue">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">THE BIGGER PICTURE</span>
          <h2>Revenue Snapshot</h2>
        </div>
        <button
          className="secondary"
          disabled={!report}
          onClick={() =>
            report &&
            downloadCsv('revenue-snapshot', [
              [
                'Period',
                'Amount Paid USD',
                'Projected Revenue USD',
                'Postponed USD',
                'Past Due USD',
                'Total USD',
                'Booking Count',
              ],
              ...report.rows.map((r) => [
                r.label,
                r.paid / 100,
                r.projected / 100,
                r.postponed / 100,
                r.pastDue / 100,
                r.total / 100,
                r.count,
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </div>
      <div className="overview-revenue-controls">
        <STabs
          tabs={['Scheduled', 'Payment', 'Booked']}
          value={filter.basis}
          onChange={(basis) =>
            setFilter((f) => ({ ...f, basis: basis as RevenueBasis }))
          }
        />
        <SChoice
          label="Date Range"
          value={filter.range}
          options={revenueRanges}
          onChange={(range) => setFilter((f) => ({ ...f, range }))}
        />
        <SChoice
          label="Group By"
          value={filter.group}
          options={[...revenueGroups]}
          onChange={(group) =>
            setFilter((f) => ({ ...f, group: group as RevenueGroup }))
          }
        />
        {filter.range === 'Custom' && (
          <>
            <SField
              label="From"
              value={filter.from}
              type="date"
              onChange={(from) => setFilter((f) => ({ ...f, from }))}
            />
            <SField
              label="To"
              value={filter.to}
              type="date"
              onChange={(to) => setFilter((f) => ({ ...f, to }))}
            />
          </>
        )}
      </div>
      <div className="revenue-preferences">
        <SToggle
          label="Compare with previous period"
          value={filter.compare}
          onChange={(compare) => setFilter((f) => ({ ...f, compare }))}
        />
        <button
          className="record-link"
          disabled={!controller?.account || controller.busy || !!error}
          onClick={() =>
            controller?.run({
              action: 'save_overview_revenue',
              preferences: filter,
            })
          }
        >
          Save as my default
        </button>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : (
        report && (
          <>
            <div className="revenue-headline">
              <strong>{money(report.total.total)}</strong>
              <span>
                {filter.basis === 'Payment'
                  ? 'Collected in this period'
                  : 'Booking value in this period'}
              </span>
              {previous && (
                <div className="revenue-comparison">
                  <span>
                    {report.total.total === previous.total.total
                      ? 'No change'
                      : (report.total.total > previous.total.total
                          ? '+'
                          : '−') +
                        money(
                          Math.abs(report.total.total - previous.total.total),
                        )}
                    {previous.total.total > 0
                      ? ' (' +
                        Math.abs(
                          ((report.total.total - previous.total.total) /
                            previous.total.total) *
                            100,
                        ).toFixed(1) +
                        '%)'
                      : ''}
                  </span>
                  <small>
                    vs {money(previous.total.total)} ·{' '}
                    {prettyDate(previous.period.from)} –{' '}
                    {prettyDate(previous.period.to)}
                  </small>
                </div>
              )}
            </div>
            <h3 className="overview-chart-title">{title}</h3>
            <p className="overview-chart-period">
              {prettyDate(report.period.from)} – {prettyDate(report.period.to)}
            </p>
            <RevenueChart
              key={[
                filter.basis,
                filter.range,
                filter.group,
                filter.from,
                filter.to,
              ].join(':')}
              rows={report.rows}
              basis={filter.basis}
              title={title}
              onOpen={onOpen}
            />
            <div className="overview-revenue-totals">
              {[
                ['Total Revenue', money(report.total.total)],
                ['Amount Paid', money(report.total.paid)],
                ...(filter.basis === 'Payment'
                  ? []
                  : [
                      ['Projected Revenue', money(report.total.projected)],
                      ['Past Due', money(report.total.pastDue)],
                      ['Postponed', money(report.total.postponed)],
                    ]),
                ['Average per Booking', money(report.average)],
                ['Booking Count', String(report.total.count)],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="overview-calculation-note">
              {filter.basis === 'Payment'
                ? 'Recorded payments dated within this range, excluding tips.'
                : 'Confirmed booking totals split into recorded payments and outstanding balances. Past due uses payment-plan installments or the final due date; postponed balances are separate.'}{' '}
              {report.fallbackCount
                ? `${report.fallbackCount} older booking(s) use their creation date because no confirmation date was recorded.`
                : ''}
            </p>
            <details className="overview-data-table">
              <summary>View Revenue Data</summary>
              <STable
                headers={[
                  'Period',
                  ...series.map((s) => s.label),
                  'Bookings',
                  'Total',
                ]}
                rows={report.rows.map((r) => [
                  r.label,
                  ...series.map((s) =>
                    money(
                      r[
                        s.key as 'paid' | 'projected' | 'postponed' | 'pastDue'
                      ],
                    ),
                  ),
                  String(r.count),
                  money(r.total),
                ])}
              />
            </details>
          </>
        )
      )}
    </section>
  );
}
function AvailabilityCheck({
  data,
  onNavigate,
}: {
  data: Data;
  onNavigate: (view: string) => void;
}) {
  const choices = data.packages.filter((p) =>
      ['Public', 'Private'].includes(
        packageSettings(p.settings, p.duration).status,
      ),
    ),
    [id, setId] = useState(choices[0]?.id || ''),
    [day, setDay] = useState(localToday(data)),
    [minutes, setMinutes] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{
      available: boolean;
      times: string[];
      slots: { time: string; label: string; minutes: number }[];
    } | null>(null),
    [error, setError] = useState('');
  const selected = choices.find((p) => p.id === id),
    settings = selected
      ? packageSettings(selected.settings, selected.duration)
      : null;
  const included = settings?.includedMinutes || 240,
    days =
      settings?.dateMode === 'Date Only' && settings?.durationUnit === 'Days';
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        setResult(null);
        try {
          const duration = minutes
            ? Number(minutes) * (days ? 1440 : 60)
            : days
              ? (settings?.includedDays || 1) * 1440
              : included;
          if (!Number.isFinite(duration) || duration <= 0)
            throw Error('Choose a valid duration.');
          const r = await fetch(
              '/api/booking?' +
                new URLSearchParams({
                  package: id,
                  date: day,
                  minutes: String(duration),
                }),
              { cache: 'no-store' },
            ),
            j = (await r.json()) as {
              error?: string;
              available: boolean;
              times: string[];
              slots: { time: string; label: string; minutes: number }[];
            };
          if (!r.ok) throw Error(j.error || 'Unable to check availability.');
          setResult(j);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Unable to check.');
        } finally {
          setBusy(false);
        }
      }}
    >
      {!choices.length ? (
        <Empty>Add an active package to check availability.</Empty>
      ) : (
        <fieldset disabled={busy} className="overview-availability-fields">
          <SChoice
            label="Package"
            value={id}
            options={choices.map((p) => ({
              value: p.id,
              label: p.name + ' · ' + p.service,
            }))}
            onChange={(v) => {
              setId(v);
              setMinutes('');
              setResult(null);
              setError('');
            }}
          />
          <SField
            label="Event Date"
            type="date"
            required
            value={day}
            onChange={(v) => {
              setDay(v);
              setResult(null);
            }}
          />
          {settings && settings.picker !== 'Predefined slots' && (
            <SField
              label={days ? 'Duration in Days' : 'Duration in Hours'}
              type="number"
              value={
                minutes ||
                String(days ? settings.includedDays || 1 : included / 60)
              }
              onChange={(v) => {
                setMinutes(v);
                setResult(null);
              }}
            />
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Checking…' : 'Check Availability'}
          </button>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && (
        <div className="overview-availability-result" role="status">
          <strong>
            {result.available
              ? settings?.dateMode === 'Date Only'
                ? 'This date is available.'
                : 'Available start times'
              : 'No start times are available for this date and duration.'}
          </strong>
          {result.slots.length > 0 && (
            <div className="overview-time-slots">
              {result.slots.map((s) => (
                <span key={s.time}>{s.label}</span>
              ))}
            </div>
          )}
          <p>
            No booking has been created or reserved. Staff and additional item
            selections are reviewed separately.
          </p>
        </div>
      )}
      <div className="sales-actions">
        <button
          type="button"
          className="record-link"
          onClick={() => onNavigate('Calendar')}
        >
          Business Calendar
        </button>
        <button
          type="button"
          className="record-link"
          onClick={() => onNavigate('Staffing')}
        >
          Staff Availability
        </button>
      </div>
    </form>
  );
}
