'use client';
import { QuestionInput } from './question-input';
import { VenueAutocomplete } from './venue-autocomplete';
import { savedVenues, type VenueSuggestion } from '@/lib/venue-autocomplete';
export { QuestionInput } from './question-input';
import { useId, useState, type ReactNode } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  ImagePlus,
} from 'lucide-react';
import { SChoice, SField, SToggle, STabs, staffOptions } from './sales-ui';
import { Fields } from './management';
import { modules, type Resource, type Settings } from '@/lib/settings';
import {
  details,
  emptyDetails,
  fieldTypes,
  weekdays,
  defaultLeadFields,
  type ResourceDetails,
  type FormField,
} from '@/lib/manage-config';
import type { Data } from '@/lib/crm';

export function MSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="manage-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
export function ScopeEditor({
  value,
  onChange,
  data,
  title = 'Packages',
}: {
  value: ResourceDetails;
  onChange: (v: ResourceDetails) => void;
  data: Data;
  title?: string;
}) {
  return (
    <MSection title={title}>
      <SChoice
        label="Applies to"
        value={value.packageMode}
        options={[
          { value: 'all', label: 'All packages' },
          { value: 'selected', label: 'Selected packages' },
          { value: 'none', label: 'No packages' },
        ]}
        onChange={(v) =>
          onChange({
            ...value,
            packageMode: v as ResourceDetails['packageMode'],
          })
        }
      />
      {value.packageMode === 'selected' && (
        <div className="manage-choice-list">
          {data.packages.map((p) => (
            <SToggle
              key={p.id}
              label={`${p.service} / ${p.name}`}
              value={value.packageIds.includes(p.id)}
              onChange={(v) =>
                onChange({
                  ...value,
                  packageIds: v
                    ? [...value.packageIds, p.id]
                    : value.packageIds.filter((id) => id !== p.id),
                })
              }
            />
          ))}
          {!data.packages.length && (
            <p>Create packages in Package Manager first.</p>
          )}
        </div>
      )}
    </MSection>
  );
}
export function MediaPicker({
  data,
  ids,
  onChange,
  documents = false,
  imageHint = 'PNG, JPEG or WebP; ideal package artwork is 820 × 460 px',
}: {
  data: Data;
  ids: string[];
  onChange: (ids: string[]) => void;
  documents?: boolean;
  imageHint?: string;
}) {
  const [opened, setOpened] = useState(false),
    [uploaded, setUploaded] = useState<Resource[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const media = [
    ...(data.resources || []).filter((r) => r.kind === 'media' && !r.archived),
    ...uploaded,
  ]
    .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
    .filter((r) => documents || String(r.data.mime).startsWith('image/'));
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch(
        '/api/media?' + new URLSearchParams({ name: file.name }),
        { method: 'PUT', headers: { 'Content-Type': file.type }, body: file },
      );
      const j = (await r.json()) as { error?: string; file: Resource };
      if (!r.ok) throw Error(j.error);
      setUploaded((x) => [...x, j.file]);
      onChange([...ids, j.file.id]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="manage-media">
      <div className="manage-media-grid">
        {ids.map((id, i) => (
          <article key={id}>
            {documents ? (
              <a href={'/api/media?id=' + id} target="_blank" rel="noreferrer">
                {media.find((x) => x.id === id)?.name || 'Attachment'}
              </a>
            ) : (
              <img
                src={'/api/media?id=' + id}
                alt={media.find((x) => x.id === id)?.name || 'Selected image'}
              />
            )}
            <small>{!documents && i === 0 ? 'Primary image' : ''}</small>
            <div className="sales-actions">
              {i > 0 && !documents && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onChange([id, ...ids.filter((x) => x !== id)])}
                >
                  Make primary
                </button>
              )}
              <button
                type="button"
                className="icon-button"
                aria-label="Remove selected file"
                onClick={() => onChange(ids.filter((x) => x !== id))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="sales-actions">
        <label className="secondary manage-upload">
          <ImagePlus size={17} />
          {busy ? 'Uploading…' : 'Upload file'}
          <input
            type="file"
            disabled={busy || ids.length >= 20}
            accept={
              documents
                ? 'image/png,image/jpeg,image/webp,application/pdf'
                : 'image/png,image/jpeg,image/webp'
            }
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => setOpened(true)}
        >
          Media library
        </button>
      </div>
      <small>
        {documents
          ? 'Images or PDF documents'
          : imageHint}{' '}
        · up to 10 MB per file
      </small>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Dialog open={opened} onOpenChange={setOpened}>
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>Media library</DialogTitle>
            <DialogDescription>
              Select files already uploaded to your business.
            </DialogDescription>
          </DialogHeader>
          <div className="manage-media-grid">
            {media.map((r) => (
              <button
                type="button"
                key={r.id}
                className="manage-media-choice"
                disabled={ids.includes(r.id) || ids.length >= 20}
                onClick={() => {
                  onChange([...ids, r.id]);
                  setOpened(false);
                }}
              >
                {String(r.data.mime).startsWith('image/') && (
                  <img src={'/api/media?id=' + r.id} alt="" />
                )}
                {r.name}
              </button>
            ))}
          </div>
          {!media.length && <p>No files yet. Upload your first file.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
const blankField = (): FormField => ({
  id: crypto.randomUUID(),
  label: 'New question',
  type: 'Text Field',
  hint: '',
  placeholder: '',
  required: false,
  options: [],
  tab: 'General',
  repeat: false,
  timeline: false,
  conditionField: '',
  conditionValue: '',
});
export function QuestionnaireBuilder({
  value,
  onChange,
}: {
  value: ResourceDetails;
  onChange: (v: ResourceDetails) => void;
}) {
  const [selected, setSelected] = useState<string>(''),
    [preview, setPreview] = useState(false),
    [tab, setTab] = useState(value.tabs[0] || 'General'),
    [answers, setAnswers] = useState<Record<string, string>>({});
  const fields = value.fields,
    field = fields.find((f) => f.id === selected);
  const update = (patch: Partial<FormField>) =>
    onChange({
      ...value,
      fields: fields.map((f) => (f.id === selected ? { ...f, ...patch } : f)),
    });
  const move = (id: string, delta: number) => {
    const next = [...fields],
      i = next.findIndex((f) => f.id === id),
      j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...value, fields: next });
  };
  return (
    <MSection title="Questionnaire builder">
      <div className="sales-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => setPreview(!preview)}
        >
          {preview ? 'Edit fields' : 'Live preview'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const name = 'Tab ' + (value.tabs.length + 1);
            onChange({ ...value, tabs: [...value.tabs, name] });
            setTab(name);
          }}
        >
          Add tab
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const f = { ...blankField(), tab };
            onChange({ ...value, fields: [...fields, f] });
            setSelected(f.id);
          }}
        >
          Add new field
        </button>
      </div>
      <STabs tabs={value.tabs} value={tab} onChange={setTab} />
      <SField
        label="Tab name"
        value={tab}
        onChange={(v) => {
          if (!v || value.tabs.includes(v)) return;
          onChange({
            ...value,
            tabs: value.tabs.map((t) => (t === tab ? v : t)),
            fields: fields.map((f) => (f.tab === tab ? { ...f, tab: v } : f)),
          });
          setTab(v);
        }}
      />
      {fields
        .filter((f) => f.tab === tab)
        .map((f) => (
          <article className="manage-question" key={f.id}>
            {preview ? (
              <QuestionInput
                field={f}
                preview
                value={answers[f.id] || ''}
                onChange={(v) => setAnswers({ ...answers, [f.id]: v })}
                answers={answers}
              />
            ) : (
              <>
                <div>
                  <b>{f.label}</b>
                  <small>
                    {f.type}
                    {f.required ? ' · Required' : ''}
                    {f.conditionField ? ' · Conditional' : ''}
                  </small>
                </div>
                <div className="sales-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setSelected(f.id)}
                  >
                    Edit field
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Duplicate field"
                    onClick={() =>
                      onChange({
                        ...value,
                        fields: [...fields, { ...f, id: crypto.randomUUID() }],
                      })
                    }
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Move field up"
                    onClick={() => move(f.id, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Move field down"
                    onClick={() => move(f.id, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Delete field"
                    onClick={() =>
                      onChange({
                        ...value,
                        fields: fields
                          .filter((x) => x.id !== f.id)
                          .map((x) =>
                            x.conditionField === f.id
                              ? { ...x, conditionField: '', conditionValue: '' }
                              : x,
                          ),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      {!fields.length && (
        <p className="muted">
          Add questions and content, then preview the form.
        </p>
      )}
      <Dialog open={!!field} onOpenChange={(v) => !v && setSelected('')}>
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>Edit field</DialogTitle>
            <DialogDescription>
              Configure the question, answer choices and display rules.
            </DialogDescription>
          </DialogHeader>
          {field && (
            <>
              <div className="form-grid">
                <SChoice
                  label="Type"
                  value={field.type}
                  options={fieldTypes}
                  onChange={(type) => update({ type })}
                />
                <SField
                  label="Name / content"
                  value={field.label}
                  onChange={(label) => update({ label })}
                />
                <SField
                  label="Hint"
                  value={field.hint}
                  onChange={(hint) => update({ hint })}
                />
                <SField
                  label="Placeholder"
                  value={field.placeholder}
                  onChange={(placeholder) => update({ placeholder })}
                />
                <SChoice
                  label="Tab"
                  value={field.tab}
                  options={value.tabs}
                  onChange={(tab) => update({ tab })}
                />
              </div>
              {[
                'Dropdown',
                'Radio Buttons',
                'Checkbox Group',
                'Song',
                'Song List',
              ].includes(field.type) && (
                <SField
                  label="Options — one per line"
                  type="textarea"
                  value={field.options.join('\n')}
                  onChange={(v) => update({ options: v.split('\n') })}
                />
              )}
              <SToggle
                label="Required answer"
                value={field.required}
                onChange={(required) => update({ required })}
              />
              <SToggle
                label="Allow repeated answers"
                value={field.repeat}
                onChange={(repeat) => update({ repeat })}
              />
              <SToggle
                label="Include a timeline time"
                value={field.timeline}
                onChange={(timeline) => update({ timeline })}
              />
              <SChoice
                label="Show only when this question matches"
                value={field.conditionField}
                options={[
                  { value: '', label: 'Always show' },
                  ...fields
                    .filter((f) => f.id !== field.id)
                    .map((f) => ({ value: f.id, label: f.label })),
                ]}
                onChange={(conditionField) => update({ conditionField })}
              />
              {field.conditionField && (
                <SField
                  label="Expected answer"
                  value={field.conditionValue}
                  onChange={(conditionValue) => update({ conditionValue })}
                />
              )}
              <button
                type="button"
                className="primary"
                onClick={() => setSelected('')}
              >
                Done editing field
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MSection>
  );
}
function AddonChoices({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="addon-choice-field">
      <span id={id}>{label}</span>
      <RadioGroup value={value} onValueChange={onChange} aria-labelledby={id}>
        {options.map((option, i) => (
          <label
            className="addon-radio"
            key={option.value}
            htmlFor={`${id}-${i}`}
          >
            <RadioGroupItem id={`${id}-${i}`} value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
const addonYesNo = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];
function AddonPricingFields({
  value,
  onChange,
}: {
  value: Settings;
  onChange: (value: Settings) => void;
}) {
  const [extendsBooking, setExtendsBooking] = useState(
    Number(value.extensionMinutes) > 0,
  );
  const [requiresLeadTime, setRequiresLeadTime] = useState(
    Number(value.leadDays) > 0,
  );
  const method = String(value.pricingMethod || 'Flat rate / per unit');
  const flat = method === 'Flat rate / per unit';
  const hourly = method === 'Multiply by package hours';
  const minutes = Number(value.extensionMinutes || 0);
  const hours = Math.floor(minutes / 60);
  return (
    <>
      <MSection title="Price & Quantity">
        <AddonChoices
          label="Do you charge based on the booking length?"
          value={method}
          options={[
            {
              value: 'Flat rate / per unit',
              label: 'Flat Rate, Per Unit, or Per Hour',
            },
            {
              value: 'Multiply by package hours',
              label: "Multiply by Package's Hours",
            },
            {
              value: 'Multiply by package days',
              label: "Multiply by Package's Days",
            },
          ]}
          onChange={(pricingMethod) => {
            const durationBased = pricingMethod !== 'Flat rate / per unit';
            if (durationBased) setExtendsBooking(false);
            onChange({
              ...value,
              pricingMethod,
              ...(durationBased ? { extensionMinutes: 0 } : {}),
            });
          }}
        />
        <label className="field">
          <span>
            {flat ? 'Price' : hourly ? 'Hourly price' : 'Daily price'} *
          </span>
          <span className="addon-price-input">
            <span aria-hidden="true">$</span>
            <input
              type="number"
              value={String(value.price ?? '')}
              min={0}
              max={1000000}
              step="0.01"
              required
              onChange={(e) =>
                onChange({ ...value, price: Number(e.target.value) })
              }
            />
          </span>
        </label>
        {!flat && (
          <small className="muted">
            The rate is multiplied by the package’s {hourly ? 'hours' : 'days'},
            then by the selected quantity.
          </small>
        )}
        <label className="field">
          <span>Max quantity per booking</span>
          <input
            type="number"
            value={String(value.maxQuantity ?? 1)}
            min={1}
            max={1000}
            step={1}
            required
            onChange={(e) =>
              onChange({ ...value, maxQuantity: Number(e.target.value) })
            }
          />
        </label>
      </MSection>
      <MSection title="Advanced">
        {(flat || extendsBooking) && (
          <>
            <AddonChoices
              label="Does this add-on extend the booking length?"
              value={extendsBooking ? 'yes' : 'no'}
              options={addonYesNo}
              onChange={(v) => {
                setExtendsBooking(v === 'yes');
                onChange({
                  ...value,
                  extensionMinutes: v === 'yes' ? minutes || 60 : 0,
                });
              }}
            />
            <small className="muted">
              Use this for setup or idle time. Each selected unit adds this
              duration.
            </small>
            {extendsBooking && (
              <div className="addon-duration">
                <p>How much time should be added to the booking length?</p>
                <div className="form-grid">
                  <label className="field">
                    <span>Hours</span>
                    <input
                      type="number"
                      min={0}
                      max={168}
                      step={1}
                      required
                      value={hours}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          extensionMinutes:
                            Number(e.target.value) * 60 + (minutes % 60),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Minutes</span>
                    <input
                      type="number"
                      min={hours === 0 ? 1 : 0}
                      max={hours === 168 ? 0 : 59}
                      step={1}
                      required
                      value={minutes % 60}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          extensionMinutes: hours * 60 + Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            )}
          </>
        )}
        <AddonChoices
          label="Does this add-on require lead time?"
          value={requiresLeadTime ? 'yes' : 'no'}
          options={addonYesNo}
          onChange={(v) => {
            setRequiresLeadTime(v === 'yes');
            onChange({
              ...value,
              leadDays: v === 'yes' ? Number(value.leadDays) || 1 : 0,
            });
          }}
        />
        <small className="muted">
          Allow preparation time, such as shipping, before the event.
        </small>
        {requiresLeadTime && (
          <label className="field">
            <span>How many days of lead time do you need?</span>
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              required
              value={String(value.leadDays ?? '')}
              onChange={(e) =>
                onChange({ ...value, leadDays: Number(e.target.value) })
              }
            />
          </label>
        )}
        <AddonChoices
          label="Would you like to show this add-on in your Extra Gallery Widget?"
          value={value.showGallery ? 'yes' : 'no'}
          options={addonYesNo}
          onChange={(v) => onChange({ ...value, showGallery: v === 'yes' })}
        />
        <small className="muted">
          Use Website integration to display your add-ons on your website.
        </small>
        <SToggle
          label="Taxable"
          value={Boolean(value.taxable)}
          onChange={(taxable) => onChange({ ...value, taxable })}
        />
      </MSection>
    </>
  );
}
function BackdropPricingFields({
  value,
  onChange,
  advanced,
  onAdvancedChange,
  data,
}: {
  value: Settings;
  onChange: (value: Settings) => void;
  advanced: ResourceDetails;
  onAdvancedChange: (value: ResourceDetails) => void;
  data: Data;
}) {
  const [includeFree, setIncludeFree] = useState(
    advanced.includedPackageIds.length > 0,
  );
  const [requiresLeadTime, setRequiresLeadTime] = useState(
    Number(value.leadDays) > 0,
  );
  const category = (data.resources || []).find(
    (r) =>
      r.kind === 'categories' &&
      !r.archived &&
      r.data.ownerKind === 'backdrops' &&
      r.id === value.categoryId,
  );
  const defaultPrice = Number(category?.data.price || 0).toLocaleString(
    'en-US',
    { style: 'currency', currency: 'USD' },
  );
  return (
    <>
      <MSection title="Price">
        <label className="field">
          <span>Price</span>
          <span className="addon-price-input">
            <span aria-hidden="true">$</span>
            <input
              type="number"
              min={0}
              max={1000000}
              step="0.01"
              value={value.inheritPrice ? '' : String(value.price ?? '')}
              placeholder="Category default"
              onChange={(e) =>
                onChange({
                  ...value,
                  price: Number(e.target.value),
                  inheritPrice: e.target.value === '',
                })
              }
            />
          </span>
        </label>
        <small className="muted">
          Leave blank to use the category default. Enter 0 for no charge.
        </small>
        <p className="muted">
          {category
            ? `${category.name} default: ${defaultPrice}`
            : 'No category selected. The default price is $0.00.'}
          {value.inheritPrice ? ' — using this default' : ''}
        </p>
      </MSection>
      <MSection title="Advanced Options">
        <AddonChoices
          label="Include at no charge with certain packages"
          value={includeFree ? 'yes' : 'no'}
          options={addonYesNo}
          onChange={(v) => {
            setIncludeFree(v === 'yes');
            if (v === 'no')
              onAdvancedChange({ ...advanced, includedPackageIds: [] });
          }}
        />
        {includeFree && (
          <div className="addon-choice-field">
            <span>Free with these packages</span>
            <div className="manage-choice-list">
              {data.packages.map((p) => (
                <SToggle
                  key={p.id}
                  label={`${p.service} / ${p.name}`}
                  value={advanced.includedPackageIds.includes(p.id)}
                  onChange={(v) =>
                    onAdvancedChange({
                      ...advanced,
                      includedPackageIds: v
                        ? [...advanced.includedPackageIds, p.id]
                        : advanced.includedPackageIds.filter(
                            (id) => id !== p.id,
                          ),
                    })
                  }
                />
              ))}
              {!data.packages.length && (
                <p>Create packages in Package Manager first.</p>
              )}
            </div>
            <small className="muted">
              Select the packages that include this backdrop for free. Package
              visibility also applies.
            </small>
          </div>
        )}
        <SToggle
          label="Use category default lead time"
          value={Boolean(value.inheritLead)}
          onChange={(inheritLead) => onChange({ ...value, inheritLead })}
        />
        {value.inheritLead ? (
          <p className="muted">
            Category lead time: {Number(category?.data.leadDays || 0)} days.
          </p>
        ) : (
          <>
            <AddonChoices
              label="Does this backdrop require lead time?"
              value={requiresLeadTime ? 'yes' : 'no'}
              options={addonYesNo}
              onChange={(v) => {
                setRequiresLeadTime(v === 'yes');
                onChange({
                  ...value,
                  leadDays: v === 'yes' ? Number(value.leadDays) || 1 : 0,
                });
              }}
            />
            <small className="muted">
              Allow preparation time, such as shipping, before the event.
            </small>
            {requiresLeadTime && (
              <label className="field">
                <span>How many days of lead time do you need?</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  required
                  value={String(value.leadDays ?? '')}
                  onChange={(e) =>
                    onChange({ ...value, leadDays: Number(e.target.value) })
                  }
                />
              </label>
            )}
          </>
        )}
        <SToggle
          label="Yes, show this backdrop with my Backdrop Gallery Widget."
          value={Boolean(value.showGallery)}
          onChange={(showGallery) => onChange({ ...value, showGallery })}
        />
        <small className="muted">
          Use Website integration to display backdrops on your website.
        </small>
        <SToggle
          label="Taxable"
          value={Boolean(value.taxable)}
          onChange={(taxable) => onChange({ ...value, taxable })}
        />
      </MSection>
    </>
  );
}
export function ResourceEditor({
  kind,
  item,
  data,
  onSubmit,
  busy,
  defaultCategory = '',
}: {
  kind: string;
  item?: Resource;
  data: Data;
  onSubmit: (b: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  defaultCategory?: string;
}) {
  const [name, setName] = useState(item?.name || ''),
    [value, setValue] = useState<Settings>(() => ({
      ...Object.fromEntries(
        modules[kind].fields.map((f) => [
          f.key,
          f.default ??
            (f.type === 'number' ? 0 : f.type === 'checkbox' ? false : ''),
        ]),
      ),
      ...item?.data,
      ...(kind === 'backdrops' && !item?.id ? { inheritPrice: true } : {}),
      categoryId: item?.data.categoryId || defaultCategory,
    }));
  const [advanced, setAdvanced] = useState<ResourceDetails>(() => {
    const d = details(item);
    if (kind === 'questionnaires' && !d.fields.length && item?.data.body)
      d.fields = String(item.data.body)
        .split('\n')
        .filter(Boolean)
        .map((label) => ({ ...blankField(), label }));
    if (kind === 'lead_forms' && !d.leadFields.length)
      d.leadFields = defaultLeadFields();
    return d;
  });
  const [tab, setTab] = useState(
    kind === 'questionnaires' && !item?.id && item?.name ? 'Fields' : 'General',
  );
  const [syncExisting, setSyncExisting] = useState(false);
  const checklistCategory =
    kind === 'categories' && value.ownerKind === 'checklists';
  const fieldSpecs = modules[kind].fields.filter(
    (f) =>
      (!checklistCategory ||
        [
          'subheader',
          'showTodo',
          'staffView',
          'staffEdit',
          'clientView',
        ].includes(f.key)) &&
      !(
        ['questionnaires', 'checklists'].includes(kind) &&
        ['body', 'service'].includes(f.key)
      ) &&
      !(kind === 'flex' && ['percent', 'day'].includes(f.key)) &&
      !(kind === 'automations' && ['trigger', 'days'].includes(f.key)) &&
      f.key !== 'assignee',
  );
  const categories = (data.resources || []).filter(
    (r) => r.kind === 'categories' && !r.archived && r.data.ownerKind === kind,
  );
  const fillVenue = (v:VenueSuggestion, preserveName=false) => {
    setName(previous=>preserveName&&previous?previous:v.name);
    setValue(previous=>({...previous,address:v.address,city:v.city,state:v.state,postalCode:v.postalCode}));
  };
  return (
    <form
      className="form-stack"
      noValidate={kind === 'questionnaires'}
      onSubmit={(e) => {
        e.preventDefault();
        const next: Settings = { ...value, details: JSON.stringify(advanced) };
        if (kind === 'backdrops') {
          if (next.inheritPrice) next.price = 0;
          if (next.inheritLead) next.leadDays = 0;
        }
        if (kind === 'questionnaires')
          next.body = advanced.fields.map((f) => f.label).join('\n');
        if (kind === 'checklists') next.body = name;
        if (kind === 'flex') {
          next.day = 'Every day';
          next.percent =
            Number(value.amount) * (value.ruleType === 'Discount' ? -1 : 1);
        }
        void onSubmit({
          action: 'save_resource',
          kind,
          id: item?.id,
          name,
          data: next,
          ...(kind === 'checklists' ? { syncExisting } : {}),
        });
      }}
    >
      <STabs
        tabs={[
          'General',
          ...(!checklistCategory ? ['Media & packages'] : []),
          ...(['questionnaires', 'lead_forms', 'designs'].includes(kind)
            ? ['Fields']
            : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'General' && (
        <>
          <MSection
            title={
              kind === 'backdrops'
                ? 'About backdrop'
                : kind === 'addons'
                  ? 'About add-on'
                  : 'General information'
            }
          >
            {kind === 'venues' ? <VenueAutocomplete label="Venue name" value={name} onChange={setName}
              mode="name" required maxLength={120} venues={savedVenues(data.resources || [],item?.id)} onSelect={fillVenue}/> : <SField
              label={kind === 'checklists' ? 'Item title' : 'Name'}
              value={name}
              onChange={setName}
              required
              max={120}
            />}
            {['addons', 'backdrops'].includes(kind) && (
              <SField
                label="Description"
                type="textarea"
                value={value.description}
                onChange={(description) => setValue({ ...value, description })}
              />
            )}
            {['addons', 'backdrops', 'designs', 'checklists'].includes(
              kind,
            ) && (
              <SChoice
                label={
                  ['addons', 'backdrops'].includes(kind)
                    ? 'Category'
                    : 'Category / collection'
                }
                value={value.categoryId || ''}
                options={[
                  { value: '', label: 'Uncategorized' },
                  ...categories.map((r) => ({ value: r.id, label: r.name })),
                ]}
                onChange={(categoryId) => setValue({ ...value, categoryId })}
              />
            )}
            {!['addons', 'backdrops', 'checklists'].includes(kind) && (
              <>
                {kind==='venues'&&<VenueAutocomplete label="Address" value={String(value.address || '')}
                  onChange={address=>setValue(previous=>({...previous,address}))} mode="address" required maxLength={500}
                  venues={savedVenues(data.resources || [],item?.id)} onSelect={v=>fillVenue(v,true)}/>}
                <Fields fields={kind==='venues'?fieldSpecs.filter(f=>f.key!=='address'):fieldSpecs} value={value} onChange={setValue} />
              </>
            )}
            {kind === 'checklists' && (
              <SField
                label="Notes"
                type="textarea"
                value={value.notes || ''}
                onChange={(notes) => setValue({ ...value, notes })}
              />
            )}
          </MSection>
          {kind === 'checklists' && (
            <MSection title="Due Date & Assignment">
              <SToggle
                label="Automatically assign due date"
                value={value.automaticDue !== false}
                onChange={(automaticDue) =>
                  setValue({ ...value, automaticDue })
                }
              />
              {value.automaticDue !== false && (
                <Fields
                  fields={fieldSpecs.filter((f) =>
                    ['offset', 'timeUnit', 'timing', 'dateBasis'].includes(
                      f.key,
                    ),
                  )}
                  value={value}
                  onChange={setValue}
                />
              )}
              {
                <SChoice
                  label="Assign to staff"
                  value={value.assignee || ''}
                  options={staffOptions(data, true)}
                  onChange={(assignee) => setValue({ ...value, assignee })}
                />
              }
              <SToggle
                label={
                  item?.id
                    ? 'Sync changes to matching upcoming bookings'
                    : 'Add this item to matching upcoming bookings'
                }
                value={syncExisting}
                onChange={setSyncExisting}
              />
              <p className="capability-note">
                Checked items stay checked when synchronizing. Package rules
                determine which bookings receive this item.
              </p>
            </MSection>
          )}
          {kind === 'addons' && (
            <AddonPricingFields value={value} onChange={setValue} />
          )}
          {kind === 'backdrops' && (
            <BackdropPricingFields
              value={value}
              onChange={setValue}
              advanced={advanced}
              onAdvancedChange={setAdvanced}
              data={data}
            />
          )}
          {['discounts', 'flex'].includes(kind) && (
            <MSection title="Valid days of week">
              <div className="manage-weekdays">
                {weekdays.map((day, i) => (
                  <SToggle
                    key={day}
                    label={day}
                    value={advanced.days.includes(i)}
                    onChange={(v) =>
                      setAdvanced({
                        ...advanced,
                        days: v
                          ? [...advanced.days, i]
                          : advanced.days.filter((x) => x !== i),
                      })
                    }
                  />
                ))}
              </div>
            </MSection>
          )}
          {kind === 'automations' && (
            <MSection title="Review and conditions">
              <p className="capability-note">
                Draft and review only. Delivery remains off.
              </p>
              {advanced.conditions.map((c, i) => (
                <div className="form-grid" key={i}>
                  <SChoice
                    label="Condition"
                    value={c.field}
                    options={[
                      'Balance',
                      'Deposit',
                      'Tips',
                      'Staff',
                      'Backdrop',
                      'Designs',
                      'Contract',
                      'Questionnaires',
                      'Day of week',
                    ]}
                    onChange={(field) =>
                      setAdvanced({
                        ...advanced,
                        conditions: advanced.conditions.map((x, j) =>
                          i === j ? { ...x, field } : x,
                        ),
                      })
                    }
                  />
                  <SChoice
                    label="Match"
                    value={c.operator}
                    options={['Is', 'Is not']}
                    onChange={(operator) =>
                      setAdvanced({
                        ...advanced,
                        conditions: advanced.conditions.map((x, j) =>
                          i === j ? { ...x, operator } : x,
                        ),
                      })
                    }
                  />
                  <SField
                    label="Value"
                    value={c.value}
                    onChange={(value) =>
                      setAdvanced({
                        ...advanced,
                        conditions: advanced.conditions.map((x, j) =>
                          i === j ? { ...x, value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setAdvanced({
                        ...advanced,
                        conditions: advanced.conditions.filter(
                          (_, j) => i !== j,
                        ),
                      })
                    }
                  >
                    Remove condition
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setAdvanced({
                    ...advanced,
                    conditions: [
                      ...advanced.conditions,
                      { field: 'Balance', operator: 'Is', value: 'Unpaid' },
                    ],
                  })
                }
              >
                Add condition
              </button>
            </MSection>
          )}
          {kind === 'staff' && (
            <p className="capability-note">
              Profiles and assignments are saved here. Staff/customer sign-in
              and invitation delivery are not connected; these roles do not
              grant access to the owner workspace.
            </p>
          )}
          {kind === 'lead_forms' && (
            <MSection title="Lead fields">
              {advanced.leadFields.map((f, i) => (
                <div className="manage-lead-field" key={f.key}>
                  <SField
                    label="Label"
                    value={f.label}
                    onChange={(label) =>
                      setAdvanced({
                        ...advanced,
                        leadFields: advanced.leadFields.map((x) =>
                          x.key === f.key ? { ...x, label } : x,
                        ),
                      })
                    }
                  />
                  <SChoice
                    label={f.label + ' visibility'}
                    value={f.display}
                    options={
                      f.key === 'email'
                        ? ['Required']
                        : ['Required', 'Optional', 'Hidden']
                    }
                    onChange={(display) =>
                      setAdvanced({
                        ...advanced,
                        leadFields: advanced.leadFields.map((x) =>
                          x.key === f.key
                            ? { ...x, display: display as any }
                            : x,
                        ),
                      })
                    }
                  />
                  <SChoice
                    label="Desktop width"
                    value={f.width}
                    options={['50%', '100%']}
                    onChange={(width) =>
                      setAdvanced({
                        ...advanced,
                        leadFields: advanced.leadFields.map((x) =>
                          x.key === f.key ? { ...x, width: width as any } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    disabled={!i}
                    aria-label={'Move ' + f.label + ' up'}
                    onClick={() => {
                      const next = [...advanced.leadFields];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      setAdvanced({ ...advanced, leadFields: next });
                    }}
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              ))}
            </MSection>
          )}
        </>
      )}
      {tab === 'Media & packages' && (
        <>
          <ScopeEditor
            value={advanced}
            onChange={setAdvanced}
            data={data}
            title={kind === 'backdrops' ? 'Visible for Packages' : 'Packages'}
          />
          {kind === 'addons' && (
            <MSection title="Included at no charge with selected packages">
              {data.packages.map((p) => (
                <SToggle
                  key={p.id}
                  label={p.name}
                  value={advanced.includedPackageIds.includes(p.id)}
                  onChange={(v) =>
                    setAdvanced({
                      ...advanced,
                      includedPackageIds: v
                        ? [...advanced.includedPackageIds, p.id]
                        : advanced.includedPackageIds.filter(
                            (id) => id !== p.id,
                          ),
                    })
                  }
                />
              ))}
            </MSection>
          )}
          <MSection
            title={
              kind === 'backdrops'
                ? 'Media — primary image and additional photos'
                : 'Images'
            }
          >
            <MediaPicker
              data={data}
              ids={advanced.images}
              onChange={(images) => setAdvanced({ ...advanced, images })}
            />
          </MSection>
          <MSection title="Videos">
            {advanced.videos.map((v, i) => (
              <div className="form-grid" key={i}>
                <SField
                  label="Video title"
                  value={v.title}
                  onChange={(title) =>
                    setAdvanced({
                      ...advanced,
                      videos: advanced.videos.map((x, j) =>
                        i === j ? { ...x, title } : x,
                      ),
                    })
                  }
                />
                <SField
                  label="Video URL"
                  type="url"
                  value={v.url}
                  onChange={(url) =>
                    setAdvanced({
                      ...advanced,
                      videos: advanced.videos.map((x, j) =>
                        i === j ? { ...x, url } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setAdvanced({
                      ...advanced,
                      videos: advanced.videos.filter((_, j) => j !== i),
                    })
                  }
                >
                  Remove video
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setAdvanced({
                  ...advanced,
                  videos: [...advanced.videos, { title: 'Video', url: '' }],
                })
              }
            >
              Add video
            </button>
          </MSection>
          <MSection title="Attachments">
            <MediaPicker
              documents
              data={data}
              ids={advanced.attachments}
              onChange={(attachments) =>
                setAdvanced({ ...advanced, attachments })
              }
            />
          </MSection>
        </>
      )}
      {tab === 'Fields' && (
        <QuestionnaireBuilder value={advanced} onChange={setAdvanced} />
      )}
      <div className="form-footer">
        <span>Saved to your business workspace.</span>
        <button className="primary" disabled={busy}>
          {busy
            ? 'Saving…'
            : `Save ${kind === 'addons' ? 'add-on' : kind === 'backdrops' ? 'backdrop' : kind === 'categories' ? 'category' : 'changes'}`}
        </button>
      </div>
    </form>
  );
}
