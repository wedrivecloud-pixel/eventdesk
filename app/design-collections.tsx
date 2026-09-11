'use client';
import { DesignPreview } from './design-preview';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Image as ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SActions, SChoice, SField, STabs, STable, SToggle } from './sales-ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MediaPicker, MSection, ScopeEditor } from './manage-editors';
import { QuestionInput } from './question-input';
import type { ManageProps } from './manage-resources';
import type { Resource } from '@/lib/settings';
import {
  details,
  emptyDetails,
  ordered,
  type FormField,
} from '@/lib/manage-config';
import {
  collectionTemplates,
  designCollections,
  designSyncChange,
  designIds,
  designQuestion,
  designQuestionTypes,
  designTabs,
  layoutPresets,
} from '@/lib/design-collections';
import { localToday } from '@/lib/manage-pricing';

export { DesignPreview } from './design-preview';
const scopeLabel = (r: Resource) =>
  details(r).packageMode === 'all'
    ? 'All packages'
    : details(r).packageMode === 'none'
      ? 'No packages'
      : `${details(r).packageIds.length} selected packages`;
type Run = (body: Record<string, unknown>) => Promise<boolean>;

export function DesignCollections(props: ManageProps) {
  const { data, onData } = props,
    resources = data.resources || [];
  const [collectionId, setCollectionId] = useState(''),
    [tab, setTab] = useState('View Templates');
  const [query, setQuery] = useState(''),
    [tag, setTag] = useState('all'),
    [layout, setLayout] = useState('all'),
    [view, setView] = useState('Cards');
  const [selected, setSelected] = useState<string[]>([]),
    [dialog, setDialog] = useState(''),
    [target, setTarget] = useState<Resource>();
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  const ready = resources.some(
    (r) => r.id === `design:${data.business?.id}:initialized`,
  );
  const collections = designCollections(resources),
    collection = collections.find((c) => c.id === collectionId);
  const ungrouped: Resource = {
    id: '',
    kind: 'categories',
    name: 'Uncategorized designs',
    archived: 0,
    data: { ownerKind: 'designs' },
  };
  const activeCollection = collection || ungrouped;
  const templates = collection
    ? collectionTemplates(resources, collection)
    : ordered(
        resources.filter(
          (r) => r.kind === 'designs' && !r.data.categoryId && !r.archived,
        ),
      );
  const tags = ordered(
    resources.filter(
      (r) =>
        r.kind === 'design_tags' &&
        r.data.categoryId === collectionId &&
        !r.archived,
    ),
  );
  const layouts = ordered(
    resources.filter(
      (r) =>
        r.kind === 'design_layouts' &&
        r.data.categoryId === collectionId &&
        !r.archived,
    ),
  );
  const rows = templates.filter(
    (r) =>
      `${r.name} ${r.data.description || ''} ${r.data.searchText || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (tag === 'all' || designIds(r, 'tagIds').includes(tag)) &&
      (layout === 'all' || designIds(r, 'layoutIds').includes(layout)),
  );
  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as ManageProps['data'] & { error?: string };
      if (!res.ok) throw Error(j.error);
      onData(j);
      setDialog('');
      setSelected([]);
      setNotice('Changes saved.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!ready) void run({ action: 'initialize_designs' });
  }, [ready, retry]); // Initialization runs once per business and never overwrites edited collections.
  const openCollection = (id: string, nextTab = 'View Templates') => {
    setCollectionId(id);
    setTab(nextTab);
    setQuery('');
    setTag('all');
    setLayout('all');
    setSelected([]);
    setError('');
    setNotice('');
  };
  const edit = (r: Resource | undefined, type: string) => {
    setTarget(r);
    setDialog(type);
    setError('');
  };
  const move = (items: Resource[], id: string, delta: number) => {
    const ids = items.map((r) => r.id),
      i = ids.indexOf(id),
      j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void run({ action: 'reorder_resources', ids });
  };
  const templateActions = (r: Resource) => [
    { label: 'Edit Template', action: () => edit(r, 'template') },
    {
      label: 'Duplicate Template',
      action: () => void run({ action: 'duplicate_resource', id: r.id }),
    },
    { label: 'Delete Template', action: () => edit(r, 'delete-template') },
  ];
  if (!ready)
    return (
      <section className="panel">
        <h2>Design Collections</h2>
        <p>
          {busy
            ? 'Loading Layout Options…'
            : 'Preparing your design collection.'}
        </p>
        {error && (
          <>
            <p role="alert" className="error">
              {error}
            </p>
            <button className="secondary" onClick={() => setRetry(retry + 1)}>
              Try again
            </button>
          </>
        )}
      </section>
    );
  return (
    <section className="panel design-manager">
      <div className="sales-heading">
        <div>
          {collectionId && (
            <button className="text-button" onClick={() => openCollection('')}>
              ← All Design Collections
            </button>
          )}
          <h2>{collectionId ? activeCollection.name : 'Design Collections'}</h2>
        </div>
        <div className="sales-actions">
          {!collectionId && (
            <button
              className="primary"
              onClick={() => edit(undefined, 'collection')}
            >
              New Design Collection
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {!collectionId ? (
        <div className="design-collection-grid">
          {collections.map((c) => (
            <article className="design-collection-card" key={c.id}>
              <button
                className="design-collection-cover"
                onClick={() => openCollection(c.id)}
                aria-label={'View ' + c.name}
              >
                {details(c).images.length ? (
                  <DesignPreview item={c} />
                ) : (
                  <div className="design-miniatures">
                    {collectionTemplates(resources, c)
                      .slice(0, 3)
                      .map((r) => (
                        <DesignPreview item={r} key={r.id} />
                      ))}
                  </div>
                )}
              </button>
              <h3>{c.name}</h3>
              <p>
                {collectionTemplates(resources, c).length} templates ·{' '}
                {scopeLabel(c)}
              </p>
              <div className="sales-actions">
                <button
                  className="secondary"
                  onClick={() => openCollection(c.id)}
                >
                  View Templates
                </button>
                <SActions
                  label={'Actions for ' + c.name}
                  items={[
                    ...designTabs.slice(1).map((t) => ({
                      label: t,
                      action: () => openCollection(c.id, t),
                    })),
                    {
                      label: 'Duplicate Collection',
                      action: () =>
                        void run({
                          action: 'duplicate_design_collection',
                          collectionId: c.id,
                        }),
                    },
                    {
                      label: 'Delete Collection',
                      action: () => edit(c, 'delete-collection'),
                    },
                  ]}
                />
              </div>
            </article>
          ))}
          {templates.length > 0 && (
            <article className="design-collection-card">
              <h3>Uncategorized designs</h3>
              <p>{templates.length} templates</p>
              <button
                className="secondary"
                onClick={() => openCollection('uncategorized')}
              >
                View Templates
              </button>
            </article>
          )}
        </div>
      ) : (
        <>
          {collection && (
            <STabs
              tabs={designTabs}
              value={tab}
              onChange={(t) => {
                setTab(t);
                setSelected([]);
                setError('');
                setNotice('');
              }}
            />
          )}
          {tab === 'View Templates' && (
            <>
              <div className="sales-actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => edit(undefined, 'template')}
                >
                  New Template
                </button>
                {collection && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="secondary">
                      Bulk Actions ▾
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => edit(undefined, 'upload')}
                      >
                        Bulk Upload
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setView('List')}>
                        Bulk Edit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <STabs
                  tabs={['Cards', 'List']}
                  value={view}
                  onChange={setView}
                />
              </div>
              <div className="design-filters">
                <SField
                  label="Search templates"
                  value={query}
                  onChange={setQuery}
                />
                <SChoice
                  label="Category"
                  value={tag}
                  options={[
                    { value: 'all', label: 'All categories' },
                    ...tags.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                  onChange={setTag}
                />
                <SChoice
                  label="Layout"
                  value={layout}
                  options={[
                    { value: 'all', label: 'All layouts' },
                    ...layouts.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                  onChange={setLayout}
                />
              </div>
              {collection && (
                <div className="sales-actions">
                  <SToggle
                    label={`Select all ${rows.length} visible templates`}
                    value={
                      !!rows.length &&
                      rows.every((r) => selected.includes(r.id))
                    }
                    onChange={(v) =>
                      setSelected(v ? rows.map((r) => r.id) : [])
                    }
                  />
                  <button
                    className="secondary"
                    disabled={!selected.length || busy}
                    onClick={() => setDialog('bulk')}
                  >
                    Edit selected designs ({selected.length})
                  </button>
                </div>
              )}
              {view === 'Cards' ? (
                <div className="design-template-grid">
                  {rows.map((r) => (
                    <article className="design-template-card" key={r.id}>
                      <button
                        className="design-open"
                        onClick={() => edit(r, 'template')}
                        aria-label={'Edit ' + r.name}
                      >
                        <DesignPreview item={r} />
                      </button>
                      <h3>{r.name}</h3>
                      <small>{scopeLabel(r)}</small>
                      <div className="sales-actions">
                        {collection && (
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
                          />
                        )}
                        <SActions
                          label={'Actions for ' + r.name}
                          items={templateActions(r)}
                        />
                      </div>
                      <div className="sales-actions">
                        <button
                          className="icon-button"
                          aria-label={'Move ' + r.name + ' up'}
                          onClick={() => move(templates, r.id, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={'Move ' + r.name + ' down'}
                          onClick={() => move(templates, r.id, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <STable
                  headers={[
                    'Select',
                    'Preview',
                    'Name',
                    'Categories',
                    'Layouts',
                    'Packages',
                    'Actions',
                  ]}
                  rows={rows.map((r) => [
                    <SToggle
                      key={r.id}
                      label={r.name}
                      value={selected.includes(r.id)}
                      onChange={(v) =>
                        setSelected(
                          v
                            ? [...selected, r.id]
                            : selected.filter((id) => id !== r.id),
                        )
                      }
                    />,
                    <div className="design-table-preview" key="preview">
                      <DesignPreview item={r} />
                    </div>,
                    r.name,
                    designIds(r, 'tagIds')
                      .map((id) => tags.find((t) => t.id === id)?.name)
                      .filter(Boolean)
                      .join(', ') || 'None',
                    designIds(r, 'layoutIds')
                      .map((id) => layouts.find((t) => t.id === id)?.name)
                      .filter(Boolean)
                      .join(', ') || 'None',
                    scopeLabel(r),
                    <SActions
                      key="actions"
                      label={'Actions for ' + r.name}
                      items={templateActions(r)}
                    />,
                  ])}
                />
              )}
              {!rows.length && (
                <p className="muted">No templates match these filters.</p>
              )}
            </>
          )}
          {collection && tab === 'Settings' && (
            <CollectionSettings
              key={collection.id}
              collection={collection}
              {...props}
              run={run}
              busy={busy}
            />
          )}
          {collection && ['Categories', 'Layouts'].includes(tab) && (
            <>
              <div className="sales-actions">
                <button
                  className="primary"
                  onClick={() =>
                    edit(undefined, tab === 'Categories' ? 'tag' : 'layout')
                  }
                >
                  Add {tab === 'Categories' ? 'Category' : 'Layout'}
                </button>
              </div>
              <STable
                headers={['Name', 'Templates', 'Order', 'Actions']}
                rows={(tab === 'Categories' ? tags : layouts).map((r) => [
                  r.name,
                  templates.filter((t) =>
                    designIds(
                      t,
                      tab === 'Categories' ? 'tagIds' : 'layoutIds',
                    ).includes(r.id),
                  ).length,
                  <div key="order" className="sales-actions">
                    <button
                      className="icon-button"
                      aria-label={'Move ' + r.name + ' up'}
                      onClick={() =>
                        move(tab === 'Categories' ? tags : layouts, r.id, -1)
                      }
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={'Move ' + r.name + ' down'}
                      onClick={() =>
                        move(tab === 'Categories' ? tags : layouts, r.id, 1)
                      }
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>,
                  <SActions
                    key="actions"
                    label={'Actions for ' + r.name}
                    items={[
                      {
                        label: 'Edit',
                        action: () =>
                          edit(r, tab === 'Categories' ? 'tag' : 'layout'),
                      },
                      {
                        label: 'Delete',
                        action: () => edit(r, 'delete-filter'),
                      },
                    ]}
                  />,
                ])}
              />
            </>
          )}
          {collection && tab === 'Extra Questions' && (
            <DesignQuestions
              key={collection.id}
              collection={collection}
              run={run}
              busy={busy}
            />
          )}
          {collection && tab === 'Sync' && (
            <DesignSync
              key={collection.id}
              collection={collection}
              {...props}
              run={run}
              busy={busy}
            />
          )}
        </>
      )}
      <Dialog
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setDialog('');
            setError('');
          }
        }}
      >
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>
              {
                (
                  {
                    collection: 'New Design Collection',
                    template: target
                      ? 'Edit Design Template'
                      : 'New Design Template',
                    tag: target ? 'Edit Category' : 'Add Category',
                    layout: target ? 'Edit Layout' : 'Add Layout',
                    bulk: 'Edit Selected Designs',
                    upload: 'Bulk Upload Design Templates',
                    'delete-collection': 'Delete Collection',
                    'delete-template': 'Delete Template',
                    'delete-filter': 'Delete Category or Layout',
                  } as Record<string, string>
                )[dialog]
              }
            </DialogTitle>
            <DialogDescription>
              {dialog.startsWith('delete')
                ? 'Review the selected record before deleting.'
                : 'Save your changes to this design collection.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {dialog === 'collection' && (
            <NewCollection data={data} run={run} busy={busy} />
          )}
          {dialog === 'template' && (
            <TemplateEditor
              key={target?.id || 'new'}
              item={target}
              collection={collection}
              {...props}
              run={run}
              busy={busy}
            />
          )}
          {(dialog === 'tag' || dialog === 'layout') && collection && (
            <NameEditor
              item={target}
              kind={dialog === 'tag' ? 'design_tags' : 'design_layouts'}
              collection={collection}
              run={run}
              busy={busy}
            />
          )}
          {dialog === 'bulk' && collection && (
            <DesignBulk
              collection={collection}
              selected={selected}
              tags={tags}
              layouts={layouts}
              {...props}
              run={run}
              busy={busy}
            />
          )}
          {dialog === 'upload' && collection && (
            <DesignUpload collection={collection} run={run} busy={busy} />
          )}
          {dialog.startsWith('delete') && target && (
            <DeleteDesign
              target={target}
              kind={dialog}
              collection={collection}
              run={run}
              busy={busy}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
function NewCollection({
  data,
  run,
  busy,
}: {
  data: ManageProps['data'];
  run: Run;
  busy: boolean;
}) {
  const [name, setName] = useState(''),
    [d, setD] = useState({
      ...emptyDetails(),
      fields: [designQuestion(crypto.randomUUID())],
    });
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          action: 'save_resource',
          kind: 'categories',
          name,
          data: {
            ownerKind: 'designs',
            sortTemplates: 'Default',
            details: JSON.stringify(d),
          },
        });
      }}
    >
      <SField label="Name" value={name} onChange={setName} required max={120} />
      <ScopeEditor data={data} value={d} onChange={setD} />
      <button className="primary" disabled={busy}>
        Create Collection
      </button>
    </form>
  );
}
function CollectionSettings({
  collection,
  data,
  run,
  busy,
}: { collection: Resource; run: Run; busy: boolean } & ManageProps) {
  const [name, setName] = useState(collection.name),
    [sort, setSort] = useState(
      String(collection.data.sortTemplates || 'Default'),
    ),
    [d, setD] = useState(details(collection));
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          action: 'save_resource',
          kind: 'categories',
          id: collection.id,
          name,
          data: {
            ...collection.data,
            sortTemplates: sort,
            details: JSON.stringify(d),
          },
        });
      }}
    >
      <MSection title="Design Template Settings">
        <SField
          label="Name"
          value={name}
          onChange={setName}
          required
          max={120}
        />
        <h4>Preview</h4>
        <MediaPicker
          imageHint="PNG, JPEG or WebP; keep original image proportions"
          data={data}
          ids={d.images}
          onChange={(images) => setD({ ...d, images })}
        />
        <SChoice
          label="Sort Templates"
          value={sort}
          options={['Default', 'Alphabetically', 'Date Added']}
          onChange={setSort}
        />
      </MSection>
      <ScopeEditor
        data={data}
        value={d}
        onChange={setD}
        title="Enabled for Packages"
      />
      <button className="primary" disabled={busy}>
        Save Settings
      </button>
    </form>
  );
}
function TemplateEditor({
  item,
  collection,
  data,
  run,
  busy,
}: {
  item?: Resource;
  collection?: Resource;
  run: Run;
  busy: boolean;
} & ManageProps) {
  const [name, setName] = useState(item?.name || ''),
    [description, setDescription] = useState(
      String(item?.data.description || ''),
    ),
    [search, setSearch] = useState(String(item?.data.searchText || '')),
    [cid, setCid] = useState(
      String(item?.data.categoryId || collection?.id || ''),
    );
  const [d, setD] = useState(item ? details(item) : emptyDetails()),
    [tagIds, setTags] = useState(item ? designIds(item, 'tagIds') : []),
    [layoutIds, setLayouts] = useState(
      item ? designIds(item, 'layoutIds') : [],
    ),
    [gallery, setGallery] = useState(item?.data.showGallery !== false),
    [preset, setPreset] = useState(String(item?.data.preset || ''));
  const taxonomies = data.resources || [];
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          action: 'save_resource',
          kind: 'designs',
          id: item?.id,
          name,
          data: {
            ...item?.data,
            categoryId: cid,
            description,
            searchText: search,
            showGallery: gallery,
            preset,
            tagIds: JSON.stringify(tagIds),
            layoutIds: JSON.stringify(layoutIds),
            details: JSON.stringify(d),
          },
        });
      }}
    >
      <MSection title="Design Template">
        <SField
          label="Name"
          value={name}
          onChange={setName}
          required
          max={120}
        />
        <SChoice
          label="Collection"
          value={cid}
          options={[
            { value: '', label: 'Uncategorized' },
            ...designCollections(taxonomies).map((c) => ({
              value: c.id,
              label: c.name,
            })),
          ]}
          onChange={(id) => {
            setCid(id);
            setTags([]);
            setLayouts([]);
          }}
        />
        <h4>Primary Image</h4>
        <MediaPicker
          imageHint="PNG, JPEG or WebP; keep original image proportions"
          data={data}
          ids={d.images}
          onChange={(images) => setD({ ...d, images })}
        />
        <SField
          label="Description"
          value={description}
          onChange={setDescription}
          type="textarea"
        />
        <SChoice
          label="Layout diagram (when no image is uploaded)"
          value={preset}
          options={[{ value: '', label: 'None' }, ...layoutPresets]}
          onChange={setPreset}
        />
      </MSection>
      {(['design_tags', 'design_layouts'] as const).map((kind) => (
        <MSection
          title={kind === 'design_tags' ? 'Categories' : 'Layouts'}
          key={kind}
        >
          {taxonomies
            .filter(
              (r) =>
                r.kind === kind && r.data.categoryId === cid && !r.archived,
            )
            .map((r) => (
              <SToggle
                key={r.id}
                label={r.name}
                value={(kind === 'design_tags' ? tagIds : layoutIds).includes(
                  r.id,
                )}
                onChange={(v) => {
                  const list = kind === 'design_tags' ? tagIds : layoutIds;
                  (kind === 'design_tags' ? setTags : setLayouts)(
                    v ? [...list, r.id] : list.filter((id) => id !== r.id),
                  );
                }}
              />
            ))}
          {!taxonomies.some(
            (r) => r.kind === kind && r.data.categoryId === cid && !r.archived,
          ) && (
            <p className="muted">
              Create {kind === 'design_tags' ? 'categories' : 'layouts'} from
              the collection’s tab.
            </p>
          )}
        </MSection>
      ))}
      <ScopeEditor data={data} value={d} onChange={setD} title="Visibility" />
      <MSection title="Advanced Settings">
        <SField
          label="Extra Search Text"
          value={search}
          onChange={setSearch}
          type="textarea"
        />
        <SToggle
          label="Show in Design Gallery"
          value={gallery}
          onChange={setGallery}
        />
        <h4>Videos</h4>
        {d.videos.map((v, i) => (
          <div className="form-stack" key={i}>
            <SField
              label="Video title"
              value={v.title}
              onChange={(title) =>
                setD({
                  ...d,
                  videos: d.videos.map((x, j) =>
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
                setD({
                  ...d,
                  videos: d.videos.map((x, j) => (i === j ? { ...x, url } : x)),
                })
              }
            />
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setD({ ...d, videos: d.videos.filter((_, j) => j !== i) })
              }
            >
              Remove video
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          disabled={d.videos.length >= 10}
          onClick={() =>
            setD({ ...d, videos: [...d.videos, { title: 'Video', url: '' }] })
          }
        >
          Add Video
        </button>
        <p className="muted">
          Upload additional photos above. The first image is the primary
          preview.
        </p>
      </MSection>
      <button className="primary" disabled={busy}>
        {item ? 'Update Template' : 'Create Template'}
      </button>
    </form>
  );
}
function NameEditor({
  item,
  kind,
  collection,
  run,
  busy,
}: {
  item?: Resource;
  kind: string;
  collection: Resource;
  run: Run;
  busy: boolean;
}) {
  const [name, setName] = useState(item?.name || '');
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          action: 'save_resource',
          kind,
          id: item?.id,
          name,
          data: { ...item?.data, categoryId: collection.id },
        });
      }}
    >
      <SField label="Name" value={name} onChange={setName} required max={120} />
      <button className="primary" disabled={busy}>
        Save
      </button>
    </form>
  );
}
function DesignBulk({
  collection,
  selected,
  tags,
  layouts,
  data,
  run,
  busy,
}: {
  collection: Resource;
  selected: string[];
  tags: Resource[];
  layouts: Resource[];
  run: Run;
  busy: boolean;
} & ManageProps) {
  const [action, setAction] = useState('Add Categories'),
    [values, setValues] = useState<string[]>([]),
    [scope, setScope] = useState(emptyDetails()),
    [confirm, setConfirm] = useState('');
  const options = action.includes('Categories') ? tags : layouts;
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          action: 'bulk_designs',
          collectionId: collection.id,
          ids: selected,
          operation: action,
          values,
          scope,
          confirm,
        });
      }}
    >
      <p>{selected.length} selected templates</p>
      <SChoice
        label="Action"
        value={action}
        options={[
          'Add Categories',
          'Remove Categories',
          'Add Layouts',
          'Remove Layouts',
          'Set Associated Packages',
          'Delete Templates',
        ]}
        onChange={(v) => {
          setAction(v);
          setValues([]);
          setConfirm('');
        }}
      />
      {action === 'Set Associated Packages' ? (
        <ScopeEditor data={data} value={scope} onChange={setScope} />
      ) : action === 'Delete Templates' ? (
        <SField
          label="Type DELETE to confirm"
          value={confirm}
          onChange={setConfirm}
          required
        />
      ) : (
        <div>
          {options.map((r) => (
            <SToggle
              key={r.id}
              label={r.name}
              value={values.includes(r.id)}
              onChange={(v) =>
                setValues(
                  v ? [...values, r.id] : values.filter((id) => id !== r.id),
                )
              }
            />
          ))}
          {!options.length && (
            <p>
              No {action.includes('Categories') ? 'categories' : 'layouts'} have
              been created.
            </p>
          )}
        </div>
      )}
      <button
        className="primary"
        disabled={
          busy ||
          (!action.includes('Packages') &&
            !action.startsWith('Delete') &&
            !values.length)
        }
      >
        Update Selected Designs
      </button>
    </form>
  );
}
function DesignUpload({
  collection,
  run,
  busy,
}: {
  collection: Resource;
  run: Run;
  busy: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]),
    [uploaded, setUploaded] = useState<Record<string, string>>({}),
    [working, setWorking] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState('');
  async function upload() {
    setWorking(true);
    setError('');
    const ids: string[] = [];
    const next = { ...uploaded };
    try {
      for (const [i, file] of files.entries()) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        let id = next[key];
        if (!id) {
          setProgress(`Uploading ${i + 1} of ${files.length}…`);
          const r = await fetch(
            '/api/media?' + new URLSearchParams({ name: file.name }),
            {
              method: 'PUT',
              headers: { 'Content-Type': file.type },
              body: file,
            },
          );
          const j = (await r.json()) as { error?: string; file: Resource };
          if (!r.ok) throw Error(j.error);
          id = j.file.id;
          next[key] = id;
          setUploaded({ ...next });
        }
        ids.push(id);
      }
      setProgress('Creating templates…');
      await run({
        action: 'upload_designs',
        collectionId: collection.id,
        mediaIds: ids,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setWorking(false);
      setProgress('');
    }
  }
  return (
    <div className="form-stack">
      <label className="field">
        <span>Choose one or more images</span>
        <input
          aria-label="Choose one or more images"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={working || busy}
          onChange={(e) => {
            setFiles(Array.from(e.target.files || []));
            setError('');
          }}
        />
      </label>
      <p>
        Up to 20 PNG, JPEG or WebP images, 10 MB each. Each filename becomes a
        template name.
      </p>
      <ul>
        {files.map((f, i) => (
          <li key={i}>{f.name}</li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {progress && <p role="status">{progress}</p>}
      <button
        className="primary"
        disabled={
          working ||
          busy ||
          !files.length ||
          files.length > 20 ||
          files.some((f) => f.size > 10 * 1024 * 1024)
        }
        onClick={() => void upload()}
      >
        Upload Selected Templates
      </button>
    </div>
  );
}
function DeleteDesign({
  target,
  kind,
  collection,
  run,
  busy,
}: {
  target: Resource;
  kind: string;
  collection?: Resource;
  run: Run;
  busy: boolean;
}) {
  const [confirm, setConfirm] = useState('');
  return (
    <div className="form-stack">
      <p>
        Delete “{target.name}”
        {kind === 'delete-collection'
          ? ' and all templates, categories and layouts in this collection'
          : ''}
        ? Existing booking copies are kept.
      </p>
      {kind === 'delete-collection' && (
        <SField
          label={'Type ' + target.name + ' to confirm'}
          value={confirm}
          onChange={setConfirm}
        />
      )}
      <button
        className="primary"
        disabled={
          busy || (kind === 'delete-collection' && confirm !== target.name)
        }
        onClick={() =>
          void run(
            kind === 'delete-collection'
              ? {
                  action: 'delete_design_collection',
                  collectionId: target.id,
                  confirm,
                }
              : kind === 'delete-filter'
                ? {
                    action: 'delete_design_filter',
                    collectionId: collection?.id,
                    id: target.id,
                  }
                : { action: 'delete_resource', id: target.id },
          )
        }
      >
        Delete
      </button>
    </div>
  );
}
function DesignQuestions({
  collection,
  run,
  busy,
}: {
  collection: Resource;
  run: Run;
  busy: boolean;
}) {
  const [d, setD] = useState(details(collection)),
    [preview, setPreview] = useState(false),
    [answers, setAnswers] = useState<Record<string, string>>({});
  const patch = (id: string, p: Partial<FormField>) =>
    setD({
      ...d,
      fields: d.fields.map((q) => (q.id === id ? { ...q, ...p } : q)),
    });
  const move = (i: number, delta: number) => {
    const fields = [...d.fields],
      j = i + delta;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    setD({ ...d, fields });
  };
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          action: 'save_resource',
          kind: 'categories',
          id: collection.id,
          name: collection.name,
          data: { ...collection.data, details: JSON.stringify(d) },
        });
      }}
    >
      <div className="sales-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setPreview(false);
            setD({
              ...d,
              fields: [
                ...d.fields,
                {
                  ...designQuestion(crypto.randomUUID()),
                  label: 'New question',
                  type: 'Text Field',
                },
              ],
            });
          }}
        >
          Add Extra Question
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setPreview(!preview)}
        >
          {preview ? 'Edit Fields' : 'Preview Questions'}
        </button>
      </div>
      {d.fields.map((q, i) => (
        <MSection key={q.id} title={preview ? q.label : `Question ${i + 1}`}>
          {preview ? (
            <QuestionInput
              field={q}
              value={answers[q.id] || ''}
              onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
              preview
            />
          ) : (
            <>
              <SChoice
                label="Field Type"
                value={q.type}
                options={designQuestionTypes.map(([label, value]) => ({
                  label,
                  value,
                }))}
                onChange={(type) => patch(q.id, { type })}
              />
              <SField
                label="Label"
                value={q.label}
                onChange={(label) => patch(q.id, { label })}
                required
              />
              <SField
                label="Hint"
                value={q.hint}
                onChange={(hint) => patch(q.id, { hint })}
              />
              {['Dropdown', 'Radio Buttons', 'Checkbox Group', 'Song'].includes(
                q.type,
              ) && (
                <SField
                  label="Options — one per line"
                  type="textarea"
                  value={q.options.join('\n')}
                  onChange={(s) =>
                    patch(q.id, { options: s.split('\n').filter(Boolean) })
                  }
                />
              )}
              <SToggle
                label="Customers are required to answer this question"
                value={q.required}
                onChange={(required) => patch(q.id, { required })}
              />
              <div className="sales-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => move(i, -1)}
                >
                  Move up
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => move(i, 1)}
                >
                  Move down
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setD({
                      ...d,
                      fields: [...d.fields, { ...q, id: crypto.randomUUID() }],
                    })
                  }
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setD({
                      ...d,
                      fields: d.fields.filter((f) => f.id !== q.id),
                    })
                  }
                >
                  Remove Extra Question
                </button>
              </div>
            </>
          )}
        </MSection>
      ))}
      {!d.fields.length && <p>No extra questions have been added.</p>}
      <button className="primary" disabled={busy}>
        Save Extra Questions
      </button>
      <p className="muted">Use Sync to apply changes to existing bookings.</p>
    </form>
  );
}
function DesignSync({
  collection,
  data,
  run,
  busy,
}: { collection: Resource; run: Run; busy: boolean } & ManageProps) {
  const [add, setAdd] = useState(true),
    [update, setUpdate] = useState(true),
    [remove, setRemove] = useState(false),
    [confirm, setConfirm] = useState(''),
    [selected, setSelected] = useState<string[]>([]);
  const upcoming = data.events.filter(
    (e) =>
      e.status === 'confirmed' &&
      e.lifecycle === 'Active' &&
      e.date >= localToday(data.settings || {}),
  );
  const candidates = upcoming
    .map((e) => ({
      e,
      action: designSyncChange(e, data.resources || [], collection),
    }))
    .filter(
      (x) =>
        x.action &&
        (x.action === 'Add' ? add : x.action === 'Update' ? update : remove),
    );
  return (
    <div className="form-stack">
      <MSection title="Sync Design Collection">
        <p>
          Apply this collection’s current templates and questions to selected
          upcoming bookings. Updates preserve saved design choices and answers.
        </p>
        <SToggle
          label="Add to matching bookings"
          value={add}
          onChange={(v) => {
            setAdd(v);
            setSelected([]);
          }}
        />
        <SToggle
          label="Update existing matching bookings"
          value={update}
          onChange={(v) => {
            setUpdate(v);
            setSelected([]);
          }}
        />
        <SToggle
          label="Remove from bookings that no longer match"
          value={remove}
          onChange={(v) => {
            setRemove(v);
            setSelected([]);
          }}
        />
      </MSection>
      <SToggle
        label={`Select all ${candidates.length} affected bookings`}
        value={
          !!candidates.length &&
          candidates.every((x) => selected.includes(x.e.id))
        }
        onChange={(v) => setSelected(v ? candidates.map((x) => x.e.id) : [])}
      />
      <STable
        headers={['Select', 'Booking', 'Date', 'Change']}
        rows={candidates.map(({ e, action }) => [
          <SToggle
            key={e.id}
            label={'Select ' + e.title}
            value={selected.includes(e.id)}
            onChange={(v) =>
              setSelected(
                v ? [...selected, e.id] : selected.filter((id) => id !== e.id),
              )
            }
          />,
          e.title,
          e.date,
          action,
        ])}
        empty="No upcoming bookings match these sync options."
      />
      {remove && (
        <SField
          label="Type REMOVE to remove nonmatching collections and their answers"
          value={confirm}
          onChange={setConfirm}
        />
      )}
      <button
        className="primary"
        disabled={busy || !selected.length || (remove && confirm !== 'REMOVE')}
        onClick={() =>
          void run({
            action: 'sync_design_collection',
            collectionId: collection.id,
            eventIds: selected,
            add,
            update,
            remove,
            confirm,
          })
        }
      >
        Perform Sync ({selected.length})
      </button>
    </div>
  );
}
