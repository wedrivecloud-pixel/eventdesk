'use client';
import dynamic from 'next/dynamic';
const WebsiteIntegration = dynamic(() => import('./website-integration').then(m => m.WebsiteIntegration));
import { OverviewDashboard } from './overview-dashboard';
import { CreateMenu } from './create-menu';
import { GlobalSearch } from './global-search';
import {
  WorkspaceNavigation,
  WorkspaceContextNavigation,
} from './workspace-navigation';
import {
  canonicalView,
  viewFromSearch,
  workspaceHref,
  viewTitle,
  workspaceViews,
} from '@/lib/workspace-navigation';
import type { Editor } from './sales-ui';
import { UserMenu, UserWorkspace, useUserAccount } from './user-options';
import { userMenuGroups } from '@/lib/user-account';
const PackageEditor = dynamic(() => import('./package-editor').then(m => m.PackageEditor));
const PackageManager = dynamic(() => import('./package-manager').then(m => m.PackageManager));
import { useState, useEffect, useCallback, useRef } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  CalendarDays,
  Package,
  FileText,
  ArrowUpRight,
  Plus,
  Sparkles,
  ChevronRight,
  Search,
  ArrowRight,
  MapPin,
  Clock,
  Mail,
  Phone,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import {
  services,
  money,
  prettyDate,
  type Data,
  type EventRecord,
  type PackageRecord,
} from '@/lib/crm';
import type { Save } from './forms';
const BusinessForm = dynamic(() => import('./forms').then(m => m.BusinessForm));
const EventForm = dynamic(() => import('./forms').then(m => m.EventForm));
const SettingsCenter = dynamic(() => import('./management').then(m => m.SettingsCenter));
const ResourceManager = dynamic(() => import('./management').then(m => m.ResourceManager));
const ManagementHome = dynamic(() => import('./management').then(m => m.ManagementHome));
const SalesWorkspace = dynamic(() => import('./sales-workspace').then(m => m.SalesWorkspace));
const ManagedResources = dynamic(() => import('./manage-resources').then(m => m.ManagedResources));
const StaffAccounts = dynamic(() => import('./staff-accounts').then(m => m.StaffAccounts));
const DesignCollections = dynamic(() => import('./design-collections').then(m => m.DesignCollections));
const MessageWorkspace = dynamic(() => import('./message-workspace').then(m => m.MessageWorkspace));
const ManageHome = dynamic(() => import('./manage-hubs').then(m => m.ManageHome));
const BookingEngine = dynamic(() => import('./manage-hubs').then(m => m.BookingEngine));
const PaymentSettings = dynamic(() => import('./manage-hubs').then(m => m.PaymentSettings));
const BusinessSettings = dynamic(() => import('./manage-hubs').then(m => m.BusinessSettings));
const ReferFriends = dynamic(() => import('./manage-hubs').then(m => m.ReferFriends));
import { manageGroups } from '@/lib/manage-config';
import { salesGroups, activeEvent } from '@/lib/sales';
const EventPlanning = dynamic(() => import('./event-tools').then(m => m.EventPlanning));
const QuoteBreakdown = dynamic(() => import('./event-tools').then(m => m.QuoteBreakdown));
const ProposalWorkspace = dynamic(() => import('./proposal-workspace').then(m => m.ProposalWorkspace));
import { modules, mergedSettings } from '@/lib/settings';
import './workspace-redesign.css';
const subtitles: Record<string, string> = {
  Overview: 'A clear view of your leads, events, and what comes next.',
  Leads: 'Keep every inquiry moving toward a great event.',
  Proposals: 'Your packages, brought together in one clear offer.',
  Bookings: 'The events you’re bringing to life.',
  Packages:
    'Organize services, groups and packages. Update your catalog in one place.',
  'Business settings': 'Your business details and the services you offer.',
};
function Nothing({
  title,
  description,
  icon = 'event',
}: {
  title: string;
  description: string;
  icon?: string;
}) {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <EmptyMedia>
          {icon === 'package' ? (
            <Package size={30} />
          ) : (
            <CalendarDays size={30} />
          )}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span className={`status ${status}`}>
      {status === 'confirmed'
        ? 'Confirmed'
        : status === 'proposal'
          ? 'Draft proposal'
          : status === 'lead'
            ? 'New lead'
            : status}
    </span>
  );
}
function EventTable({
  rows,
  onOpen,
}: {
  rows: EventRecord[];
  onOpen: (e: EventRecord) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event / client</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Services</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead>
            <span className="sr-only">Open event</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((e) => (
          <TableRow key={e.id}>
            <TableCell>
              <button className="record-link" onClick={() => onOpen(e)}>
                {e.title}
              </button>
              <small className="cell-sub">{e.client}</small>
            </TableCell>
            <TableCell>
              {prettyDate(e.date)}
              <small className="cell-sub">
                {e.time || 'Time to be decided'}
              </small>
            </TableCell>
            <TableCell>
              <span className="service-text">
                {[...new Set(e.items.map((x) => x.service))].join(', ') ||
                  'Not selected'}
              </span>
            </TableCell>
            <TableCell>
              <Status status={e.status} />
            </TableCell>
            <TableCell className="text-right font-semibold">
              {money(e.total)}
            </TableCell>
            <TableCell>
              <button
                aria-label={`Open ${e.title}`}
                onClick={() => onOpen(e)}
                className="icon-button"
              >
                <ArrowUpRight size={18} />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
export default function Workspace() {
  const [view, setView] = useState('Overview'),
    [data, setData] = useState<Data>({
      business: null,
      packages: [],
      events: [],
    }),
    [loading, setLoading] = useState(true),
    [signedOut, setSignedOut] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [search, setSearch] = useState('');
  const [eventDefaults, setEventDefaults] = useState<Partial<EventRecord>>({});
  const [searchResource, setSearchResource] = useState<{
    id: string;
    request: number;
  }>();
  const [salesInitialEditor, setSalesInitialEditor] = useState<Editor | null>(
    null,
  );
  const [salesEditorRequest, setSalesEditorRequest] = useState(0);
  const [eventTab, setEventTab] = useState('planning');
  const accountController = useUserAccount(data.business?.id);
  const [modal, setModal] = useState<
      '' | 'business' | 'package' | 'event' | 'detail'
    >(''),
    [editingPackage, setEditingPackage] = useState<PackageRecord>(),
    [packageDefaults, setPackageDefaults] = useState<{
      service?: string;
      group?: string;
    }>({}),
    [selected, setSelected] = useState<EventRecord>();
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/crm', { cache: 'no-store' });
      const value = (await res.json()) as Data & { error?: string };
      if (res.status === 401) {
        setSignedOut(true);
        return;
      }
      if (!res.ok) throw new Error(value.error);
      setSignedOut(false);
      setData(value);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to load your workspace.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const save: Save = async (body) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const value = (await res.json()) as Data & { error?: string };
      if (!res.ok) throw new Error(value.error);
      setData(value);
      if (body.action === 'save_package')
        setEditingPackage(
          value.packages.find((p) =>
            body.id ? p.id === body.id : p.name === body.name,
          ),
        );
      else {
        setModal('');
        setSelected(undefined);
      }
      setNotice(
        body.action === 'advance_event'
          ? body.status === 'confirmed'
            ? 'Booking confirmed.'
            : 'Draft proposal created.'
          : body.action === 'save_event' &&
              !body.id &&
              body.initialStatus === 'confirmed'
            ? 'Booking created and confirmed.'
            : 'Saved to your workspace.',
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const manageSave: Save = async (body) => {
    setBusy(true);
    setError('');
    try {
      if (body.action === 'save_business') {
        await save(body);
        return true;
      }
      const res = await fetch('/api/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await res.json()) as Data & { error?: string };
      if (!res.ok) throw new Error(result.error);
      setData(result);
      if (selected)
        setSelected(result.events.find((e) => e.id === selected.id));
      setNotice('Saved to your workspace.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const navigate = useCallback((next: string) => {
    const destination = canonicalView(next);
    if (viewFromSearch(window.location.search) !== destination)
      window.history.pushState(null, '', workspaceHref(destination));
    setView(destination);
    setSearch('');
    setNotice('');
    setSalesInitialEditor(null);
    setSearchResource(undefined);
  }, []);
  const previousView = useRef(view);
  useEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    const frame = requestAnimationFrame(() => {
      if (!document.querySelector('[role="dialog"]'))
        document
          .querySelector<HTMLElement>('[data-workspace-heading]')
          ?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);
  useEffect(() => {
    const restore = () => {
      setView(viewFromSearch(window.location.search));
      setSearch('');
      setNotice('');
      setModal('');
      setSalesInitialEditor(null);
      setSearchResource(undefined);
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'navigate_workspace',
            description:
              'Open an EventDesk workspace section without modifying saved records.',
            inputSchema: {
              type: 'object',
              properties: {
                section: {
                  type: 'string',
                  enum: [
                    ...new Set([
                      ...workspaceViews,
                      'Package Manager',
                      ...userMenuGroups.flat(),
                      ...manageGroups.flat(),
                      ...Object.values(modules).map((m) => m.label),
                    ]),
                  ],
                },
              },
              required: ['section'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute: async (input: unknown) => {
              const section = (input as { section?: unknown })?.section;
              if (
                typeof section !== 'string' ||
                (section !== 'Package Manager' &&
                  !workspaceViews.includes(section) &&
                  !manageGroups.flat().includes(section) &&
                  !userMenuGroups.flat().includes(section) &&
                  !Object.values(modules).some((m) => m.label === section))
              )
                throw new Error('Choose a valid workspace section.');
              navigate(section);
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
              return { section };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [navigate]);
  function create(
    kind: 'event' | 'package' | 'business',
    defaults: { service?: string; group?: string } = {},
  ) {
    setPackageDefaults(defaults);
    setEventDefaults(
      view === 'Proposals'
        ? { status: 'proposal' }
        : ['Bookings', 'All Bookings', 'My Bookings'].includes(view)
          ? { status: 'confirmed' }
          : {},
    );
    setError('');
    setSelected(undefined);
    setEditingPackage(undefined);
    setModal(data.business ? kind : 'business');
  }
  function createEvent(status: 'lead' | 'proposal' | 'confirmed') {
    navigate(
      status === 'lead'
        ? 'Leads'
        : status === 'proposal'
          ? 'Proposals'
          : 'Bookings',
    );
    create('event');
    setEventDefaults({ status });
  }
  function createAppointment(editor: Editor = { kind: 'appointment' }) {
    navigate('Appointments');
    setSalesInitialEditor(editor);
    // A new request also opens the editor when already on Appointments.
    setSalesEditorRequest((request) => request + 1);
  }
  const resourceKind = Object.keys(modules).find(
    (key) => modules[key].label === view && view !== 'Expenses',
  );
  const business = data.business,
    events = data.events,
    packages = data.packages;
  const pipeline = events.filter(
    (e) => e.status !== 'confirmed' && activeEvent(e),
  );
  const filterStatus =
    view === 'Leads' ? 'lead' : view === 'Proposals' ? 'proposal' : 'confirmed';
  const rows = events.filter(
    (e) =>
      e.status === filterStatus &&
      `${e.title} ${e.client} ${e.venue} ${e.email}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const open = (e: EventRecord, tab = 'planning') => {
    setEventTab(tab);
    setSelected(e);
    setError('');
    setModal('detail');
  };
  const modalTitle =
    modal === 'business'
      ? business
        ? 'Business settings'
        : 'Create your business workspace'
      : modal === 'package'
        ? editingPackage
          ? 'Edit package'
          : 'Create a package'
        : modal === 'event'
          ? selected
            ? 'Edit event'
            : eventDefaults.status === 'proposal'
              ? 'Create proposal'
              : eventDefaults.status === 'confirmed'
                ? 'Create booking'
                : 'Add a new lead'
          : selected?.title || 'Event details';
  return (
    <SidebarProvider
      className={
        'eventdesk-shell' +
        (view === 'Overview' && business ? ' overview-workspace' : '')
      }
      style={
        {
          '--brand-color': String(data.settings?.color || '#315ee8'),
        } as React.CSSProperties
      }
    >
      <WorkspaceNavigation
        view={view}
        business={business?.name || 'Your business'}
        leads={pipeline.filter((e) => e.status === 'lead').length}
        onNavigate={navigate}
      />
      <main className="workspace">
        <header className="topbar">
          <div>
            <SidebarTrigger />
            <span>Workspace</span>
            <ChevronRight size={15} />
            <strong>{viewTitle(view)}</strong>
          </div>
          {!signedOut && business && (
            <GlobalSearch
              key={business.id}
              data={data}
              disabled={loading || busy}
              onOpen={(target) => {
                if (target.type === 'event') {
                  navigate(
                    target.event.status === 'confirmed'
                      ? 'Bookings'
                      : target.event.status === 'proposal'
                        ? 'Proposals'
                        : 'Leads',
                  );
                  open(target.event);
                } else if (target.type === 'package') {
                  navigate('Packages');
                  setPackageDefaults({});
                  setEditingPackage(target.package);
                  setError('');
                  setModal('package');
                } else {
                  navigate('Places & venues');
                  setSearchResource({
                    id: target.venue.id,
                    request: Date.now(),
                  });
                }
              }}
            />
          )}
          <div className="sales-top-navigation">
            {!signedOut && business && (
              <CreateMenu
                disabled={loading || busy}
                onEvent={createEvent}
                onAppointment={() => createAppointment()}
                onBookingLinks={() => navigate('Website integration')}
              />
            )}
            {!signedOut && business && (
              <UserMenu
                account={accountController.account}
                onNavigate={navigate}
              />
            )}
            <span className="prototype">EARLY ACCESS</span>
          </div>
        </header>
        <div className="page">
          <div className="page-heading">
            <div>
              <p className="eyebrow">YOUR BUSINESS, IN FOCUS</p>
              <h1
                tabIndex={-1}
                data-workspace-heading={
                  view !== 'Overview' || !business ? true : undefined
                }
              >
                {view === 'Overview' && !business
                  ? business
                    ? 'Good things are taking shape.'
                    : 'Let’s make great events happen.'
                  : view === 'Packages'
                    ? 'Packages'
                    : viewTitle(view)}
              </h1>
              <p className="muted">
                {subtitles[view] ||
                  (resourceKind
                    ? modules[resourceKind].description
                    : 'Manage every part of your event business.')}
              </p>
            </div>
            {!signedOut &&
              ['Overview', 'Leads', 'Proposals', 'Bookings'].includes(view) && (
                <button
                  className="primary"
                  disabled={loading}
                  onClick={() =>
                    create(
                      view === 'Packages'
                        ? 'package'
                        : business
                          ? 'event'
                          : 'business',
                    )
                  }
                >
                  <Plus size={18} />
                  {!business
                    ? 'Set up your business'
                    : view === 'Packages'
                      ? 'New package'
                      : view === 'Proposals'
                        ? 'New proposal'
                        : view === 'Bookings'
                          ? 'New booking'
                          : 'New lead'}
                </button>
              )}
          </div>
          {notice && (
            <div className="notice" role="status">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}
          {error && !modal && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => void load()}>Try again</button>
            </div>
          )}
          {!signedOut && business && (
            <WorkspaceContextNavigation view={view} onNavigate={navigate} />
          )}
          {signedOut ? (
            <section className="welcome-panel">
              <div>
                <span className="pill">YOUR OWN BUSINESS WORKSPACE</span>
                <h2>Welcome to EventDesk.</h2>
                <p>
                  Sign in to set up your services, build packages,
                  <br />
                  and turn inquiries into booked events.
                </p>
                <a
                  className="white-button"
                  href="/sign-in?return_to=/"
                  target="_top"
                >
                  Sign in to EventDesk <ArrowUpRight size={18} />
                </a>
              </div>
              <div className="welcome-steps">
                <div>
                  <span>01</span>Your business
                  <small>Separate records and services</small>
                </div>
                <div>
                  <span>02</span>Your offering
                  <small>Packages across 13 categories</small>
                </div>
                <div>
                  <span>03</span>Your next event
                  <small>Leads through confirmed bookings</small>
                </div>
              </div>
            </section>
          ) : loading ? (
            <div className="loading-grid" aria-label="Loading your workspace">
              <Skeleton className="h-60 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : (
            <>
              {view === 'Overview' && business && (
                <OverviewDashboard
                  data={data}
                  controller={accountController}
                  onNavigate={navigate}
                  onOpen={open}
                  onEdit={(e) => {
                    setSelected(e);
                    setError('');
                    setModal('event');
                  }}
                  onCreate={(status) => {
                    create('event');
                    setEventDefaults({ status });
                  }}
                  onAppointment={createAppointment}
                />
              )}
              {view === 'Overview' && !business && (
                <section className="welcome-panel">
                  <div>
                    <span className="pill">YOUR FIRST STEP</span>
                    <h2>Your next chapter starts here.</h2>
                    <p>
                      Choose your services and create your first package.
                      <br />
                      Then turn your next inquiry into a booked event.
                    </p>
                    <button
                      className="white-button"
                      onClick={() => create('business')}
                    >
                      Create your workspace <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <div className="welcome-steps">
                    <div>
                      <span>01</span>Make it yours
                      <small>Business name &amp; services</small>
                    </div>
                    <div>
                      <span>02</span>Build your offering
                      <small>Packages &amp; pricing</small>
                    </div>
                    <div>
                      <span>03</span>Book something great
                      <small>Leads, proposals &amp; events</small>
                    </div>
                  </div>
                </section>
              )}
              {salesGroups.flat().includes(view) && (
                <SalesWorkspace
                  key={view + ':' + salesEditorRequest}
                  view={view}
                  data={data}
                  initialEditor={salesInitialEditor}
                  currentStaffId={accountController.account?.profile.staffId}
                  onData={setData}
                  onOpen={open}
                  onNavigate={navigate}
                  onCreateEvent={(defaults = {}) => {
                    create('event');
                    setEventDefaults((current) => ({
                      ...current,
                      ...defaults,
                    }));
                  }}
                />
              )}
              {userMenuGroups.flat().includes(view) && (
                <UserWorkspace
                  key={view}
                  view={view}
                  data={data}
                  controller={accountController}
                  onData={setData}
                  onNavigate={navigate}
                  onOpen={open}
                  onCreateEvent={(defaults = {}) => {
                    create('event');
                    setEventDefaults((current) => ({
                      ...current,
                      ...defaults,
                    }));
                  }}
                />
              )}
              {view === 'Packages' && (
                <PackageManager
                  data={data}
                  onData={setData}
                  onEdit={(p) => {
                    setEditingPackage(p);
                    setError('');
                    setModal('package');
                  }}
                  onNew={(service, group) =>
                    create('package', { service, group })
                  }
                />
              )}
              {view === 'Business settings' && (
                <BusinessSettings
                  data={data}
                  onData={setData}
                  onNavigate={navigate}
                />
              )}
              {view === 'Booking engine' && (
                <BookingEngine
                  data={data}
                  onData={setData}
                  onNavigate={navigate}
                />
              )}
              {view === 'Payment settings' && (
                <PaymentSettings
                  data={data}
                  onData={setData}
                  onNavigate={navigate}
                />
              )}
              {view === 'Website integration' && (
                <WebsiteIntegration
                  data={data}
                  onData={setData}
                  onNavigate={navigate}
                />
              )}
              {view === 'Refer friends' && (
                <ReferFriends
                  data={data}
                  onData={setData}
                  onNavigate={navigate}
                />
              )}
              {view === 'Manage' && <ManageHome onNavigate={navigate} />}
              {resourceKind &&
                ['messages', 'automations', 'system_templates'].includes(
                  resourceKind,
                ) && (
                  <MessageWorkspace
                    key={resourceKind}
                    kind={resourceKind}
                    data={data}
                    onData={setData}
                    onNavigate={navigate}
                  />
                )}
              {resourceKind === 'designs' && (
                <DesignCollections
                  data={data}
                  onData={setData}
                  onNavigate={navigate}
                />
              )}
              {resourceKind === 'staff' && (
                <StaffAccounts
                  data={data}
                  onData={setData}
                  onNavigate={navigate}
                />
              )}
              {resourceKind &&
                ![
                  'messages',
                  'automations',
                  'system_templates',
                  'designs',
                  'staff',
                ].includes(resourceKind) && (
                  <ManagedResources
                    key={`${resourceKind}:${searchResource?.request || 0}`}
                    kind={resourceKind}
                    initialResourceId={
                      resourceKind === 'venues' ? searchResource?.id : undefined
                    }
                    data={data}
                    onData={setData}
                    onNavigate={navigate}
                  />
                )}
            </>
          )}
          <footer className="page-footer">
            <span>EventDesk · Built for the business behind the event.</span>
            <span>
              Offline payments available · Online processing and e-signatures
              not connected
            </span>
          </footer>
        </div>
      </main>
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!busy && !open) {
            setModal('');
            setError('');
          }
        }}
      >
        <DialogContent
          className={`crm-dialog ${modal === 'package' ? 'package-dialog' : ''} ${modal === 'detail' && selected?.status !== 'lead' ? 'proposal-dialog' : ''}`}
        >
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>
              {modal === 'detail'
                ? 'Your event, client, and quote in one place.'
                : modal === 'business'
                  ? 'Your business gets its own services, clients, and bookings.'
                  : modal === 'package'
                    ? 'Set your offering and pricing in USD.'
                    : 'Capture the details now. Keep the conversation moving.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {modal === 'business' && (
            <BusinessForm business={business} onSave={save} busy={busy} />
          )}{' '}
          {modal === 'package' && (
            <PackageEditor
              key={editingPackage?.id || 'new-package'}
              defaults={packageDefaults}
              data={data}
              onImages={(id, images) => {
                setData((d) => ({
                  ...d,
                  packages: d.packages.map((p) =>
                    p.id === id ? { ...p, images } : p,
                  ),
                }));
                setEditingPackage((p) => (p ? { ...p, images } : p));
              }}
              item={editingPackage}
              options={business?.services || []}
              onSave={save}
              busy={busy}
            />
          )}{' '}
          {modal === 'event' && (
            <EventForm
              data={data}
              item={selected}
              defaults={eventDefaults}
              packages={packages}
              onSave={save}
              busy={busy}
            />
          )}{' '}
          {modal === 'detail' && selected && selected.status !== 'lead' && (
            <ProposalWorkspace
              key={selected.id}
              item={selected}
              data={data}
              onSave={manageSave}
              busy={busy}
              initialTab={
                eventTab === 'payments'
                  ? 'Make Payment'
                  : eventTab === 'messages'
                    ? 'Messages'
                    : ['Checklists', 'Questionnaires'].includes(eventTab)
                      ? eventTab
                      : 'Overview'
              }
              onData={(next) => {
                setData(next);
                setSelected(next.events.find((e) => e.id === selected.id));
              }}
              onEdit={() => setModal('event')}
              onConfirm={() =>
                void save({
                  action: 'advance_event',
                  id: selected.id,
                  status: 'confirmed',
                })
              }
              onReopen={() =>
                void save({
                  action: 'advance_event',
                  id: selected.id,
                  status: 'proposal',
                })
              }
            />
          )}
          {modal === 'detail' &&
            selected &&
            !['proposal', 'confirmed'].includes(selected.status) && (
              <div className="form-stack">
                <div className="detail-bar">
                  <Status
                    status={
                      activeEvent(selected)
                        ? selected.status
                        : selected.lifecycle || selected.status
                    }
                  />
                  <button
                    className="text-button"
                    disabled={!activeEvent(selected)}
                    onClick={() => setModal('event')}
                  >
                    Edit details <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="detail-grid">
                  <div>
                    <h3>{selected.client}</h3>
                    <p>
                      <Mail size={15} />
                      {selected.email}
                    </p>
                    {selected.phone && (
                      <p>
                        <Phone size={15} />
                        {selected.phone}
                      </p>
                    )}
                  </div>
                  <div>
                    <p>
                      <CalendarDays size={15} />
                      {prettyDate(selected.date)} {selected.time}
                    </p>
                    <p>
                      <MapPin size={15} />
                      {selected.venue || 'Venue to be decided'}
                    </p>
                  </div>
                </div>
                <div className="quote-lines">
                  {selected.items.map((p) => (
                    <div key={p.id}>
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.service} · {p.duration}
                        </small>
                      </span>
                      <b>{money(p.price)}</b>
                    </div>
                  ))}
                  <div className="quote-total">
                    <strong>Total</strong>
                    <strong>{money(selected.total)}</strong>
                  </div>
                  <div>
                    <span>Requested deposit</span>
                    <strong>{money(selected.deposit)}</strong>
                  </div>
                </div>
                {selected.notes && (
                  <div className="notes">
                    <h3>Private notes</h3>
                    <p>{selected.notes}</p>
                  </div>
                )}
                <div className="form-footer">
                  {selected.status !== 'lead' ? (
                    <a
                      className="secondary"
                      href={`/proposal/${selected.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Printer size={16} />
                      Preview / print
                    </a>
                  ) : (
                    <span>
                      {selected.follow_up
                        ? `Follow up ${prettyDate(selected.follow_up)}`
                        : 'No follow-up set'}
                    </span>
                  )}
                  {selected.status === 'confirmed' && activeEvent(selected) && (
                    <button
                      disabled={busy}
                      className="secondary"
                      onClick={() =>
                        void save({
                          action: 'advance_event',
                          id: selected.id,
                          status: 'proposal',
                        })
                      }
                    >
                      Reopen for changes
                    </button>
                  )}
                  {selected.status !== 'confirmed' && activeEvent(selected) && (
                    <button
                      disabled={busy}
                      className="primary"
                      onClick={() =>
                        void save({
                          action: 'advance_event',
                          id: selected.id,
                          status:
                            selected.status === 'lead'
                              ? 'proposal'
                              : 'confirmed',
                        })
                      }
                    >
                      {selected.status === 'lead'
                        ? 'Create proposal'
                        : 'Confirm booking'}
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
                <p className="fine-print">
                  {selected.status === 'lead'
                    ? 'Creating a proposal saves a draft; it does not send email.'
                    : selected.status === 'proposal'
                      ? 'Confirm only after arranging acceptance with your client. Online payments and e-signatures are not connected.'
                      : 'Confirmed internally. Record offline payments in the Payments tab below.'}
                </p>
                {!activeEvent(selected) && (
                  <p className="capability-note">
                    This record is {selected.lifecycle?.toLowerCase()}. Restore
                    it from the Sales list before editing or confirming.
                  </p>
                )}
                <QuoteBreakdown quote={selected.operations?.quote} />
                <EventPlanning
                  key={selected.id + eventTab}
                  initialTab={eventTab}
                  item={selected}
                  data={data}
                  onSave={manageSave}
                  busy={busy}
                />
              </div>
            )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
