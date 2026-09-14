'use client';
import { installmentSchedule } from '@/lib/payment-plans';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowUpRight, Copy, Settings as SettingsIcon } from 'lucide-react';
import { workspaceGroups, workspaceHref } from '@/lib/workspace-navigation';
import { localNavigation } from './workspace-navigation';
import { settingGroups } from '@/lib/settings';
import { money, type Data } from '@/lib/crm';
import {
  ManagedResources,
  MediaLibrary,
  type ManageProps,
} from './manage-resources';
import { SettingsForm, SettingsCenter } from './management';
import { SChoice, SField, SToggle, STabs } from './sales-ui';
import { MSection } from './manage-editors';
import { BrandManager } from './brand-manager';
export function ManageHome({
  onNavigate,
}: {
  onNavigate: (s: string) => void;
}) {
  return (
    <div className="setup-directory">
      {[
        ...workspaceGroups.flatMap((g) => g.items).filter((i) => i.children),
        {
          label: 'Messages',
          children: [
            { label: 'Automations', view: 'Automated messages' },
            { label: 'Custom message templates', view: 'Message templates' },
            { label: 'System templates', view: 'System templates' },
          ],
        },
      ].map((group) => (
        <section className="panel" key={group.label}>
          <h2>{group.label}</h2>
          {group.children
            ?.filter((item) => item.view !== 'Manage')
            .map((item) => (
              <a
                key={item.view}
                href={workspaceHref(item.view)}
                onClick={(e) => localNavigation(e, item.view, onNavigate)}
              >
                {item.label}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            ))}
        </section>
      ))}
    </div>
  );
}
function SettingPane({
  group,
  data,
  onData,
  fieldKeys,
}: {
  fieldKeys?: string[];
  group: string;
  data: Data;
  onData: (d: Data) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        j = (await res.json()) as Data & { error?: string };
      if (!res.ok) throw Error(j.error);
      onData(j);
      setNotice('Settings saved.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <SettingsForm
        key={group + (fieldKeys || []).join()}
        fieldKeys={fieldKeys}
        group={group}
        data={data}
        onSave={save}
        busy={busy}
      />
    </section>
  );
}
export function BookingEngine(props: ManageProps) {
  const [tab, setTab] = useState('General');
  return (
    <>
      <STabs
        tabs={[
          'General',
          'Presets',
          'Extra questions',
          'Extra categories',
          'Unavailable notices',
          'Privacy & consent',
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'Unavailable notices' && (
        <ManagedResources kind="unavailable_notices" {...props} />
      )}
      {['General', 'Unavailable notices', 'Privacy & consent'].includes(tab) ? (
        <SettingPane
          group="booking"
          data={props.data}
          onData={props.onData}
          fieldKeys={
            tab === 'Unavailable notices'
              ? ['unavailableNotice']
              : tab === 'Privacy & consent'
                ? [
                    'privacyUrl',
                    'requireConsent',
                    'consentText',
                    'smsDisclaimer',
                  ]
                : settingGroups.booking.fields
                    .map((f) => f.key)
                    .filter(
                      (k) =>
                        ![
                          'unavailableNotice',
                          'privacyUrl',
                          'requireConsent',
                          'consentText',
                          'smsDisclaimer',
                        ].includes(k),
                    )
          }
        />
      ) : (
        <ManagedResources
          key={tab}
          kind={
            tab === 'Presets'
              ? 'booking_presets'
              : tab === 'Extra questions'
                ? 'booking_questions'
                : 'extra_categories'
          }
          {...props}
        />
      )}
    </>
  );
}
const businessSettingsGroups = [
  {
    label: 'Business',
    items: ['Business profile', 'Branding', 'Media library', 'Reviews'],
  },
  {
    label: 'Booking rules',
    items: [
      'Availability',
      'Availability rules',
      'Places',
      'Travel',
      'Tax',
      'Terms',
    ],
  },
  {
    label: 'Sales preferences',
    items: [
      'Lead forms',
      'Lead settings',
      'Proposal defaults',
      'Proposal presets',
    ],
  },
  { label: 'Connections', items: ['Integrations', 'Referrals'] },
];
const settingsSlug = (name: string) => name.toLowerCase().replaceAll(' ', '-');
export function BusinessSettings(props: ManageProps) {
  const [tab, setTab] = useState('Business profile');
  useEffect(() => {
    const restore = () =>
      setTab(
        businessSettingsGroups
          .flatMap((g) => g.items)
          .find(
            (name) =>
              settingsSlug(name) ===
              new URLSearchParams(window.location.search).get('panel'),
          ) || 'Business profile',
      );
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function select(name: string) {
    if (name === tab) return;
    window.history.pushState(
      null,
      '',
      workspaceHref('Business settings') + '&panel=' + settingsSlug(name),
    );
    setTab(name);
  }
  const kinds: Record<string, string> = {
    Travel: 'travel_zones',
    Tax: 'tax_zones',
    'Lead forms': 'lead_forms',
    'Proposal presets': 'proposal_presets',
    Reviews: 'reviews',
    Places: 'venues',
    'Availability rules': 'inventory_rules',
    Terms: 'contracts',
  };
  return (
    <div className="business-settings-layout">
      <nav
        className="business-settings-navigation"
        aria-label="Business settings"
      >
        {businessSettingsGroups.map((group) => (
          <section key={group.label}>
            <h2>{group.label}</h2>
            {group.items.map((name) => (
              <a
                key={name}
                href={
                  workspaceHref('Business settings') +
                  '&panel=' +
                  settingsSlug(name)
                }
                aria-current={tab === name ? 'page' : undefined}
                onClick={(e) => localNavigation(e, name, select)}
              >
                {name}
              </a>
            ))}
          </section>
        ))}
      </nav>
      <div className="business-settings-content" key={tab}>
        {kinds[tab] ? (
          <ManagedResources key={tab} kind={kinds[tab]} {...props} />
        ) : tab === 'Media library' ? (
          <MediaLibrary {...props} />
        ) : tab === 'Integrations' ? (
          <IntegrationDirectory />
        ) : tab === 'Branding' ? (
          <BrandManager {...props} primaryEditor={<ProfileSettings {...props} section="branding" />} />
        ) : tab === 'Business profile' ? (
          <ProfileSettings
            {...props}
            section="profile"
          />
        ) : (
          <SettingPane
            key={tab}
            group={
              (
                {
                  Branding: 'branding',
                  'Lead settings': 'leads',
                  'Proposal defaults': 'proposals',
                  Availability: 'availability',
                  Referrals: 'referrals',
                } as Record<string, string>
              )[tab] || 'branding'
            }
            data={props.data}
            onData={props.onData}
          />
        )}
      </div>
    </div>
  );
}
function ProfileSettings({
  data,
  onData,
  section,
}: ManageProps & { section: 'profile' | 'branding' }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function reload() {
    const r = await fetch('/api/crm');
    if (r.ok) onData((await r.json()) as Data);
  }
  async function save(b: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(
          b.action === 'save_business' ? '/api/crm' : '/api/manage',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(b),
          },
        ),
        j = (await res.json()) as Data & { error?: string };
      if (!res.ok) throw Error(j.error);
      onData(j);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <p className="error">{error}</p>}
      <SettingsCenter
        data={data}
        onSave={save}
        busy={busy}
        onReload={reload}
        only={section}
      />
    </>
  );
}
export function PaymentSettings(props: ManageProps) {
  const [tab, setTab] = useState('Overview');
  return (
    <>
      <STabs
        tabs={[
          'Overview',
          'Due dates & tips',
          'Payment plans',
          'Customer payment options',
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'Due dates & tips' ? (
        <SettingPane group="payments" data={props.data} onData={props.onData} />
      ) : tab === 'Payment plans' ? (
        <>
          <PaymentPlanPreview data={props.data} />
          <ManagedResources kind="payment_plans" {...props} />
        </>
      ) : tab === 'Customer payment options' ? (
        <ManagedResources kind="payment_methods" {...props} />
      ) : (
        <>
          <section className="panel">
            <h2>Payment processing</h2>
            <p className="muted">
              Connect the business account that receives your client payments.
            </p>
            <div className="integration-grid">
              {['Stripe', 'PayPal'].map((provider) => (
                <article key={provider}>
                  <h3>{provider}</h3>
                  <span className="status proposal">Not connected</span>
                  <p>
                    {provider === 'Stripe'
                      ? 'Hosted checkout for card and supported bank/wallet payments.'
                      : 'PayPal checkout with payments applied to the booking balance.'}
                  </p>
                  <p className="muted">
                    Provider setup is pending. No online charges are enabled.
                  </p>
                </article>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>Additional payment settings</h2>
            <div className="management-grid">
              {[
                'Due dates & tips',
                'Payment plans',
                'Customer payment options',
              ].map((name) => (
                <button
                  className="panel"
                  key={name}
                  onClick={() => setTab(name)}
                >
                  <SettingsIcon size={22} />
                  <h3>{name}</h3>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
            <p>
              Offline payments can be recorded in Sales → Payments. A client’s
              booking request still requires your approval.
            </p>
          </section>
        </>
      )}
    </>
  );
}
function PaymentPlanPreview({ data }: { data: Data }) {
  const [total, setTotal] = useState('1000'),
    [deposit, setDeposit] = useState('250'),
    [due, setDue] = useState(
      new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    ),
    [plan, setPlan] = useState('Deposit + equal installments'),
    [count, setCount] = useState('3');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section className="panel">
      <h2>Try a payment plan</h2>
      <div className="form-grid">
        <SField
          label="Booking total (USD)"
          type="number"
          value={total}
          onChange={setTotal}
        />
        <SField
          label="Deposit (USD)"
          type="number"
          value={deposit}
          onChange={setDeposit}
        />
        <SChoice
          label="Plan"
          value={plan}
          onChange={setPlan}
          options={[
            'Deposit + final payment',
            'Deposit + monthly payments',
            'Deposit + equal installments',
            'Pay in full',
          ]}
        />
        <SField
          label="Installment count"
          type="number"
          value={count}
          onChange={setCount}
        />
        <SField
          label="Final due date"
          type="date"
          value={due}
          onChange={setDue}
        />
      </div>
      {due &&
        Number.isFinite(Number(total)) &&
        installmentSchedule(
          Number(total) * 100,
          Number(deposit) * 100,
          plan,
          Number(count) || 1,
          today,
          due,
        ).map((p, i) => (
          <div className="manage-order-row" key={i}>
            <span>
              {p.label} · {p.date}
            </span>
            <b>{money(p.amount)}</b>
          </div>
        ))}
      <p className="muted">
        Preview only. Automatic charging requires a connected provider and
        customer authorization.
      </p>
    </section>
  );
}
function IntegrationDirectory() {
  const names = [
    'Stripe',
    'PayPal',
    'Email delivery',
    'SMS delivery',
    'Calendar sync',
    'Automatic tax lookup',
    'Travel distance lookup',
    'Design libraries',
    'Accounting sync',
    'Client and staff portals',
  ];
  return (
    <section className="panel">
      <h2>Integrations</h2>
      <div className="integration-grid">
        {names.map((name) => (
          <article key={name}>
            <h3>{name}</h3>
            <span className="status proposal">Not connected</span>
          </article>
        ))}
      </div>
      <p className="muted">
        Only configured integrations can perform external actions. Email and SMS
        delivery are deferred by your preference.
      </p>
    </section>
  );
}
export function CopyBlock({
  value,
  label = 'Link',
}: {
  value: string;
  label?: string;
}) {
  const [notice, setNotice] = useState(''),
    [qr, setQr] = useState('');
  return (
    <div className="form-stack">
      <label className="field">
        {label}
        <textarea readOnly value={value} rows={value.length > 220 ? 4 : 2} />
      </label>
      <div className="sales-actions">
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setNotice('Copied.');
            } catch {
              setNotice('Select the text above and copy it.');
            }
          }}
        >
          <Copy size={15} />
          Copy
        </button>
        {label !== 'Embed code' && (
          <button
            type="button"
            className="secondary"
            onClick={async () =>
              setQr(await QRCode.toDataURL(value, { width: 200, margin: 1 }))
            }
          >
            QR code
          </button>
        )}
      </div>
      {notice && <small role="status">{notice}</small>}
      {qr && (
        <img width={200} height={200} src={qr} alt="QR code for this link" />
      )}
    </div>
  );
}
export function ReferFriends({ data }: ManageProps) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return (
    <section className="panel settings-panel">
      <h2>Refer friends</h2>
      <p>Share Eventdeskly with another independent event business.</p>
      <CopyBlock
        value={origin + '/?ref=' + encodeURIComponent(data.business?.id || '')}
      />
      <CopyBlock
        label="Draft message"
        value={`Eventdeskly helps event businesses organize packages, inquiries and bookings. Take a look: ${origin}/?ref=${encodeURIComponent(data.business?.id || '')}`}
      />
      <p className="muted">
        No referral reward or promotional discount is configured. Sharing does
        not grant access to your business records.
      </p>
    </section>
  );
}
