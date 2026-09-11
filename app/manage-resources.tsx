'use client';
import { templateStarters } from '@/lib/manage-starters';
import { Checkbox } from '@/components/ui/checkbox';
import { checklistDueLabel } from '@/lib/checklist-catalog';
import { ChecklistSetup, ChecklistBookingDialog } from './checklist-tools';
import {
  QuestionnaireLibrary,
  QuestionnairePreviewDialog,
  PlanningQuestionnaireStarter,
} from './questionnaire-library';
import { ManageUsage } from './manage-usage';
import { useState } from 'react';
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
import {
  Plus,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
} from 'lucide-react';
import { modules, type Resource, type Settings } from '@/lib/settings';
import {
  details,
  emptyDetails,
  ordered,
  effectiveExtra,
} from '@/lib/manage-config';
import { money, type Data } from '@/lib/crm';
import { SActions, SChoice, SField, SToggle, STable, STabs } from './sales-ui';
import {
  ResourceEditor,
  ScopeEditor,
  MediaPicker,
  MSection,
} from './manage-editors';
import { Fields } from './management';
export type ManageProps = {
  data: Data;
  onData: (d: Data) => void;
  onNavigate: (s: string) => void;
};
export function ManagedResources({
  kind,
  data,
  onData,
  onNavigate,
  onStaff,
  initialResourceId,
}: {
  kind: string;
  onStaff?: (r: Resource, tab: string) => void;
  initialResourceId?: string;
} & ManageProps) {
  const [query, setQuery] = useState(''),
    [visibility, setVisibility] = useState('Active'),
    [subfilter, setSubfilter] = useState('All'),
    [category, setCategory] = useState('all'),
    [emptyCategories, setEmptyCategories] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [view, setView] = useState(kind === 'checklists' ? 'Categories' : 'Cards'),
    [editing, setEditing] = useState<{
      kind: string;
      item?: Resource;
      category?: string;
    } | null>(() => {
      const item = data.resources?.find(
        (r) => r.id === initialResourceId && r.kind === kind && !r.archived,
      );
      return item ? { kind, item } : null;
    }),
    [dialog, setDialog] = useState(''),
    [usage, setUsage] = useState<Resource>(),
    [target, setTarget] = useState<Resource>(),
    [order, setOrder] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [questionnaireLibrary, setQuestionnaireLibrary] = useState(false);
  const [checklistBooking, setChecklistBooking] = useState<{
    category: Resource;
    reset: boolean;
  }>();
  const [questionnairePreview, setQuestionnairePreview] = useState<Resource>();
  const all = data.resources || [],
    records = ordered(all.filter((r) => r.kind === kind)),
    categories = ordered(
      all.filter(
        (r) =>
          r.kind === 'categories' && !r.archived && r.data.ownerKind === kind,
      ),
    );
  const rows = records.filter(
    (r) =>
      (visibility === 'All' ||
        Boolean(r.archived) === (visibility === 'Archived')) &&
      (category === 'all' ||
        r.data.categoryId === category ||
        (category === 'none' && !r.data.categoryId)) &&
      (kind !== 'staff' ||
        subfilter === 'All' ||
        (subfilter === 'Admins'
          ? r.data.adminRole
          : subfilter === 'Customers'
            ? r.data.customerRole
            : r.data.staffRole !== false)) &&
      (kind !== 'messages' ||
        subfilter === 'All' ||
        r.data.category === subfilter) &&
      (kind !== 'discounts' ||
        subfilter === 'All' ||
        (subfilter === 'Expired'
          ? r.data.expires &&
            String(r.data.expires) < new Date().toISOString().slice(0, 10)
          : subfilter === 'Not yet valid'
            ? r.data.starts &&
              String(r.data.starts) > new Date().toISOString().slice(0, 10)
            : data.events.some(
                (e) => e.operations?.quote?.discountId === r.id,
              ))) &&
      `${r.name} ${r.data.description || ''} ${r.data.searchText || ''} ${r.data.code || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const grouped = ['addons', 'backdrops', 'designs', 'checklists'].includes(
      kind,
    ),
    label = modules[kind].label;
  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        j = (await r.json()) as Data & { error?: string };
      if (!r.ok) throw Error(j.error);
      onData(j);
      setNotice('Changes saved.');
      setDialog('');
      setEditing(null);
      setSelected([]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const newItem = (selectedCategory = '') => {
    setError('');
    if (kind === 'questionnaires') {
      setQuestionnaireLibrary(true);
      return;
    }
    setEditing({
      kind,
      category:
        selectedCategory ||
        (kind === 'checklists' && categories.some((c) => c.id === category)
          ? category
          : ''),
    });
  };
  const actions = (r: Resource) => [
    ...(r.kind === 'staff' && !r.archived && onStaff
      ? [
          { label: 'Show user', action: () => onStaff(r, 'Overview') },
          {
            label: 'Staff Booking Availability',
            action: () => onStaff(r, 'Staff Booking Availability'),
          },
          {
            label: 'Appointment Scheduling',
            action: () => onStaff(r, 'Appointment Scheduling'),
          },
          { label: 'Show schedule', action: () => onStaff(r, 'Schedule') },
        ]
      : []),
    ...(r.kind === 'categories' && r.data.ownerKind === 'checklists'
      ? [
          { label: 'New item', action: () => newItem(r.id) },
          {
            label: 'Set packages for all items',
            action: () => {
              setSelected(
                records
                  .filter((x) => x.data.categoryId === r.id)
                  .map((x) => x.id),
              );
              setDialog('scope');
            },
          },
          {
            label: 'Apply / synchronize bookings',
            action: () => {
              setError('');
              setChecklistBooking({ category: r, reset: false });
            },
          },
          {
            label: 'Reset booking checklists',
            action: () => {
              setError('');
              setChecklistBooking({ category: r, reset: true });
            },
          },
        ]
      : []),
    ...(r.kind === 'questionnaires'
      ? [
          {
            label: 'Preview questionnaire',
            action: () => setQuestionnairePreview(r),
          },
        ]
      : []),
    ...([
      'messages',
      'automations',
      'questionnaires',
      'checklists',
      'contracts',
    ].includes(r.kind)
      ? [
          {
            label: ['messages', 'automations'].includes(r.kind)
              ? 'Preview & prepare drafts'
              : 'Apply / synchronize template',
            action: () => setUsage(r),
          },
        ]
      : []),
    {
      label:
        r.kind === 'categories'
          ? r.data.ownerKind === 'checklists'
            ? 'Edit settings'
            : 'Edit category'
          : 'Edit',
      action: () => {
        setError('');
        setEditing({ kind: r.kind, item: r });
      },
    },
    {
      label: r.kind === 'categories' ? 'Duplicate category' : 'Duplicate',
      action: () =>
        void run({
          action:
            r.kind === 'categories'
              ? 'duplicate_category'
              : 'duplicate_resource',
          id: r.id,
        }),
    },
    {
      label: r.archived ? 'Restore' : 'Archive',
      action: () =>
        void run({
          action: 'archive_resource',
          id: r.id,
          archived: !r.archived,
        }),
    },
    {
      label: 'Delete',
      action: () => {
        setTarget(r);
        setDialog('delete');
      },
    },
    ...(r.kind === 'categories'
      ? [
          {
            label: 'Reorder items',
            action: () => {
              setTarget(r);
              setOrder(
                ordered(records.filter((x) => x.data.categoryId === r.id)).map(
                  (x) => x.id,
                ),
              );
              setDialog('order');
            },
          },
        ]
      : []),
  ];
  const card = (r: Resource) => (
    <article className="manage-resource-card" key={r.id}>
      <div className="manage-card-heading">
        <SToggle
          label={r.name}
          value={selected.includes(r.id)}
          onChange={(v) =>
            setSelected(
              v ? [...selected, r.id] : selected.filter((id) => id !== r.id),
            )
          }
        />
        <SActions label={`Actions for ${r.name}`} items={actions(r)} />
      </div>
      {details(r).images[0] ? (
        <img
          className="manage-card-image"
          src={'/api/media?id=' + details(r).images[0]}
          alt={r.name}
        />
      ) : (
        ['addons', 'backdrops', 'designs', 'staff', 'venues'].includes(
          kind,
        ) && (
          <div className="manage-no-image">
            <ImageIcon size={30} />
            <span>No image added</span>
          </div>
        )
      )}
      <div className="manage-card-body">
        {['addons', 'backdrops'].includes(kind) && (
          <b>
            {money(Number(effectiveExtra(r, all).data.price || 0) * 100)}
            {r.data.pricingMethod === 'Multiply by package hours'
              ? ' / package hour'
              : r.data.pricingMethod === 'Multiply by package days'
                ? ' / package day'
                : ''}
          </b>
        )}
        {kind === 'checklists' && (
          <p className="checklist-due">{checklistDueLabel(r)}</p>
        )}
        <p>
          {String(
            r.data.description ||
              r.data.subject ||
              r.data.body ||
              r.data.bio ||
              r.data.notes ||
              '',
          ).slice(0, 180)}
        </p>
        <small>
          {details(r).packageMode === 'all'
            ? 'All packages'
            : details(r).packageMode === 'none'
              ? 'No packages'
              : `${details(r).packageIds.length} selected packages`}
          {r.archived ? ' · Archived' : ''}
        </small>
        {kind === 'automations' && (
          <span className="status proposal">Draft · review only</span>
        )}
        {kind === 'staff' && !r.archived && onStaff && (
          <button
            type="button"
            className="primary"
            onClick={() => onStaff(r, 'Overview')}
          >
            View profile & scheduling
          </button>
        )}
        <button
          type="button"
          className="secondary"
          onClick={() => setEditing({ kind, item: r })}
        >
          Edit{' '}
          {kind === 'addons'
            ? 'add-on'
            : kind === 'backdrops'
              ? 'backdrop'
              : kind === 'designs'
                ? 'design'
                : 'record'}
        </button>
      </div>
    </article>
  );
  if (kind === 'checklists' && !all.some((r) => r.kind === 'checklist_setup'))
    return <ChecklistSetup onData={onData} />;
  return (
    <section className="panel manage-workspace">
      <div className="panel-heading">
        <div>
          <h2>{label}</h2>
          <p className="muted">{modules[kind].description}</p>
        </div>
        <div className="sales-actions">
          <DropdownMenu>
            <DropdownMenuTrigger className="primary">
              <Plus size={17} /> New <ChevronDown size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => newItem()}>
                New{' '}
                {kind === 'addons'
                  ? 'add-on'
                  : kind === 'backdrops'
                    ? 'backdrop'
                    : kind === 'designs'
                      ? 'design template'
                      : kind === 'checklists'
                        ? 'checklist item'
                        : 'record'}
              </DropdownMenuItem>
              {grouped && (
                <DropdownMenuItem
                  onClick={() =>
                    setEditing({
                      kind: 'categories',
                      item: {
                        id: '',
                        kind: 'categories',
                        name: '',
                        archived: 0,
                        data: { ownerKind: kind },
                      },
                    })
                  }
                >
                  New {kind === 'designs' ? 'collection' : 'category'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className="secondary"
            onClick={() => {
              setView('List');
              setDialog('bulk');
            }}
            disabled={!records.length}
          >
            Bulk edit{selected.length ? ` (${selected.length})` : ''}
          </button>
          <button
            className="secondary"
            onClick={() => {
              setTarget(undefined);
              setOrder((grouped ? categories : records).map((r) => r.id));
              setDialog('order');
            }}
          >
            Reorder {grouped ? 'categories' : 'records'}
          </button>
        </div>
      </div>
      {kind === 'checklists' && (
        <>
          <div
            className="checklist-category-tabs"
            aria-label="Checklist categories"
          >
            {[{ id: 'all', name: 'All checklists' }, ...categories].map((c) => (
              <button
                key={c.id}
                className={category === c.id ? 'primary' : 'secondary'}
                aria-pressed={category === c.id}
                onClick={() => {
                  setCategory(c.id);
                  setSelected([]);
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
          <p className="capability-note">
            Choose which packages each item applies to. Matching checklist items
            are added when you confirm a booking. Use a category’s menu to
            update existing bookings.
          </p>
        </>
      )}
      {kind === 'questionnaires' && (
        <>
          <div className="questionnaire-library-actions">
            <button className="primary" onClick={() => newItem()}>
              New Questionnaire Template
            </button>
            <button
              className="secondary"
              onClick={() => setQuestionnaireLibrary(true)}
            >
              Browse questionnaire samples
            </button>
            <button
              className="secondary"
              onClick={() => onNavigate('Song lists')}
            >
              Song lists
            </button>
          </div>
          {!records.some(
            (r) =>
              !r.archived &&
              r.name.trim().toLowerCase() === 'planning questionnaire',
          ) && (
            <PlanningQuestionnaireStarter
              onPreview={setQuestionnairePreview}
              onUse={(item) => {
                setError('');
                setEditing({ kind: 'questionnaires', item });
              }}
            />
          )}
          <p className="capability-note">
            Customize and save a sample to make it one of your templates. Choose
            its packages under Media &amp; packages, then use Apply /
            synchronize template to add it to bookings.
          </p>
        </>
      )}
      {['messages', 'automations'].includes(kind) && (
        <p className="capability-note">
          Message drafts and review are available. Sending remains off until
          delivery is connected.
        </p>
      )}
      {templateStarters[kind] &&
        !['questionnaires', 'checklists'].includes(kind) && (
          <details>
            <summary>Browse starter templates</summary>
            <div className="manage-cards">
              {templateStarters[kind].map((s) => (
                <button
                  key={s.name}
                  className="secondary"
                  onClick={() =>
                    setEditing({
                      kind,
                      item: {
                        id: '',
                        kind,
                        name: s.name,
                        archived: 0,
                        data: s.data,
                      },
                    })
                  }
                >
                  Use {s.name}
                </button>
              ))}
            </div>
          </details>
        )}
      <div className="manage-toolbar">
        <SField label="Search" value={query} onChange={setQuery} />
        <SChoice
          label="Show records"
          value={visibility}
          onChange={setVisibility}
          options={['Active', 'Archived', 'All']}
        />
        {grouped && (
          <SChoice
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: 'All categories' },
              { value: 'none', label: 'Uncategorized' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        )}
        {['staff', 'messages', 'discounts'].includes(kind) && (
          <SChoice
            label={
              kind === 'staff'
                ? 'User roles'
                : kind === 'messages'
                  ? 'Template category'
                  : 'Discount status'
            }
            value={subfilter}
            onChange={setSubfilter}
            options={
              kind === 'staff'
                ? ['All', 'Staff', 'Admins', 'Customers']
                : kind === 'messages'
                  ? ['All', 'Bookings', 'Proposals', 'Leads', 'Appointments']
                  : ['All', 'Expired', 'Not yet valid', 'Redeemed']
            }
          />
        )}
        <STabs
          value={view}
          tabs={[kind === 'checklists' ? 'Categories' : 'Cards', 'List']}
          onChange={setView}
        />
      </div>
      {grouped && kind !== 'checklists' && (
        <SToggle
          label="Show empty categories"
          value={emptyCategories}
          onChange={setEmptyCategories}
        />
      )}
      <SToggle
        label={`Select all ${rows.length} visible records`}
        value={rows.length > 0 && rows.every((r) => selected.includes(r.id))}
        onChange={(v) =>
          setSelected(
            v
              ? [...new Set([...selected, ...rows.map((r) => r.id)])]
              : selected.filter((id) => !rows.some((r) => r.id === id)),
          )
        }
      />
      {error && !editing && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {view === 'List' ? (
        <STable
          headers={[
            'Select',
            'Name',
            'Price / details',
            'Category',
            'Status',
            'Actions',
          ]}
          rows={rows.map((r) => [
            <SToggle
              label={'Select ' + r.name}
              value={selected.includes(r.id)}
              onChange={(v) =>
                setSelected(
                  v
                    ? [...selected, r.id]
                    : selected.filter((id) => id !== r.id),
                )
              }
            />,
            <button
              className="text-button"
              onClick={() => setEditing({ kind, item: r })}
            >
              {r.name}
            </button>,
            ['addons', 'backdrops'].includes(kind)
              ? `${money(Number(effectiveExtra(r, all).data.price || 0) * 100)} · max qty ${r.data.maxQuantity || 1}`
              : String(r.data.subject || r.data.code || r.data.planType || ''),
            categories.find((c) => c.id === r.data.categoryId)?.name || '—',
            r.archived ? 'Archived' : 'Active',
            <SActions label={'Actions for ' + r.name} items={actions(r)} />,
          ])}
        />
      ) : grouped ? (
        <>
          {[{ id: '', name: 'Uncategorized' }, ...categories]
            .filter(
              (c) =>
                category === 'all' ||
                category === c.id ||
                (category === 'none' && !c.id),
            )
            .map((c) => {
              const group = rows.filter(
                (r) =>
                  (categories.some((c) => c.id === r.data.categoryId)
                    ? r.data.categoryId
                    : '') === c.id,
              );
              if (
                !emptyCategories &&
                !group.length &&
                !(kind === 'checklists' && c.id)
              )
                return null;
              return (
                <section className="manage-category" key={c.id}>
                  <div className="panel-heading">
                    <h3>
                      {c.name} <small>{group.length} items</small>
                    </h3>
                    {c.id && (
                      <SActions
                        label={'Actions for category ' + c.name}
                        items={actions(c as Resource)}
                      />
                    )}
                  </div>
                  {kind === 'checklists' ? (
                    <div className="checklist-items">
                      {group.map((r) => (
                        <div key={r.id} className="checklist-template-row">
                          <Checkbox
                            aria-label={'Select ' + r.name}
                            checked={selected.includes(r.id)}
                            onCheckedChange={(v) =>
                              setSelected(
                                v === true
                                  ? [...selected, r.id]
                                  : selected.filter((id) => id !== r.id),
                              )
                            }
                          />
                          <div>
                            <button
                              className="text-button"
                              onClick={() => setEditing({ kind, item: r })}
                            >
                              {r.name}
                            </button>
                            <p>{checklistDueLabel(r)}</p>
                            <small>
                              {details(r).packageMode === 'all'
                                ? 'All packages'
                                : details(r).packageMode === 'none'
                                  ? 'No packages selected'
                                  : `${details(r).packageIds.length} selected packages`}
                              {r.data.assignee
                                ? ' · ' +
                                  (r.data.assignee === 'owner'
                                    ? 'Business owner'
                                    : all.find((s) => s.id === r.data.assignee)
                                        ?.name || 'Assigned staff')
                                : ''}
                            </small>
                          </div>
                          <SActions
                            label={'Actions for ' + r.name}
                            items={actions(r)}
                          />
                        </div>
                      ))}
                      <button
                        className="secondary"
                        onClick={() => newItem(c.id)}
                      >
                        <Plus size={16} /> Add New Item
                      </button>
                    </div>
                  ) : (
                    <div className="manage-cards">
                      {group.map(card)}
                      <button
                        className="manage-add-card"
                        onClick={() => newItem(c.id)}
                      >
                        <Plus />
                        Add{' '}
                        {kind === 'backdrops'
                          ? 'backdrop'
                          : kind === 'designs'
                            ? 'design'
                            : 'item'}
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
        </>
      ) : (
        <div className="manage-cards">{rows.map(card)}</div>
      )}
      {!rows.length && (
        <div className="padded muted">
          No matching records. Use New to add your first {label.toLowerCase()}.
        </div>
      )}
      {usage && (
        <ManageUsage
          resource={usage}
          data={data}
          onData={onData}
          onClose={() => setUsage(undefined)}
        />
      )}
      {checklistBooking && (
        <ChecklistBookingDialog
          category={checklistBooking.category}
          reset={checklistBooking.reset}
          data={data}
          busy={busy}
          error={error}
          onSubmit={run}
          onClose={() => setChecklistBooking(undefined)}
        />
      )}
      {questionnaireLibrary && (
        <QuestionnaireLibrary
          onClose={() => setQuestionnaireLibrary(false)}
          onUse={(item) => {
            setQuestionnaireLibrary(false);
            setError('');
            setEditing({ kind: 'questionnaires', item });
          }}
          onCreate={(name) => {
            setQuestionnaireLibrary(false);
            setError('');
            setEditing({
              kind: 'questionnaires',
              item: {
                id: '',
                kind: 'questionnaires',
                name,
                archived: 0,
                data: {},
              },
            });
          }}
        />
      )}
      {questionnairePreview && (
        <QuestionnairePreviewDialog
          resource={questionnairePreview}
          onClose={() => setQuestionnairePreview(undefined)}
        />
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(v) => !busy && !v && setEditing(null)}
      >
        <DialogContent className="crm-dialog manage-editor-dialog">
          <DialogHeader>
            <DialogTitle>
              {editing?.item?.id ? 'Edit' : 'New'}{' '}
              {editing?.kind === 'categories'
                ? 'category'
                : editing?.kind === 'addons'
                  ? 'add-on'
                  : editing?.kind === 'backdrops'
                    ? 'backdrop'
                    : editing?.kind === 'questionnaires'
                      ? 'Questionnaire Template'
                      : editing?.kind === 'checklists'
                        ? 'Checklist Item'
                        : label.toLowerCase()}
            </DialogTitle>
            <DialogDescription>
              Configure the record and its advanced settings.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {editing && (
            <ResourceEditor
              key={editing.kind + (editing.item?.id || 'new')}
              kind={editing.kind}
              item={editing.item}
              data={data}
              defaultCategory={editing.category}
              busy={busy}
              onSubmit={run}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!dialog}
        onOpenChange={(v) => !busy && !v && setDialog('')}
      >
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>
              {dialog === 'delete'
                ? 'Delete ' + target?.name
                : dialog === 'order'
                  ? 'Reorder records'
                  : 'Bulk edit ' + label.toLowerCase()}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'delete'
                ? kind === 'checklists'
                  ? target?.kind === 'categories'
                    ? 'Delete this category and its template items. Existing booking checklists are retained.'
                    : 'Delete this template item. Existing booking checklists are retained.'
                  : 'This removes the selected record from the catalog. Existing quote snapshots remain unchanged.'
                : 'Review and save your changes.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {dialog === 'delete' ? (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(
                  target?.kind === 'categories' &&
                    target.data.ownerKind === 'checklists'
                    ? {
                        action: 'bulk_resources',
                        ids: [
                          ...all
                            .filter(
                              (r) =>
                                r.kind === 'checklists' &&
                                r.data.categoryId === target.id,
                            )
                            .map((r) => r.id),
                          target.id,
                        ],
                        operation: 'delete',
                      }
                    : { action: 'delete_resource', id: target?.id },
                )
              }
            >
              Delete record
            </button>
          ) : dialog === 'order' ? (
            <>
              <div className="form-stack">
                {order.map((id, i) => (
                  <div className="manage-order-row" key={id}>
                    <span>{all.find((r) => r.id === id)?.name}</span>
                    <button
                      className="icon-button"
                      disabled={i === 0}
                      aria-label="Move up"
                      onClick={() => {
                        const next = [...order];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        setOrder(next);
                      }}
                    >
                      <ArrowUp size={17} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={i === order.length - 1}
                      aria-label="Move down"
                      onClick={() => {
                        const next = [...order];
                        [next[i], next[i + 1]] = [next[i + 1], next[i]];
                        setOrder(next);
                      }}
                    >
                      <ArrowDown size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="primary"
                disabled={busy || !order.length}
                onClick={() =>
                  void run({ action: 'reorder_resources', ids: order })
                }
              >
                Save order
              </button>
            </>
          ) : (
            <BulkEditor
              initialAction={
                dialog === 'scope' ? 'Set associated packages' : undefined
              }
              kind={kind}
              selected={selected}
              onSelect={setSelected}
              records={rows}
              data={data}
              run={run}
              busy={busy}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
function BulkEditor({
  initialAction,
  kind,
  selected,
  onSelect,
  records,
  data,
  run,
  busy,
}: {
  initialAction?: string;
  kind: string;
  selected: string[];
  onSelect: (s: string[]) => void;
  records: Resource[];
  data: Data;
  run: (b: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
}) {
  const hasPricing = modules[kind].fields.some((f) =>
    ['price', 'amount'].includes(f.key),
  );
  const [action, setAction] = useState(
      initialAction || (hasPricing ? 'Pricing & quantity' : 'Advanced options'),
    ),
    [chosen, setChosen] = useState<string[]>([]),
    [value, setValue] = useState<Settings>({}),
    [scope, setScope] = useState(emptyDetails()),
    [category, setCategory] = useState(''),
    [confirm, setConfirm] = useState(false);
  const categories = (data.resources || []).filter(
    (r) => r.kind === 'categories' && !r.archived && r.data.ownerKind === kind,
  );
  const fields = modules[kind].fields.filter((f) =>
    action === 'Pricing & quantity'
      ? ['price', 'pricingMethod', 'maxQuantity', 'amount', 'mode'].includes(
          f.key,
        )
      : !['body', 'subject', 'description', 'code'].includes(f.key),
  );
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected.length) return;
        const patch: Record<string, unknown> =
          action === 'Move to category'
            ? { categoryId: category }
            : action === 'Set associated packages'
              ? {
                  scope: {
                    packageMode: scope.packageMode,
                    packageIds: scope.packageIds,
                  },
                }
              : Object.fromEntries(
                  chosen.map((k) => [
                    k,
                    value[k] ?? fields.find((f) => f.key === k)?.default ?? 0,
                  ]),
                );
        void run({
          action: 'bulk_resources',
          kind,
          ids: selected,
          operation:
            action === 'Archive'
              ? 'archive'
              : action === 'Restore'
                ? 'restore'
                : action === 'Delete'
                  ? 'delete'
                  : 'update',
          patch,
        });
      }}
    >
      <MSection title={`${selected.length} records selected`}>
        <SToggle
          label="Select all visible records"
          value={
            records.length > 0 && records.every((r) => selected.includes(r.id))
          }
          onChange={(v) => onSelect(v ? records.map((r) => r.id) : [])}
        />
        <div className="manage-choice-list">
          {records.map((r) => (
            <SToggle
              key={r.id}
              label={r.name}
              value={selected.includes(r.id)}
              onChange={(v) =>
                onSelect(
                  v
                    ? [...selected, r.id]
                    : selected.filter((id) => id !== r.id),
                )
              }
            />
          ))}
        </div>
      </MSection>
      <SChoice
        label="Action"
        value={action}
        onChange={(v) => {
          setAction(v);
          setChosen([]);
          setConfirm(false);
        }}
        options={[
          ...(hasPricing ? ['Pricing & quantity'] : []),
          ...(['addons', 'backdrops', 'designs', 'checklists'].includes(kind)
            ? ['Move to category']
            : []),
          'Set associated packages',
          'Advanced options',
          'Archive',
          'Restore',
          'Delete',
        ]}
      />
      {action === 'Move to category' ? (
        <SChoice
          label="Destination category"
          value={category}
          onChange={setCategory}
          options={[
            { value: '', label: 'Uncategorized' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      ) : action === 'Set associated packages' ? (
        <ScopeEditor data={data} value={scope} onChange={setScope} />
      ) : ['Pricing & quantity', 'Advanced options'].includes(action) ? (
        fields.map((f) => (
          <div key={f.key}>
            <SToggle
              label={'Change ' + f.label}
              value={chosen.includes(f.key)}
              onChange={(v) =>
                setChosen(
                  v ? [...chosen, f.key] : chosen.filter((k) => k !== f.key),
                )
              }
            />
            {chosen.includes(f.key) && (
              <Fields fields={[f]} value={value} onChange={setValue} />
            )}
          </div>
        ))
      ) : action === 'Delete' ? (
        <SToggle
          label="Delete the selected catalog records"
          value={confirm}
          onChange={setConfirm}
        />
      ) : null}
      <button
        className="primary"
        disabled={
          busy ||
          !selected.length ||
          (action === 'Delete' && !confirm) ||
          (['Pricing & quantity', 'Advanced options'].includes(action) &&
            !chosen.length)
        }
      >
        Update selected records
      </button>
    </form>
  );
}
export function MediaLibrary({
  data,
  onData,
}: {
  data: Data;
  onData: (d: Data) => void;
}) {
  const [ids, setIds] = useState<string[]>([]),
    [error, setError] = useState('');
  async function reload() {
    const r = await fetch('/api/crm');
    if (r.ok) onData(await r.json());
  }
  return (
    <section className="panel">
      <h2>Media library</h2>
      <p className="muted">
        Images and documents available to the records in your business.
      </p>
      <MediaPicker
        documents
        data={data}
        ids={ids}
        onChange={(v) => {
          setIds(v);
          void reload();
        }}
      />
      {error && <p className="error">{error}</p>}
      <div className="manage-media-grid">
        {(data.resources || [])
          .filter((r) => r.kind === 'media' && !r.archived)
          .map((r) => (
            <article key={r.id}>
              {String(r.data.mime).startsWith('image/') && (
                <img src={'/api/media?id=' + r.id} alt={r.name} />
              )}
              <a
                href={'/api/media?id=' + r.id}
                target="_blank"
                rel="noreferrer"
              >
                {r.name}
              </a>
              <small>{Math.ceil(Number(r.data.size) / 1024)} KB</small>
              <button
                className="secondary"
                onClick={async () => {
                  const res = await fetch('/api/media?id=' + r.id, {
                    method: 'DELETE',
                  });
                  if (!res.ok)
                    setError(((await res.json()) as { error: string }).error);
                  else await reload();
                }}
              >
                Remove from library
              </button>
            </article>
          ))}
      </div>
    </section>
  );
}
