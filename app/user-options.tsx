'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  UserCircle,
  ChevronDown,
  CalendarDays,
  CircleHelp,
  LogOut,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  personalData,
  type AccountState,
  type UserProfile,
} from '@/lib/user-account';
import type { Data, EventRecord } from '@/lib/crm';
import type { Resource } from '@/lib/settings';
import { SField, SChoice, SToggle, STabs, STable, SActions } from './sales-ui';
import { SalesWorkspace } from './sales-workspace';
import { StaffAccounts } from './staff-accounts';
import { MediaPicker } from './manage-editors';
import { CopyBlock } from './manage-hubs';
import './user-options.css';

export function useUserAccount(businessId?: string) {
  const [account, setAccount] = useState<AccountState>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const reload = useCallback(async () => {
    if (!businessId) return;
    setError('');
    try {
      const r = await fetch('/api/account', { cache: 'no-store' }),
        j = (await r.json()) as AccountState & { error?: string };
      if (!r.ok) throw Error(j.error);
      setAccount(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your account.');
    }
  }, [businessId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            updatedAt: account?.updatedAt || '',
          }),
        }),
        j = (await r.json()) as AccountState & { error?: string };
      if (!r.ok) throw Error(j.error);
      setAccount(j);
      setNotice(
        ['save_dashboard', 'save_overview'].includes(String(body.action))
          ? 'Dashboard saved.'
          : body.action === 'save_overview_revenue'
            ? 'Revenue view saved as your default.'
            : body.action === 'save_support_draft'
              ? 'Draft saved. It has not been sent.'
              : body.action === 'save_profile'
                ? 'Profile saved.'
                : 'Document library updated.',
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { account, error, busy, notice, reload, run };
}
export type AccountController = ReturnType<typeof useUserAccount>;
export function UserMenu({
  account,
  onNavigate,
}: {
  account?: AccountState;
  onNavigate: (s: string) => void;
}) {
  const name =
    account?.profile.firstName ||
    account?.identity.fullName?.split(' ')[0] ||
    'My account';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="sales-menu-trigger"
        aria-label={'User options · ' + name}
      >
        <UserCircle size={19} />
        <span>{name}</span>
        <ChevronDown size={15} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="sales-menu user-options-menu">
        <DropdownMenuItem onClick={() => onNavigate('My Profile')}>
          <UserCircle size={17} />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onNavigate('Set Booking Availability')}
        >
          <CalendarDays size={17} />
          My availability
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNavigate('Support')}>
          <CircleHelp size={17} />
          Help & support
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<a href="/sign-out" target="_top" />}
        >
          <LogOut size={17} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function UserWorkspace({
  view,
  data,
  onData,
  onOpen,
  onNavigate,
  onCreateEvent,
  controller,
}: {
  view: string;
  data: Data;
  onData: (d: Data) => void;
  onOpen: (e: EventRecord) => void;
  onNavigate: (s: string) => void;
  onCreateEvent: (d?: Partial<EventRecord>) => void;
  controller: AccountController;
}) {
  const { account, error, busy, reload } = controller;
  if (!account)
    return (
      <section className="panel settings-panel">
        <p>{error || 'Loading your account…'}</p>
        {error && (
          <button className="secondary" onClick={() => void reload()}>
            Try again
          </button>
        )}
      </section>
    );
  const staff = (data.resources || []).find(
      (r) =>
        r.kind === 'staff' && !r.archived && r.id === account.profile.staffId,
    ),
    staffId = staff?.id || '';
  const personal = [
    'My Bookings',
    'My Appointments',
    'My Checklist',
    'My Calendar',
  ].includes(view);
  const salesView: Record<string, string> = {
    'All Bookings': 'Bookings',
    'My Bookings': 'Bookings',
    'My Appointments': 'Appointments',
    'My Checklist': 'To-do List',
    'My Calendar': 'Calendar',
  };
  return (
    <div className="user-workspace">
      {controller.notice && (
        <output className="sales-notice">{controller.notice}</output>
      )}
      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void reload()}
          >
            Reload account
          </button>
        </div>
      )}
      {salesView[view] && (
        <>
          <div className="user-view-switch">
            <button
              className={!personal ? 'primary' : 'secondary'}
              onClick={() =>
                onNavigate(
                  view.includes('Booking')
                    ? 'All Bookings'
                    : view === 'My Calendar'
                      ? 'Calendar'
                      : view === 'My Checklist'
                        ? 'To-do List'
                        : 'Appointments',
                )
              }
            >
              {view.includes('Booking')
                ? 'All Bookings'
                : view === 'My Calendar'
                  ? 'Business Calendar'
                  : view === 'My Checklist'
                    ? 'All Checklist Items'
                    : 'All Appointments'}
            </button>
            {view.includes('Booking') && (
              <button
                className={personal ? 'primary' : 'secondary'}
                onClick={() => onNavigate('My Bookings')}
              >
                My Bookings
              </button>
            )}
          </div>
          {personal && (
            <div className="user-context">
              <p>
                {staff
                  ? `Showing work assigned to ${staff.name}, including appointments and checklist items assigned to the business owner.`
                  : 'Owner-assigned appointments and checklist items are included. Link your staff profile to include assigned bookings and staff appointments.'}
              </p>
              <button
                className="record-link"
                onClick={() => onNavigate('My Profile')}
              >
                My profile & staff link
              </button>
            </div>
          )}
          <SalesWorkspace
            key={view + staffId}
            view={salesView[view]}
            personal={personal}
            currentStaffId={staffId}
            data={personal ? personalData(data, staffId, view) : data}
            onData={onData}
            onNavigate={onNavigate}
            onCreateEvent={onCreateEvent}
            onOpen={(e) =>
              onOpen(data.events.find((original) => original.id === e.id) || e)
            }
          />
          {view === 'My Calendar' && (
            <p className="capability-note">
              Export calendar downloads a snapshot for your calendar app. Live
              calendar subscriptions and external calendar sync are not
              connected.
            </p>
          )}
        </>
      )}
      {view === 'My Profile' && (
        <ProfileEditor
          key={account.updatedAt}
          data={data}
          controller={controller}
          onNavigate={onNavigate}
        />
      )}
      {['Set Booking Availability', 'Appointment Scheduling'].includes(view) &&
        (staff ? (
          <StaffAccounts
            key={view + staffId}
            data={data}
            onData={onData}
            onNavigate={onNavigate}
            selectedStaffId={staffId}
            initialTab={
              view === 'Set Booking Availability'
                ? 'Staff Booking Availability'
                : 'Appointment Scheduling'
            }
          />
        ) : (
          <section className="panel settings-panel">
            <h2>Connect your staff profile</h2>
            <p>
              Link your staff record in My Profile to manage your weekly
              availability, time off and appointment calendars.
            </p>
            <div className="sales-actions">
              <button
                className="primary"
                onClick={() => onNavigate('My Profile')}
              >
                Link my staff profile
              </button>
              <button
                className="secondary"
                onClick={() => onNavigate('User accounts')}
              >
                Create a staff profile
              </button>
            </div>
          </section>
        ))}
      {view === 'Client Documents' && (
        <ClientDocuments data={data} controller={controller} />
      )}
      {view === 'Billing' && <AccountBilling onNavigate={onNavigate} />}
      {view === 'Support' && (
        <SupportCenter
          key={account.updatedAt}
          controller={controller}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
function ProfileEditor({
  data,
  controller,
  onNavigate,
}: {
  data: Data;
  controller: AccountController;
  onNavigate: (s: string) => void;
}) {
  const { account, busy, run } = controller;
  const [p, setP] = useState<UserProfile>(() => ({
      ...account!.profile,
      contactEmail: account!.profile.contactEmail || account!.identity.email,
    })),
    [saved, setSaved] = useState(false);
  const field = (
    key: keyof UserProfile,
    label: string,
    type = 'text',
    required = false,
  ) => (
    <SField
      label={label}
      type={type}
      required={required}
      value={p[key]}
      onChange={(v) => setP({ ...p, [key]: v })}
    />
  );
  return (
    <form
      className="user-profile-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run({ action: 'save_profile', profile: p })) setSaved(true);
      }}
    >
      <section className="panel settings-panel form-stack">
        <h2>User Details</h2>
        <div className="form-grid">
          {field('firstName', 'First Name', 'text', true)}
          {field('lastName', 'Last Name')}
          {field('company', 'Business Name')}
          {field('contactEmail', 'Contact Email', 'email')}
          {field('phone', 'Phone', 'tel')}
          {field('street', 'Address')}
          {field('city', 'City')}
          {field('region', 'State / Province')}
          {field('postalCode', 'Zip / Postal Code')}
        </div>
        {field('bio', 'Bio', 'textarea')}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Update Profile'}
        </button>
        {saved && <output>Profile saved.</output>}
      </section>
      <aside className="form-stack">
        <section className="panel settings-panel">
          <h2>Bio Image</h2>
          <MediaPicker
            data={data}
            ids={p.photoId ? [p.photoId] : []}
            imageHint="Choose a profile photo (PNG, JPEG or WebP)."
            onChange={(ids) => setP({ ...p, photoId: ids.at(-1) || '' })}
          />
        </section>
        <section className="panel settings-panel form-stack">
          <h2>My Staff Profile</h2>
          <SChoice
            label="Staff record linked to me"
            value={p.staffId}
            onChange={(staffId) => setP({ ...p, staffId })}
            options={[
              { value: '', label: 'Not linked' },
              ...(data.resources || [])
                .filter((r) => r.kind === 'staff' && !r.archived)
                .map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
          <p className="muted">
            This identifies your assigned bookings and scheduling calendars.
            Save your profile after choosing a record.
          </p>
          <button
            type="button"
            className="record-link"
            onClick={() => onNavigate('User accounts')}
          >
            Manage staff & user accounts
          </button>
        </section>
        <section className="panel settings-panel form-stack">
          <h2>More Options</h2>
          <p>
            Signed in as <b>{account!.identity.email}</b>. Contact email changes
            do not change your sign-in account.
          </p>
          <p className="muted">
            Password resets and two-factor authentication are managed by your
            EventDesk sign-in.
          </p>
          <SToggle
            label="Yes, Send Daily Digests"
            value={p.dailyDigest}
            onChange={(dailyDigest) => setP({ ...p, dailyDigest })}
          />
          <small>
            Email delivery is not connected. Save this preference for use after
            connection.
          </small>
          <button
            type="button"
            className="record-link"
            onClick={() => onNavigate('Appointment Scheduling')}
          >
            Appointment Scheduling →
          </button>
        </section>
      </aside>
    </form>
  );
}
function ClientDocuments({
  data,
  controller,
}: {
  data: Data;
  controller: AccountController;
}) {
  const { account, run, busy } = controller,
    [q, setQ] = useState(''),
    [edit, setEdit] = useState<Resource | null>(),
    [remove, setRemove] = useState<Resource>();
  const docs = account!.documents.filter((r) =>
    r.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <section className="panel settings-panel form-stack">
      <div className="panel-heading">
        <div>
          <h2>Client Documents</h2>
          <p className="muted">
            Frequently requested files, such as insurance certificates and tax
            documents.
          </p>
        </div>
        <button className="primary" onClick={() => setEdit(null)}>
          New Document
        </button>
      </div>
      <p className="capability-note">
        Files remain private to this business. Staff/customer visibility
        preferences are saved for future account access; customer and separate
        staff sign-in are not connected.
      </p>
      <SField label="Search documents" value={q} onChange={setQ} />
      <STable
        headers={['File name or description', 'Staff', 'Customers', 'Actions']}
        rows={docs.map((r) => [
          r.name,
          r.data.staffView ? 'Allowed when connected' : 'Hidden',
          r.data.customerView ? 'Allowed when connected' : 'Hidden',
          <div className="sales-actions">
            <a
              className="record-link"
              href={
                '/api/media?id=' + encodeURIComponent(String(r.data.mediaId))
              }
              target="_blank"
              rel="noreferrer"
            >
              Download / Open
            </a>
            <SActions
              label={'Document actions: ' + r.name}
              items={[
                { label: 'Edit document', action: () => setEdit(r) },
                { label: 'Remove document', action: () => setRemove(r) },
              ]}
            />
          </div>,
        ])}
      />
      {!docs.length && (
        <p>
          No documents match this view. Add your first document with New
          Document.
        </p>
      )}
      <Dialog
        open={edit !== undefined}
        onOpenChange={(open) => {
          if (!open && !busy) setEdit(undefined);
        }}
      >
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>
              {edit ? 'Edit Document' : 'Upload Document'}
            </DialogTitle>
            <DialogDescription>
              Choose a file and its visibility preferences.
            </DialogDescription>
          </DialogHeader>
          {edit !== undefined && (
            <DocumentEditor
              key={edit?.id || 'new'}
              item={edit}
              data={data}
              controller={controller}
              onClose={() => setEdit(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!remove}
        onOpenChange={(open) => {
          if (!open && !busy) setRemove(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove document?</DialogTitle>
            <DialogDescription>
              Remove {remove?.name} from this library. Its stored file is
              retained.
            </DialogDescription>
          </DialogHeader>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (
                remove &&
                (await run({ action: 'archive_document', id: remove.id }))
              )
                setRemove(undefined);
            }}
          >
            Remove from library
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setRemove(undefined)}
          >
            Cancel
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
function DocumentEditor({
  item,
  data,
  controller,
  onClose,
}: {
  item: Resource | null;
  data: Data;
  controller: AccountController;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name || ''),
    [ids, setIds] = useState<string[]>(item ? [String(item.data.mediaId)] : []),
    [staff, setStaff] = useState(item?.data.staffView !== false),
    [customer, setCustomer] = useState(item?.data.customerView !== false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await controller.run({
            action: 'save_document',
            id: item?.id,
            name,
            mediaId: ids[0],
            staffView: staff,
            customerView: customer,
          })
        )
          onClose();
      }}
    >
      <SField
        label="File Name or Description"
        required
        value={name}
        onChange={setName}
      />
      <MediaPicker
        data={data}
        documents
        ids={ids}
        onChange={(v) => setIds(v.slice(-1))}
      />
      <SToggle
        label="Allow staff to see this attachment?"
        value={staff}
        onChange={setStaff}
      />
      <SToggle
        label="Allow customers to see this attachment?"
        value={customer}
        onChange={setCustomer}
      />
      {controller.error && (
        <p className="error" role="alert">
          {controller.error}
        </p>
      )}
      <button
        type="submit"
        className="primary"
        disabled={controller.busy || !ids.length}
      >
        {controller.busy ? 'Saving…' : 'Save Document'}
      </button>
    </form>
  );
}
function AccountBilling({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [tab, setTab] = useState('Subscription');
  return (
    <section className="panel settings-panel form-stack">
      <h2>EventDesk Billing</h2>
      <STabs
        tabs={['Subscription', 'Billing History', 'Activity']}
        value={tab}
        onChange={setTab}
      />
      {tab === 'Subscription' ? (
        <>
          <h3>Subscription billing is not connected</h3>
          <p>
            EventDesk plan prices and a billing provider have not been chosen.
            There is no active EventDesk subscription charge or saved payment
            card in this workspace.
          </p>
          <div className="user-billing-grid">
            <article>
              <h4>Current Plan</h4>
              <p>Early access · Pricing not configured</p>
            </article>
            <article>
              <h4>Payment Method</h4>
              <p>No billing provider connected</p>
            </article>
            <article>
              <h4>Plan Changes</h4>
              <p>
                Upgrades, billing cycles and cancellation become available after
                subscription billing is connected.
              </p>
            </article>
          </div>
          <button
            className="secondary"
            onClick={() => onNavigate('Payment settings')}
          >
            Customer payment settings
          </button>
        </>
      ) : tab === 'Billing History' ? (
        <>
          <STable
            headers={[
              'Created',
              'Due',
              'Paid',
              'Status',
              'Invoice Number',
              'Download',
            ]}
            rows={[]}
          />
          <p>
            No EventDesk subscription invoices are available. Customer event
            payments are in Payments.
          </p>
        </>
      ) : (
        <p>
          No subscription billing activity. Plan changes and charges will appear
          here once billing is connected.
        </p>
      )}
    </section>
  );
}
const guides = [
  {
    title: 'Get started',
    target: 'Business settings',
    body: 'Save your business name and services in Business settings. Add packages in Package Manager, then customize your booking engine.',
  },
  {
    title: 'My bookings and calendar',
    target: 'My Profile',
    body: 'Link your staff record in My Profile and save. My Bookings shows bookings assigned to that record. My Calendar adds your appointments and approved time off.',
  },
  {
    title: 'Appointments and availability',
    target: 'Appointment Scheduling',
    body: 'Link an active staff profile, then open Set Booking Availability for weekly hours and time off. Appointment Scheduling manages calendar duration, questions, hours and share links.',
  },
  {
    title: 'Checklists',
    target: 'My Checklist',
    body: 'My Checklist includes tasks assigned to the business owner or your linked staff profile. Filter unchecked or overdue items and mark them complete. Checklist templates set up recurring event tasks.',
  },
  {
    title: 'Website integration',
    target: 'Website integration',
    body: 'Choose a tool and Get Embed Code. Customize the link or widget, then copy it into your website. The site is currently owner-private, so external clients need site access before using it.',
  },
  {
    title: 'Payments and messages',
    target: 'Payment settings',
    body: 'Record payments already received through Payments. Online processing, subscription billing, email and text delivery require provider connections. Messages currently supports drafts and review.',
  },
];
function SupportCenter({
  controller,
  onNavigate,
}: {
  controller: AccountController;
  onNavigate: (s: string) => void;
}) {
  const [q, setQ] = useState(''),
    [subject, setSubject] = useState(controller.account!.supportDraft.subject),
    [body, setBody] = useState(controller.account!.supportDraft.body),
    [saved, setSaved] = useState(false);
  return (
    <section className="panel settings-panel form-stack">
      <h2>Support Center</h2>
      <SField label="Search help" value={q} onChange={setQ} />
      <div className="user-help-grid">
        {guides
          .filter((g) =>
            (g.title + ' ' + g.body).toLowerCase().includes(q.toLowerCase()),
          )
          .map((g) => (
            <article key={g.title}>
              <h3>{g.title}</h3>
              <p>{g.body}</p>
              <button
                className="record-link"
                onClick={() => onNavigate(g.target)}
              >
                Open {g.target} →
              </button>
            </article>
          ))}
      </div>
      <details className="user-context">
        <summary>Product updates</summary>
        <p>
          User options now includes personal work views, saved profiles, staff
          links and a client-document library. Website Integration includes
          booking links and customizable widget embeds.
        </p>
      </details>
      <div className="user-context">
        <h3>Contact support</h3>
        <p>
          Live chat, support email delivery, video tutorials, webinars and
          setup-review calls are not connected for EventDesk. Save a request
          below and copy it into your conversation with the person helping you
          build EventDesk.
        </p>
      </div>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await controller.run({
              action: 'save_support_draft',
              subject,
              body,
            })
          )
            setSaved(true);
        }}
      >
        <h3>Support request draft</h3>
        <SField label="Subject" value={subject} onChange={setSubject} />
        <SField
          label="Describe the issue or idea"
          type="textarea"
          max={10000}
          value={body}
          onChange={setBody}
        />
        <button type="submit" className="primary" disabled={controller.busy}>
          Save Draft
        </button>
        {saved && <output>Draft saved. It has not been sent.</output>}
      </form>
      {(subject || body) && (
        <CopyBlock
          label="Copy support request"
          value={subject + '\n\n' + body}
        />
      )}
    </section>
  );
}
