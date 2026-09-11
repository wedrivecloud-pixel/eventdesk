'use client';
import { AvailabilityLink } from './availability-link';
import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  Package,
  Plus,
  ArrowUpRight,
  Archive,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  Plug,
  Image,
  Check,
} from 'lucide-react';
import {
  modules,
  settingGroups,
  mergedSettings,
  type Resource,
  type Settings,
  type FieldSpec,
} from '@/lib/settings';
import type { Data } from '@/lib/crm';
import { BusinessForm, type Save } from './forms';
export function Fields({
  fields,
  value,
  onChange,
}: {
  fields: FieldSpec[];
  value: Settings;
  onChange: (value: Settings) => void;
}) {
  return (
    <div className="dynamic-fields">
      {fields.map((f) => (
        <div
          className={`field ${f.type === 'textarea' ? 'wide' : ''}`}
          key={f.key}
        >
          <label htmlFor={f.key}>{f.label}</label>
          {f.type === 'checkbox' ? (
            <Switch
              id={f.key}
              checked={Boolean(value[f.key] ?? f.default)}
              onCheckedChange={(v) => onChange({ ...value, [f.key]: v })}
            />
          ) : f.type === 'select' ? (
            <Select
              value={String(value[f.key] ?? f.default ?? '')}
              onValueChange={(v) => onChange({ ...value, [f.key]: String(v) })}
            >
              <SelectTrigger id={f.key}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {f.options?.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : f.type === 'textarea' ? (
            <textarea
              id={f.key}
              value={String(value[f.key] ?? f.default ?? '')}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
              rows={6}
              maxLength={16000}
              required={f.required}
            />
          ) : (
            <input
              id={f.key}
              type={f.type || 'text'}
              value={String(value[f.key] ?? f.default ?? '')}
              onChange={(e) =>
                onChange({
                  ...value,
                  [f.key]:
                    f.type === 'number'
                      ? Number(e.target.value)
                      : e.target.value,
                })
              }
              min={f.min}
              max={f.max}
              step={f.type === 'number' ? '0.01' : undefined}
              required={f.required}
              maxLength={500}
            />
          )}{' '}
          {f.help && <small>{f.help}</small>}
        </div>
      ))}
    </div>
  );
}
function ResourceForm({
  kind,
  item,
  onSave,
  busy,
}: {
  kind: string;
  item?: Resource;
  onSave: Save;
  busy: boolean;
}) {
  const [value, setValue] = useState<Settings>(
    item?.data ||
      Object.fromEntries(
        modules[kind].fields.map((f) => [
          f.key,
          f.default ?? (f.type === 'number' ? 0 : ''),
        ]),
      ),
  );
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const name = new FormData(e.currentTarget).get('name');
        void onSave({
          action: 'save_resource',
          kind,
          id: item?.id,
          name,
          data: value,
        });
      }}
    >
      <label className="field">
        Name
        <input name="name" required maxLength={120} defaultValue={item?.name} />
      </label>
      <Fields fields={modules[kind].fields} value={value} onChange={setValue} />
      <div className="form-footer">
        <span>{modules[kind].note || 'Saved in your business workspace.'}</span>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
export function ResourceManager({
  kind,
  data,
  onSave,
  busy,
  error,
}: {
  kind: string;
  data: Data;
  onSave: Save;
  busy: boolean;
  error: string;
}) {
  const module = modules[kind];
  const [query, setQuery] = useState(''),
    [showArchived, setShowArchived] = useState(false),
    [edit, setEdit] = useState<Resource | undefined>(),
    [opened, setOpened] = useState(false);
  const records = (data.resources || []).filter(
    (r) =>
      r.kind === kind &&
      Boolean(r.archived) === showArchived &&
      r.name.toLowerCase().includes(query.toLowerCase()),
  );
  async function save(body: Record<string, unknown>) {
    const result = await onSave(body);
    if (result !== false) setOpened(false);
  }
  return (
    <>
      <section className="panel">
        <div className="management-intro">
          <div>
            <h2>{module.label}</h2>
            <p className="muted">{module.description}</p>
          </div>
          <button
            className="primary"
            disabled={!data.business}
            onClick={() => {
              setEdit(undefined);
              setOpened(true);
            }}
          >
            <Plus size={17} />
            New {kind === 'staff' ? 'team member' : 'record'}
          </button>
        </div>
        {module.note && <p className="capability-note">{module.note}</p>}
        <div className="list-toolbar">
          <div className="search">
            <Search size={16} />
            <input
              aria-label="Search records"
              placeholder="Search records…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <label className="toggle-label">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            Archived
          </label>
        </div>
        {records.length ? (
          <div className="resource-list">
            {records.map((r) => (
              <article key={r.id}>
                <span className="resource-icon">
                  <Package size={21} />
                </span>
                <div className="resource-main">
                  <h3>{r.name}</h3>
                  <p>
                    {module.fields
                      .slice(0, 3)
                      .map((f) =>
                        r.data[f.key] !== undefined && r.data[f.key] !== ''
                          ? `${f.label}: ${r.data[f.key]}`
                          : '',
                      )
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {kind === 'automations' && (
                    <span className="status proposal">Draft · sending off</span>
                  )}
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    setEdit(r);
                    setOpened(true);
                  }}
                >
                  Edit
                  <ArrowUpRight size={15} />
                </button>
                <button
                  className="icon-button"
                  disabled={busy}
                  aria-label={
                    r.archived ? `Restore ${r.name}` : `Archive ${r.name}`
                  }
                  onClick={() =>
                    void onSave({
                      action: 'archive_resource',
                      id: r.id,
                      archived: !r.archived,
                    })
                  }
                >
                  {r.archived ? <RotateCcw size={18} /> : <Archive size={18} />}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {showArchived ? 'No archived records.' : 'No records yet.'}
              </EmptyTitle>
              <EmptyDescription>
                {data.business
                  ? 'Add your first record to get started.'
                  : 'Create your business workspace first.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
      <Dialog open={opened} onOpenChange={(v) => !busy && setOpened(v)}>
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>
              {edit ? 'Edit' : 'New'} · {module.label}
            </DialogTitle>
            <DialogDescription>{module.description}</DialogDescription>
          </DialogHeader>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <ResourceForm
            key={edit?.id || 'new'}
            kind={kind}
            item={edit}
            onSave={save}
            busy={busy}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
export function SettingsForm({
  group,
  data,
  onSave,
  busy,
  fieldKeys,
}: {
  fieldKeys?: string[];
  group: string;
  data: Data;
  onSave: Save;
  busy: boolean;
}) {
  const [value, setValue] = useState<Settings>(mergedSettings(data.settings));
  const module = settingGroups[group];
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ action: 'save_settings', group, data: value });
      }}
    >
      <div>
        <h2>{module.label}</h2>
        <p className="muted">{module.description}</p>
      </div>
      {module.note && <p className="capability-note">{module.note}</p>}
      {group === 'booking' && data.business && (
        <AvailabilityLink businessId={data.business.id} />
      )}
      {group === 'booking' && (
        <a
          className="secondary"
          href="/booking-preview"
          target="_blank"
          rel="noreferrer"
        >
          Open owner booking preview <ArrowUpRight size={16} />
        </a>
      )}
      <Fields
        fields={module.fields.filter(
          (f) => !fieldKeys || fieldKeys.includes(f.key),
        )}
        value={value}
        onChange={setValue}
      />
      <div className="form-footer">
        <span>Changes apply to new quotes unless noted.</span>
        <button className="primary" disabled={busy || !data.business}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
export function SettingsCenter({
  data,
  onSave,
  busy,
  onReload,
  only,
}: {
  data: Data;
  onSave: Save;
  busy: boolean;
  onReload: () => Promise<void>;
  only?: 'profile' | 'branding';
}) {
  const [tab, setTab] = useState('profile'),
    [logoError, setLogoError] = useState(''),
    [uploading, setUploading] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setLogoError('');
    try {
      const r = await fetch('/api/logo', {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const result = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(result.error);
      await onReload();
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : 'Logo upload failed.');
    } finally {
      setUploading(false);
    }
  }
  const logoControl = (
    <div className="logo-upload">
      {data.settings?.logoVersion ? (
        <img
          src={`/api/logo?v=${data.settings.logoVersion}`}
          alt="Business logo"
        />
      ) : (
        <Image size={34} />
      )}
      <label className="field">
        Business logo
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading || !data.business}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        <small>
          {uploading ? 'Uploading…' : 'PNG, JPEG or WebP · up to 2 MB'}
        </small>
      </label>
      {logoError && <p role="alert">{logoError}</p>}
    </div>
  );
  if (only)
    return (
      <section className="panel settings-panel">
        {only === 'profile' ? (
          <BusinessForm business={data.business} onSave={onSave} busy={busy} />
        ) : (
          <>
            {logoControl}
            <SettingsForm
              group="branding"
              data={data}
              onSave={onSave}
              busy={busy}
            />
          </>
        )}
      </section>
    );
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(String(v))}
      className="settings-center"
    >
      <TabsList className="settings-tabs">
        <TabsTrigger value="profile">Business profile</TabsTrigger>
        {Object.entries(settingGroups).map(([key, g]) => (
          <TabsTrigger value={key} key={key}>
            {g.label}
          </TabsTrigger>
        ))}
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">
        <section className="panel settings-panel">
          <BusinessForm business={data.business} onSave={onSave} busy={busy} />
        </section>
      </TabsContent>
      {Object.keys(settingGroups).map((key) => (
        <TabsContent key={key} value={key}>
          <section className="panel settings-panel">
            {key === 'branding' && logoControl}
            <SettingsForm
              key={key + data.business?.id}
              group={key}
              data={data}
              onSave={onSave}
              busy={busy}
            />
          </section>
        </TabsContent>
      ))}
      <TabsContent value="integrations">
        <section className="panel settings-panel">
          <h2>Integrations</h2>
          <p className="muted">
            Connection status for services used by your business.
          </p>
          <p className="note">
            Public package booking requests are available. Copy a package’s
            client booking link from Package Manager. New requests appear in
            Leads for your approval.
          </p>
          <div className="integration-grid">
            {[
              [
                'Payments',
                'Card and bank payments require a payment provider account.',
              ],
              [
                'Email & SMS',
                'Outbound delivery, invitations and automated reminders require a messaging provider.',
              ],
              [
                'Calendar sync',
                'Google / Outlook synchronization is not connected.',
              ],
              [
                'Client portal',
                'Customer accounts, electronic signatures and a portal for existing bookings are not connected.',
              ],
            ].map(([name, description]) => (
              <article key={name}>
                <Plug size={23} />
                <h3>{name}</h3>
                <span className="status proposal">Not connected</span>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      </TabsContent>
    </Tabs>
  );
}
export function ManagementHome({
  onNavigate,
}: {
  onNavigate: (s: string) => void;
}) {
  return (
    <div className="management-grid">
      <button className="panel" onClick={() => onNavigate('Packages')}>
        <Package size={24} />
        <h2>Package Manager</h2>
        <p>Services, groups, package sorting, visibility and bulk updates.</p>
        <ArrowUpRight size={18} />
      </button>
      {Object.entries(modules).map(([key, m]) => (
        <button key={key} className="panel" onClick={() => onNavigate(m.label)}>
          <Package size={24} />
          <h2>{m.label}</h2>
          <p>{m.description}</p>
          <ArrowUpRight size={18} />
        </button>
      ))}
      <button className="panel" onClick={() => onNavigate('Business settings')}>
        <SettingsIcon size={24} />
        <h2>Business settings</h2>
        <p>Branding, booking engine, tax, travel, deposits and availability.</p>
        <ArrowUpRight size={18} />
      </button>
    </div>
  );
}
