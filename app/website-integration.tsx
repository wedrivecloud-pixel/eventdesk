'use client';
import { useState } from 'react';
import { Code, ArrowUpRight, Link as LinkIcon, Grid2X2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { ManageProps } from './manage-resources';
import { managerGroups } from '@/lib/package-manager';
import { CopyBlock } from './manage-hubs';
import { SChoice, SField, SToggle } from './sales-ui';
import {
  integrationTools,
  integrationPath,
  integrationCode,
  widgetDefaults,
  widgetOptions,
  safeHttps,
  type IntegrationKind,
  type EmbedStyle,
  type WidgetOptions,
} from '@/lib/website-integration';
import './website-integration.css';
export function WebsiteIntegration({ data, onNavigate }: ManageProps) {
  const [selected, setSelected] = useState<IntegrationKind>();
  const resources = data.resources || [],
    forms = resources.filter((r) => r.kind === 'lead_forms' && !r.archived),
    calendars = resources.filter((r) => {
      if (r.kind !== 'appointment_calendars' || r.archived) return false;
      try {
        return JSON.parse(String(r.data.config)).enabled !== false;
      } catch {
        return false;
      }
    }),
    staff = resources.filter(
      (r) =>
        r.kind === 'staff' &&
        !r.archived &&
        r.data.staffRole !== false &&
        calendars.some((c) => c.data.staffId === r.id),
    );
  const readiness = (id: IntegrationKind) =>
    id === 'signin'
      ? 'Customer portal not connected'
      : id === 'mini'
        ? 'Mini sessions not connected'
        : id === 'lead' && !forms.length
          ? 'Create a lead form'
          : id === 'appointments' && !staff.length
            ? 'Create a scheduling calendar'
            : '';
  return (
    <section className="panel settings-panel integration-home">
      <div>
        <h2>Website Integration</h2>
        <p className="muted">
          Connect your website to EventDesk with booking links, buttons and
          embedded tools.
        </p>
      </div>
      <div className="integration-primary">
        {integrationTools
          .filter((t) => t.group === 'links')
          .map((t) => (
            <article className="integration-card" key={t.id}>
              <LinkIcon size={22} />
              <h3>{t.title}</h3>
              <p>{t.description}</p>
              {readiness(t.id) && (
                <span className="integration-status">{readiness(t.id)}</span>
              )}
              <button className="primary" onClick={() => setSelected(t.id)}>
                <Code size={16} /> Get Embed Code
              </button>
            </article>
          ))}
      </div>
      <div className="panel-heading">
        <h2>
          <Grid2X2 size={21} /> Website Widget Library
        </h2>
      </div>
      <div className="integration-library">
        {integrationTools
          .filter((t) => t.group === 'widgets')
          .map((t) => (
            <article className="integration-card" key={t.id}>
              <h3>{t.title}</h3>
              <p>{t.description}</p>
              {readiness(t.id) && (
                <span className="integration-status">{readiness(t.id)}</span>
              )}
              <button className="secondary" onClick={() => setSelected(t.id)}>
                <Code size={16} /> Get Embed Code
              </button>
            </article>
          ))}
      </div>
      <div className="integration-note">
        <b>Using these tools on another website</b>
        <p>
          Copy the generated code into your website builder’s HTML or embed
          block. EventDesk currently permits only its owner; external clients
          and web designers need site access before they can open these tools. A
          booking or appointment request requires your approval.
        </p>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(undefined);
        }}
      >
        <DialogContent className="integration-dialog">
          <DialogHeader>
            <DialogTitle>
              {integrationTools.find((t) => t.id === selected)?.title} · Get
              Embed Code
            </DialogTitle>
            <DialogDescription>
              Customize the tool, preview it, then copy the generated link or
              HTML.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <IntegrationBuilder
              key={selected}
              kind={selected}
              data={data}
              onNavigate={(section) => {
                setSelected(undefined);
                onNavigate(section);
              }}
              forms={forms}
              staff={staff}
              calendars={calendars}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
type Resources = NonNullable<ManageProps['data']['resources']>;
function IntegrationBuilder({
  kind,
  data,
  onNavigate,
  forms,
  staff,
  calendars,
}: {
  kind: IntegrationKind;
  data: ManageProps['data'];
  onNavigate: ManageProps['onNavigate'];
  forms: Resources;
  staff: Resources;
  calendars: Resources;
}) {
  const title = integrationTools.find((t) => t.id === kind)!.title,
    isLink = ['book', 'package', 'signin', 'mini'].includes(kind),
    isGallery = ['addons', 'backdrops', 'designs', 'staff'].includes(kind);
  const [style, setStyle] = useState<EmbedStyle>(
      isLink ? 'Link Only' : 'Embed on my site',
    ),
    [o, setOptions] = useState<WidgetOptions>(() => ({
      ...widgetDefaults(),
      button: kind !== 'staff',
      buttonText:
        kind === 'signin'
          ? 'Sign In'
          : kind === 'appointments'
            ? 'Schedule appointment'
            : 'Book Now',
    })),
    [advanced, setAdvanced] = useState(false),
    [allPackages, setAllPackages] = useState(false),
    [target, setTarget] = useState(''),
    [formId, setForm] = useState(forms[0]?.id || ''),
    [staffId, setStaff] = useState(staff[0]?.id || ''),
    [calendarId, setCalendar] = useState(''),
    [externalUrl, setExternal] = useState(''),
    [preview, setPreview] = useState(false),
    [specificCategories, setSpecificCategories] = useState(false),
    [specificPackages, setSpecificPackages] = useState(false),
    [customBooking, setCustomBooking] = useState(false);
  const set = <K extends keyof WidgetOptions>(k: K, v: WidgetOptions[K]) =>
    setOptions((old) => ({ ...old, [k]: v }));
  const options = widgetOptions({
    ...o,
    embed: style === 'Embed on my site',
    categoryIds: specificCategories ? o.categoryIds : [],
    packageIds: specificPackages ? o.packageIds : [],
    customBookingUrl: customBooking ? o.customBookingUrl : '',
  });
  const origin =
      typeof window === 'undefined'
        ? 'https://eventdesk.invalid'
        : window.location.origin,
    business = data.business!,
    packages = data.packages.filter(
      (p) =>
        business.services.includes(p.service) &&
        ['Public', ...(allPackages ? ['Private'] : [])].includes(
          p.settings?.status || 'Public',
        ),
    );
  const groupScopes = business.services.flatMap((service) =>
    managerGroups({ ...data, packages }, service)
      .filter((g) => g.name)
      .map((g) => ({
        value: 'group:' + JSON.stringify([service, g.name]),
        label: service + ' / ' + g.name + ' · Package group',
        service,
        name: g.name,
      })),
  );
  const targetPackage = target.startsWith('package:') ? target.slice(8) : '',
    targetService = target.startsWith('service:') ? target.slice(8) : '',
    group = groupScopes.find((g) => g.value === target);
  const path = integrationPath(
      kind,
      {
        business: business.id,
        packageId: targetPackage,
        service: group ? group.service : targetService,
        group: group?.name,
        formId,
        staffId,
        calendarId,
        externalUrl,
      },
      options,
    ),
    url = path ? new URL(path, origin).href : '',
    code = integrationCode(origin, path, style, title, options),
    categories = (data.resources || []).filter(
      (r) =>
        r.kind === 'categories' && !r.archived && r.data.ownerKind === kind,
    );
  const scopes = business.services.flatMap((service) => [
    { value: 'service:' + service, label: service + ' · All packages' },
    ...groupScopes.filter((g) => g.service === service),
    ...packages
      .filter((p) => p.service === service)
      .map((p) => ({
        value: 'package:' + p.id,
        label:
          service +
          ' / ' +
          (p.settings?.group ? p.settings.group + ' / ' : '') +
          p.name +
          (p.settings?.status === 'Private' ? ' · Private' : ''),
      })),
  ]);
  const missing =
    specificCategories && !o.categoryIds.length
      ? 'Select at least one category or collection.'
      : specificPackages && !o.packageIds.length
        ? 'Select at least one package.'
        : customBooking && !safeHttps(o.customBookingUrl)
          ? 'Enter a valid HTTPS booking destination.'
          : kind === 'package' && !path
            ? 'Choose a package, service or group.'
            : kind === 'lead' && !formId
              ? 'Create a lead form before getting its embed code.'
              : kind === 'appointments' && !staffId
                ? 'Create an active appointment calendar for a staff member first.'
                : ['signin', 'mini'].includes(kind) && !path
                  ? externalUrl
                    ? 'Enter a valid HTTPS destination.'
                    : kind === 'signin'
                      ? 'Customer accounts are not connected. Add the URL of a connected customer portal to generate its sign-in link.'
                      : 'Mini-session booking is not connected. Add an existing mini-session booking URL to generate its link.'
                  : '';
  function downloadGuide() {
    const text = `${business.name} — ${title}\n\nWebsite link\n${url}\n\n${style}\n${code}\n\nPaste the HTML into your website builder's code/embed block. EventDesk site access applies; client requests require owner approval.\n`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' }),
      href = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = href;
    a.download = 'eventdesk-' + kind + '-integration.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return (
    <div className="integration-builder">
      <div className="integration-config form-stack">
        <h3>Customize</h3>
        <SChoice
          label="Choose Style"
          value={style}
          options={
            isLink
              ? ['Link Only', 'Customized Link', 'Button']
              : ['Link Only', 'Embed on my site']
          }
          onChange={(v) => {
            setStyle(v as EmbedStyle);
            setPreview(false);
          }}
        />
        {kind === 'package' && (
          <>
            <SToggle
              label="Show public and private packages"
              value={allPackages}
              onChange={(v) => {
                setAllPackages(v);
                setTarget('');
              }}
            />
            <SChoice
              label="Select a package, service or group"
              value={target}
              options={[{ value: '', label: 'Choose…' }, ...scopes]}
              onChange={setTarget}
            />
            {targetPackage && (
              <p className="muted">
                Selected package:{' '}
                {data.packages.find((p) => p.id === targetPackage)?.name}.
                Clients open this package directly.
              </p>
            )}
          </>
        )}
        {['signin', 'mini'].includes(kind) && (
          <>
            <p className="capability-note">
              {kind === 'signin'
                ? 'EventDesk customer accounts are not connected. The business workspace sign-in is separate from customer sign-in.'
                : 'Mini-session checkout is not connected.'}
            </p>
            <SField
              label={
                kind === 'signin'
                  ? 'Connected customer sign-in URL'
                  : 'Connected mini-session URL'
              }
              type="url"
              value={externalUrl}
              onChange={setExternal}
            />
          </>
        )}
        {kind === 'lead' && (
          <>
            <SChoice
              label="Choose Contact Form"
              value={formId}
              options={forms.map((r) => ({ value: r.id, label: r.name }))}
              onChange={setForm}
            />
            <button
              className="record-link"
              onClick={() => onNavigate('Lead forms')}
            >
              Customize your contact forms →
            </button>
          </>
        )}
        {kind === 'appointments' && (
          <>
            <SChoice
              label="Choose Staff"
              value={staffId}
              options={staff.map((r) => ({ value: r.id, label: r.name }))}
              onChange={(id) => {
                setStaff(id);
                setCalendar('');
              }}
            />
            {staffId && (
              <SChoice
                label="Scheduling Calendar"
                value={calendarId}
                options={[
                  { value: '', label: 'All active calendars' },
                  ...calendars
                    .filter((c) => c.data.staffId === staffId)
                    .map((c) => ({ value: c.id, label: c.name })),
                ]}
                onChange={setCalendar}
              />
            )}
            <button
              className="record-link"
              onClick={() => onNavigate('User accounts')}
            >
              Manage staff scheduling →
            </button>
          </>
        )}
        {isLink && style !== 'Link Only' && (
          <SField
            label="Text"
            value={o.buttonText}
            onChange={(v) => set('buttonText', v)}
          />
        )}
        {isGallery && (
          <>
            <SToggle
              label="Show Book Now Button"
              value={o.button}
              onChange={(v) => set('button', v)}
            />
            {o.button && (
              <SField
                label="Button Text"
                value={o.buttonText}
                onChange={(v) => set('buttonText', v)}
              />
            )}{' '}
            {['addons', 'backdrops'].includes(kind) && (
              <SToggle
                label="Show Pricing"
                value={o.price}
                onChange={(v) => set('price', v)}
              />
            )}{' '}
            {kind === 'backdrops' && (
              <SToggle
                label="Show Title"
                value={o.showTitle}
                onChange={(v) => set('showTitle', v)}
              />
            )}{' '}
            {kind === 'designs' && (
              <SToggle
                label="Show Tag Viewer"
                value={o.showTags}
                onChange={(v) => set('showTags', v)}
              />
            )}{' '}
            {['addons', 'backdrops', 'designs'].includes(kind) && (
              <>
                <SToggle
                  label={
                    kind === 'designs'
                      ? 'Select specific collections'
                      : 'Select specific categories'
                  }
                  value={specificCategories}
                  onChange={setSpecificCategories}
                />
                {specificCategories && (
                  <div className="integration-checklist">
                    {categories.length ? (
                      categories.map((r) => (
                        <SToggle
                          key={r.id}
                          label={r.name}
                          value={o.categoryIds.includes(r.id)}
                          onChange={(v) =>
                            set(
                              'categoryIds',
                              v
                                ? [...o.categoryIds, r.id]
                                : o.categoryIds.filter((id) => id !== r.id),
                            )
                          }
                        />
                      ))
                    ) : (
                      <p className="muted">No categories yet.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
        {kind === 'availability' && (
          <>
            <SField
              label="Message when the date is available"
              type="textarea"
              value={o.availableMessage}
              onChange={(v) => set('availableMessage', v)}
            />
            <SField
              label="Message when the date is unavailable"
              type="textarea"
              value={o.unavailableMessage}
              onChange={(v) => set('unavailableMessage', v)}
            />
          </>
        )}
        {!isLink && style === 'Embed on my site' && (
          <>
            <SToggle
              label="Enable Compatibility Mode (fixed-height iframe)"
              value={o.compatibility}
              onChange={(v) => set('compatibility', v)}
            />
            <p className="muted">
              The standard embed adjusts its height automatically. Compatibility
              mode uses a plain iframe for website builders that strip scripts.
            </p>
            <SField
              label="Initial iframe height (pixels)"
              type="number"
              value={o.height}
              onChange={(v) => set('height', Number(v))}
            />
          </>
        )}
        {(style === 'Button' || !isLink) && (
          <>
            <button
              className="record-link"
              onClick={() => setAdvanced(!advanced)}
            >
              {advanced ? 'Hide' : 'Show'} Advanced Options
            </button>
            {advanced && (
              <section className="integration-advanced form-stack">
                <h3>Advanced</h3>
                {isGallery && (
                  <SChoice
                    label="When booking"
                    value={o.bookingPackage}
                    options={[
                      {
                        value: '',
                        label: 'Take customer to package selection',
                      },
                      ...data.packages
                        .filter(
                          (p) =>
                            business.services.includes(p.service) &&
                            ['Public', 'Private'].includes(
                              p.settings?.status || 'Public',
                            ),
                        )
                        .map((p) => ({
                          value: p.id,
                          label: 'Pre-select ' + p.name,
                        })),
                    ]}
                    onChange={(v) => set('bookingPackage', v)}
                  />
                )}
                {kind === 'availability' && (
                  <>
                    <SToggle
                      label="Show Book Now button when available"
                      value={o.button}
                      onChange={(v) => set('button', v)}
                    />
                    <SField
                      label="Button Text"
                      value={o.buttonText}
                      onChange={(v) => set('buttonText', v)}
                    />
                    <SToggle
                      label="Redirect to a custom booking URL"
                      value={customBooking}
                      onChange={setCustomBooking}
                    />
                    {customBooking && (
                      <SField
                        label="Custom booking URL (HTTPS)"
                        value={o.customBookingUrl}
                        onChange={(v) => set('customBookingUrl', v)}
                      />
                    )}
                    <SToggle
                      label="Select packages to display"
                      value={specificPackages}
                      onChange={setSpecificPackages}
                    />
                    {specificPackages && (
                      <div className="integration-checklist">
                        {packages.map((p) => (
                          <SToggle
                            key={p.id}
                            label={p.name}
                            value={o.packageIds.includes(p.id)}
                            onChange={(v) =>
                              set(
                                'packageIds',
                                v
                                  ? [...o.packageIds, p.id]
                                  : o.packageIds.filter((id) => id !== p.id),
                              )
                            }
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
                {kind === 'lead' && (
                  <>
                    <SToggle
                      label="Use wide buttons"
                      value={o.wideButtons}
                      onChange={(v) => set('wideButtons', v)}
                    />
                    <SToggle
                      label="Show labels as placeholders"
                      value={o.placeholders}
                      onChange={(v) => set('placeholders', v)}
                    />
                  </>
                )}
                <div className="form-grid">
                  {[
                    [
                      'textColor',
                      kind === 'lead'
                        ? 'Override Label Color'
                        : 'Override Text Color',
                    ],
                    ['buttonColor', 'Button Background Color'],
                    ['buttonTextColor', 'Button Text Color'],
                  ]
                    .filter(([k]) => !isLink || k !== 'textColor')
                    .map(([k, label]) => (
                      <SField
                        key={k}
                        label={label}
                        type="color"
                        value={o[k as keyof WidgetOptions]}
                        onChange={(v) => set(k as 'textColor', v)}
                      />
                    ))}
                  <SChoice
                    label="Font Family"
                    value={o.font}
                    options={[
                      'Arial, sans-serif',
                      'Georgia, serif',
                      'Verdana, sans-serif',
                      'Tahoma, sans-serif',
                      'Times New Roman, serif',
                    ]}
                    onChange={(v) => set('font', v)}
                  />
                  {!isLink && (
                    <SField
                      label="Maximum Width (pixels)"
                      type="number"
                      value={o.maxWidth}
                      onChange={(v) => set('maxWidth', Number(v))}
                    />
                  )}
                  {kind === 'lead' && (
                    <>
                      <SField
                        label="Label Font Weight"
                        type="number"
                        value={o.labelWeight}
                        onChange={(v) => set('labelWeight', Number(v))}
                      />
                      <SField
                        label="Label Font Size"
                        type="number"
                        value={o.labelSize}
                        onChange={(v) => set('labelSize', Number(v))}
                      />
                      <SField
                        label="Border Width"
                        type="number"
                        value={o.borderWidth}
                        onChange={(v) => set('borderWidth', Number(v))}
                      />
                      <SField
                        label="Border Color"
                        type="color"
                        value={o.borderColor}
                        onChange={(v) => set('borderColor', v)}
                      />
                      <SField
                        label="Textbox Background Color"
                        type="color"
                        value={o.inputBackground}
                        onChange={(v) => set('inputBackground', v)}
                      />
                    </>
                  )}
                  <SField
                    label="Border Radius"
                    type="number"
                    value={o.borderRadius}
                    onChange={(v) => set('borderRadius', Number(v))}
                  />
                  {isGallery && (
                    <SField
                      label="Maximum Items Per Page"
                      type="number"
                      value={o.pageSize}
                      onChange={(v) => set('pageSize', Number(v))}
                    />
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <div className="integration-output form-stack">
        <h3>{style === 'Link Only' ? 'Link' : 'HTML'}</h3>
        {missing ? (
          <output className="integration-note">{missing}</output>
        ) : (
          <>
            <CopyBlock
              label={style === 'Link Only' ? 'Link' : 'Embed code'}
              value={code}
            />
            <h3>Preview</h3>
            {isLink ? (
              style === 'Link Only' ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="integration-url"
                >
                  {url}
                </a>
              ) : (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  style={
                    style === 'Button'
                      ? {
                          display: 'inline-block',
                          padding: '12px 20px',
                          background: options.buttonColor,
                          color: options.buttonTextColor,
                          borderRadius: options.borderRadius,
                          fontFamily: options.font,
                          textDecoration: 'none',
                        }
                      : undefined
                  }
                >
                  {o.buttonText || title}
                </a>
              )
            ) : (
              <>
                <button
                  className="secondary"
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? 'Hide' : 'Show'} live preview
                </button>
                {preview && (
                  <iframe
                    title="Widget live preview"
                    src={url}
                    className="integration-preview"
                  />
                )}
              </>
            )}
            <div className="sales-actions">
              <a
                className="secondary"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                Open page <ArrowUpRight size={16} />
              </a>
              <button className="secondary" onClick={downloadGuide}>
                Download guide for web designer
              </button>
            </div>
            <p className="muted">
              Changes update this code immediately. Copy the new code again
              after customizing.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
