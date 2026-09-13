import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Home,
  LayoutGrid,
  ListTodo,
  MessageSquare,
  Package,
  Search,
  Users,
} from 'lucide-react';

// All values below are fictional interface samples, never customer proof or live data.
const events = [
  {
    date: '17',
    name: 'Garden wedding',
    service: 'Photo booth · 4 hours',
    status: 'Confirmed',
    value: '$1,200',
  },
  {
    date: '22',
    name: 'Company celebration',
    service: 'DJ & entertainment',
    status: 'Proposal',
    value: '$1,850',
  },
  {
    date: '24',
    name: 'Autumn open house',
    service: 'Event rentals',
    status: 'New lead',
    value: '$950',
  },
];

export function DashboardPreview() {
  return (
    <figure
      className="mk-dashboard"
      aria-label="Illustrative EventDeskly overview: leads, proposals, bookings, outstanding balances and upcoming events. All data is fictional."
    >
      <aside className="mk-preview-sidebar" aria-hidden="true">
        <div className="mk-preview-brand">
          e<span>deskly</span>
        </div>
        <span className="mk-mini-label">WORKSPACE</span>
        {[
          [Home, 'Overview'],
          [CalendarDays, 'Calendar'],
          [ListTodo, 'Tasks'],
          [MessageSquare, 'Messages'],
          [Users, 'Leads'],
          [FileText, 'Proposals'],
          [Package, 'Bookings'],
        ].map(([Icon, label], i) => {
          const Glyph = Icon as typeof Home;
          return (
            <div className={i === 0 ? 'selected' : ''} key={String(label)}>
              <Glyph size={15} />
              <span>{String(label)}</span>
            </div>
          );
        })}
        <div className="mk-sidebar-foot">
          <LayoutGrid size={15} />
          Setup tools
        </div>
      </aside>
      <div className="mk-preview-main">
        <div className="mk-preview-toolbar">
          <span>
            Workspace <ChevronRight size={12} /> Overview
          </span>
          <Search size={16} />
        </div>
        <div className="mk-preview-content">
          <div className="mk-preview-title">
            <div>
              <p>YOUR BUSINESS, AT A GLANCE</p>
              <p className="mk-dashboard-title">Every event starts here.</p>
            </div>
            <span className="mk-preview-avatar">ED</span>
          </div>
          <div className="mk-stat-grid">
            {[
              ['New leads', '8'],
              ['Proposals', '4'],
              ['Bookings', '12'],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>Sample workspace</small>
              </div>
            ))}
          </div>
          <div className="mk-preview-section-title">
            <strong>Upcoming events</strong>
            <span>October</span>
          </div>
          <div className="mk-event-rows">
            {events.map((event) => (
              <div className="mk-event-row" key={event.name}>
                <div className="mk-date">
                  <small>OCT</small>
                  <b>{event.date}</b>
                </div>
                <div>
                  <strong>{event.name}</strong>
                  <span>{event.service}</span>
                </div>
                <span
                  className={
                    'mk-status ' +
                    (event.status === 'Confirmed' ? 'is-booked' : '')
                  }
                >
                  {event.status}
                </span>
              </div>
            ))}
          </div>
          <div className="mk-preview-summary">
            <CircleDollarSign size={20} />
            <div>
              <strong>Outstanding balances</strong>
              <span>Keep track of what’s left to collect.</span>
            </div>
            <b>$2,400</b>
          </div>
        </div>
        <div className="mk-sample-note">
          Illustrative product preview · sample data
        </div>
      </div>
    </figure>
  );
}

export function PipelinePreview() {
  return (
    <div className="mk-ui-panel">
      <div className="mk-ui-heading">
        <span>
          <Users size={18} /> Sales workspace
        </span>
        <span className="mk-sample-pill">Sample data</span>
      </div>
      <div className="mk-pipeline">
        {['New lead', 'Proposal', 'Confirmed'].map((stage, i) => (
          <div className="mk-pipeline-column" key={stage}>
            <h3>
              <span className={'mk-stage-dot stage-' + i} />
              {stage}
            </h3>
            <div className="mk-lead-card">
              <span className="mk-lead-type">
                {events[i].service.split(' · ')[0]}
              </span>
              <h4>{events[i].name}</h4>
              <p>October {events[i].date}</p>
              <div>
                <span>Event value</span>
                <strong>{events[i].value}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mk-ui-caption">
        One view of your inquiries, proposals and confirmed bookings.
      </p>
    </div>
  );
}

export function ProposalPreview() {
  return (
    <div className="mk-ui-panel mk-proposal-preview">
      <div className="mk-ui-heading">
        <span>
          <FileText size={18} /> Proposal preview
        </span>
        <span className="mk-sample-pill">Sample data</span>
      </div>
      <div className="mk-proposal-paper">
        <div className="mk-paper-heading">
          <div>
            <p>PREPARED FOR YOUR EVENT</p>
            <h3>Garden wedding</h3>
            <span>October 17 · Photo booth experience</span>
          </div>
          <span className="mk-document-mark">
            <FileText size={26} />
          </span>
        </div>
        <div className="mk-line-item">
          <div>
            <strong>Signature photo booth</strong>
            <span>4 hours · 1 package</span>
          </div>
          <b>$1,000</b>
        </div>
        <div className="mk-line-item">
          <div>
            <strong>Backdrop upgrade</strong>
            <span>Selected add-on</span>
          </div>
          <b>$200</b>
        </div>
        <div className="mk-proposal-total">
          <span>Proposal total</span>
          <strong>$1,200</strong>
        </div>
        <div className="mk-terms">
          <Check size={16} />
          <span>Booking terms included</span>
        </div>
      </div>
      <p className="mk-ui-caption">
        Packages, extras and terms, presented together. Acceptance and payment
        arranged separately.
      </p>
    </div>
  );
}

export function PlanningPreview() {
  return (
    <div className="mk-ui-panel">
      <div className="mk-ui-heading">
        <span>
          <CalendarDays size={18} /> Event planning
        </span>
        <span className="mk-sample-pill">Sample data</span>
      </div>
      <div className="mk-planning-content">
        <div className="mk-planning-event">
          <div className="mk-date">
            <small>OCT</small>
            <b>17</b>
          </div>
          <div>
            <h3>Garden wedding</h3>
            <p>4:00 PM – 8:00 PM · Confirmed</p>
          </div>
        </div>
        <div className="mk-planning-grid">
          <div>
            <h4>Event checklist</h4>
            {[
              'Confirm venue details',
              'Review client questionnaire',
              'Prepare equipment',
            ].map((task, i) => (
              <div className="mk-task" key={task}>
                <span className={i < 2 ? 'complete' : ''}>
                  {i < 2 && <Check size={13} />}
                </span>
                {task}
              </div>
            ))}
          </div>
          <div className="mk-planning-note">
            <MessageSquare size={20} />
            <h4>Client questionnaire</h4>
            <p>
              Setup location, event timing and the details that make it theirs.
            </p>
            <span>Responses organized</span>
          </div>
        </div>
      </div>
      <p className="mk-ui-caption">
        Keep the plan with the booking, from the first answer to the last
        checklist item.
      </p>
    </div>
  );
}
