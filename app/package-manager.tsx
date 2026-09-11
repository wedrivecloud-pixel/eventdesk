'use client';
import { useState, useEffect } from 'react';
import { BulkPackageSettings } from './bulk-package-settings';
import { BulkPackageTable } from './bulk-package-table';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Package,
  Plus,
  MoreHorizontal,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Copy,
  Folder,
  Layers,
  Link2,
} from 'lucide-react';
import { type Data, type PackageRecord, money } from '@/lib/crm';
import { imageUrl } from '@/lib/package-config';
import {
  managerServices,
  managerGroups,
  packageSorts,
} from '@/lib/package-manager';
import { PackageLink } from './package-link';
import { AvailabilityLink } from './availability-link';
import { CatalogPresentationEditor } from './catalog-presentation-editor';
import { catalogPresentation } from '@/lib/catalog-presentation';
export function PackageManager({
  data,
  onData,
  onEdit,
  onNew,
}: {
  data: Data;
  onData: (data: Data) => void;
  onEdit: (p: PackageRecord) => void;
  onNew: (service?: string, group?: string) => void;
}) {
  const [bulkView, setBulkView] = useState(false),
    [presentation, setPresentation] = useState(catalogPresentation()),
    [bulkSettings, setBulkSettings] = useState<Record<string, unknown>>({}),
    [collection, setCollection] = useState<{
      service: string;
      group?: string;
    }>(),
    [deletion, setDeletion] = useState<{
      action: string;
      label: string;
      count: number;
      service?: string;
      group?: string;
      ids?: string[];
    }>(),
    [confirmation, setConfirmation] = useState('');
  const [query, setQuery] = useState(''),
    [visibility, setVisibility] = useState('Public & Private'),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [ordering, setOrdering] = useState(false);
  const [modal, setModal] = useState(''),
    [draft, setDraft] = useState({
      name: '',
      service: '',
      original: '',
      fromService: '',
      sort: packageSorts[0],
    }),
    [sharing, setSharing] = useState<PackageRecord>();
  const [bulkStatus, setBulkStatus] = useState('No change'),
    [bulkService, setBulkService] = useState('No change'),
    [bulkGroup, setBulkGroup] = useState('Keep current group'),
    [priceMode, setPriceMode] = useState('No change'),
    [priceValue, setPriceValue] = useState(0);
  const services = managerServices(data),
    matchesName = (name: string) =>
      name.toLowerCase().includes(query.trim().toLowerCase()),
    matches = (p: PackageRecord) =>
      (visibility === 'All packages' || p.settings?.status !== 'Disabled') &&
      (visibility !== 'Public only' || p.settings?.status === 'Public') &&
      [p.name, p.description, p.service, p.settings?.group || '']
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase().trim());
  const visible = data.packages.filter(matches),
    editableServices = data.business?.services || [];
  useEffect(
    () =>
      setSelected((ids) =>
        ids.filter((id) => data.packages.some((p) => p.id === id)),
      ),
    [data.packages],
  );
  function toggle(ids: string[], checked: boolean) {
    setSelected((current) =>
      checked
        ? [...new Set([...current, ...ids])].slice(0, 100)
        : current.filter((id) => !ids.includes(id)),
    );
  }
  function remove(scope: { service?: string; group?: string; ids?: string[] }) {
    const count =
      scope.ids?.length ??
      data.packages.filter(
        (p) =>
          p.service === scope.service &&
          (scope.group === undefined ||
            (p.settings?.group || '') === scope.group),
      ).length;
    setError('');
    setConfirmation('');
    setDeletion({
      ...scope,
      count,
      action: scope.ids
        ? 'delete_packages'
        : scope.group === undefined
          ? 'delete_service'
          : 'delete_group',
      label: scope.ids
        ? 'DELETE'
        : scope.group === undefined
          ? scope.service!
          : scope.group || 'Ungrouped',
    });
  }
  function collectionAction(mode: string, service: string, group?: string) {
    setCollection({ service, ...(group === undefined ? {} : { group }) });
    setError('');
    setBulkStatus('Public');
    if (mode === 'duplicate-service') {
      openService(service);
      setDraft((d) => ({ ...d, name: service.slice(0, 60) + ' (copy)' }));
    } else if (mode === 'duplicate-group') {
      openGroup(service, group);
      setDraft((d) => ({
        ...d,
        name: (group || 'Ungrouped').slice(0, 90) + ' (copy)',
      }));
    }
    setModal(mode);
  }
  function startOrdering() {
    setOrdering(true);
    setBulkView(false);
    setQuery('');
    setVisibility('All packages');
  }
  async function act(body: Record<string, unknown>, close = false) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const next = (await r.json()) as Data & { error?: string };
      if (!r.ok) throw Error(next.error);
      onData(next);
      setNotice(
        body.action === 'duplicate_package'
          ? 'Package duplicated as Private, including its settings and photos.'
          : 'Package Manager updated. Existing quotes keep their prices.',
      );
      if (String(body.action).startsWith('delete_'))
        setNotice(
          'Deleted from the catalog. Existing proposals and bookings were preserved.',
        );
      if (
        body.action === 'duplicate_service' ||
        body.action === 'duplicate_group'
      )
        setNotice(
          'Duplicated with independent package photos. New packages start as Private.',
        );
      if (close) {
        setModal('');
        setSelected([]);
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  function choice(
    label: string,
    value: string,
    options: string[],
    change: (v: string) => void,
  ) {
    return (
      <div className="field">
        <span>{label}</span>
        <Select
          value={value}
          onValueChange={(v) => change(String(v))}
          disabled={busy}
        >
          <SelectTrigger aria-label={label}>
            <SelectValue>{value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  function openGroup(
    service = editableServices[0] || '',
    name?: string,
    sort = packageSorts[0],
  ) {
    setError('');
    setDraft({
      name: name || '',
      service,
      original: name || '',
      fromService: service,
      sort,
    });
    setPresentation(
      catalogPresentation(
        data.resources?.find(
          (r) =>
            r.kind === 'package_groups' &&
            !r.archived &&
            r.data.service === service &&
            r.name === name,
        )?.data,
      ),
    );
    setModal(name ? 'edit-group' : 'new-group');
  }
  function openService(name?: string) {
    setError('');
    setPresentation(
      catalogPresentation(
        data.resources?.find(
          (r) =>
            r.kind === 'service_settings' && !r.archived && r.name === name,
        )?.data,
      ),
    );
    setDraft({
      name: name || '',
      service: '',
      original: name || '',
      fromService: '',
      sort: packageSorts[0],
    });
    setModal(name ? 'edit-service' : 'new-service');
  }
  function openBulk(ids = selected) {
    setSelected(ids);
    setError('');
    setBulkStatus('No change');
    setBulkService('No change');
    setBulkGroup('Keep current group');
    setPriceMode('No change');
    setPriceValue(0);
    setBulkSettings({});
    setModal('bulk');
  }
  function swap<T>(list: T[], index: number, delta: number) {
    const next = [...list];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    return next;
  }
  const destination =
    bulkService === 'No change'
      ? data.packages.find((p) => selected.includes(p.id))?.service ||
        editableServices[0]
      : bulkService;
  const destinationGroups = managerGroups(data, destination)
    .map((g) => g.name)
    .filter(Boolean)
    .filter(
      (name) =>
        bulkService !== 'No change' ||
        [
          ...new Set(
            data.packages
              .filter((p) => selected.includes(p.id))
              .map((p) => p.service),
          ),
        ].every((service) =>
          managerGroups(data, service).some((g) => g.name === name),
        ),
    );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (modal === 'duplicate-service' || modal === 'duplicate-group') {
      await act(
        {
          action:
            modal === 'duplicate-service'
              ? 'duplicate_service'
              : 'duplicate_group',
          ...collection,
          name: draft.name,
        },
        true,
      );
    } else if (modal === 'visibility-collection') {
      await act(
        { action: 'set_catalog_visibility', ...collection, status: bulkStatus },
        true,
      );
    } else if (modal.includes('service'))
      await act(
        {
          action: 'save_service',
          name: draft.name,
          presentation,
          ...(modal === 'edit-service' ? { original: draft.original } : {}),
        },
        true,
      );
    else if (modal.includes('group'))
      await act(
        {
          action: 'save_group',
          name: draft.name,
          presentation,
          service: draft.service,
          sort: draft.sort,
          ...(modal === 'edit-group'
            ? { original: draft.original, fromService: draft.fromService }
            : {}),
        },
        true,
      );
    else {
      const changes: Record<string, unknown> = {};
      if (bulkStatus !== 'No change') changes.status = bulkStatus;
      if (bulkService !== 'No change') changes.service = bulkService;
      if (bulkGroup !== 'Keep current group')
        changes.group = bulkGroup === 'Ungrouped' ? '' : bulkGroup;
      if (priceMode !== 'No change') {
        changes.priceMode = priceMode;
        changes.priceValue = priceValue;
      }
      if (Object.keys(bulkSettings).length) changes.settings = bulkSettings;
      if (!Object.keys(changes).length) {
        setError('Choose at least one change.');
        return;
      }
      await act({ action: 'bulk_packages', ids: selected, changes }, true);
    }
  }
  return (
    <div className="package-manager">
      {data.business && <AvailabilityLink businessId={data.business.id} />}
      <div className="manager-toolbar">
        <div className="manager-actions">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="primary"
              disabled={busy || !data.business}
            >
              <Plus size={17} /> New
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 max-w-[calc(100vw-2rem)]">
              <DropdownMenuItem onClick={() => onNew()}>
                New package
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openGroup()}>
                New package group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openService()}>
                New service
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="secondary"
              disabled={busy || !data.business}
            >
              Bulk Edit
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 max-w-[calc(100vw-2rem)]">
              <DropdownMenuItem
                onClick={() => {
                  setBulkView(true);
                  setOrdering(false);
                }}
              >
                Bulk edit package settings
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!selected.length}
                onClick={() => openBulk()}
              >
                Edit selected packages ({selected.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={startOrdering}>
                Change sort order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className={`secondary ${ordering ? 'manager-active' : ''}`}
            onClick={() => setOrdering((v) => !v)}
          >
            {ordering ? 'Done sorting' : 'Change sort order'}
          </button>
        </div>
        <span className="muted">
          {data.packages.length} packages · {services.length} services
        </span>
      </div>
      <div className="panel manager-filters">
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Search packages"
            placeholder="Search packages, groups or services…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected([]);
            }}
          />
        </div>
        {choice(
          'Show packages',
          visibility,
          ['Public & Private', 'Public only', 'All packages'],
          (v) => {
            setVisibility(v);
            setSelected([]);
          },
        )}
        <label className="manager-select-all">
          <Checkbox
            checked={
              visible.length > 0 &&
              visible.slice(0, 100).every((p) => selected.includes(p.id))
            }
            indeterminate={
              visible.some((p) => selected.includes(p.id)) &&
              !visible.slice(0, 100).every((p) => selected.includes(p.id))
            }
            disabled={!visible.length || busy}
            onCheckedChange={(v) =>
              setSelected(v ? visible.slice(0, 100).map((p) => p.id) : [])
            }
          />
          Select shown <small>(up to 100)</small>
        </label>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && !modal && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {ordering && (
        <p className="manager-tip">
          Use the arrows to order services and groups. Choose Custom order
          within a group to move individual packages. Clear search and show all
          packages to reorder packages.
        </p>
      )}
      {bulkView && (
        <>
          <div className="bulk-selection-bar">
            <div>
              <h2>Bulk Edit Packages</h2>
              <p>
                Select packages individually, by group or by service. Up to 100
                per update.
              </p>
            </div>
            <button className="secondary" onClick={() => setBulkView(false)}>
              Back to package view
            </button>
            <button
              className="primary"
              disabled={!selected.length || busy}
              onClick={() => openBulk()}
            >
              Edit selected packages ({selected.length})
            </button>
            <button
              className="secondary"
              disabled={!selected.length || busy}
              onClick={() => remove({ ids: selected })}
            >
              Delete selected
            </button>
          </div>
          <BulkPackageTable
            data={data}
            selected={selected}
            toggle={toggle}
            matches={matches}
            onEdit={onEdit}
            busy={busy}
          />
        </>
      )}
      {!bulkView &&
        services.map((service, si) => {
          const groups = managerGroups(data, service);
          if (
            query &&
            !matchesName(service) &&
            !groups.some((g) => matchesName(g.name) || g.packages.some(matches))
          )
            return null;
          return (
            <section className="manager-service panel" key={service}>
              <div className="manager-service-heading">
                <Layers size={21} />
                <div>
                  <h2>{service}</h2>
                  <small>
                    Service ·{' '}
                    {data.packages.filter((p) => p.service === service).length}{' '}
                    packages
                  </small>
                </div>
                <div className="manager-service-controls">
                  {ordering && editableServices.includes(service) && (
                    <>
                      <button
                        className="icon-button"
                        aria-label={'Move ' + service + ' service up'}
                        disabled={busy || si === 0}
                        onClick={() =>
                          void act({
                            action: 'reorder_services',
                            services: swap(editableServices, si, -1),
                          })
                        }
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={'Move ' + service + ' service down'}
                        disabled={busy || si === editableServices.length - 1}
                        onClick={() =>
                          void act({
                            action: 'reorder_services',
                            services: swap(editableServices, si, 1),
                          })
                        }
                      >
                        <ArrowDown size={16} />
                      </button>
                    </>
                  )}
                  <button
                    className="text-button"
                    onClick={() => openGroup(service)}
                  >
                    <Plus size={15} />
                    New group
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="icon-button"
                      aria-label={'Manage service ' + service}
                      disabled={busy}
                    >
                      <MoreHorizontal size={20} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-64 max-w-[calc(100vw-2rem)]"
                    >
                      <DropdownMenuItem
                        disabled={!editableServices.includes(service)}
                        onClick={() => openService(service)}
                      >
                        Edit Service
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!editableServices.includes(service)}
                        onClick={() =>
                          collectionAction('duplicate-service', service)
                        }
                      >
                        Duplicate Service
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          collectionAction('visibility-collection', service)
                        }
                      >
                        Set Visibility of Packages
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => remove({ service })}>
                        Delete Service
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={startOrdering}>
                        Reorder Services
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={startOrdering}>
                        Reorder Package Groups
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          collectionAction('share-collection', service)
                        }
                      >
                        Shareable link to service
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {groups.map((g, gi) => {
                const members = g.packages.filter(matches);
                if (
                  query &&
                  !members.length &&
                  !matchesName(service) &&
                  !matchesName(g.name)
                )
                  return null;
                return (
                  <div className="manager-group" key={g.name}>
                    <div className="manager-group-heading">
                      <Folder size={18} />
                      <div>
                        <h3>{g.name || 'Ungrouped packages'}</h3>
                        <small>Package group · {members.length} shown</small>
                      </div>
                      <div className="manager-group-tools">
                        {ordering && (
                          <>
                            <button
                              className="icon-button"
                              aria-label={
                                'Move ' + (g.name || 'Ungrouped') + ' group up'
                              }
                              disabled={busy || gi === 0}
                              onClick={() =>
                                void act({
                                  action: 'reorder_groups',
                                  service,
                                  groups: swap(
                                    groups.map((x) => x.name),
                                    gi,
                                    -1,
                                  ),
                                })
                              }
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={
                                'Move ' +
                                (g.name || 'Ungrouped') +
                                ' group down'
                              }
                              disabled={busy || gi === groups.length - 1}
                              onClick={() =>
                                void act({
                                  action: 'reorder_groups',
                                  service,
                                  groups: swap(
                                    groups.map((x) => x.name),
                                    gi,
                                    1,
                                  ),
                                })
                              }
                            >
                              <ArrowDown size={15} />
                            </button>
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="icon-button"
                            aria-label={
                              'Manage group ' +
                              service +
                              ' / ' +
                              (g.name || 'Ungrouped')
                            }
                            disabled={busy}
                          >
                            <MoreHorizontal size={19} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-64 max-w-[calc(100vw-2rem)]"
                          >
                            <DropdownMenuItem
                              disabled={!g.name}
                              onClick={() => openGroup(service, g.name, g.sort)}
                            >
                              Edit Package Group
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                collectionAction(
                                  'duplicate-group',
                                  service,
                                  g.name,
                                )
                              }
                            >
                              Duplicate Package Group
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                collectionAction(
                                  'visibility-collection',
                                  service,
                                  g.name,
                                )
                              }
                            >
                              Set Visibility of Packages
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => remove({ service, group: g.name })}
                            >
                              Delete Package Group
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!g.name}
                              onClick={() => openGroup(service, g.name, g.sort)}
                            >
                              Move to Service
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={startOrdering}>
                              Reorder Package Groups
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                startOrdering();
                                void act({
                                  action: 'sort_group',
                                  service,
                                  group: g.name,
                                  sort: 'Custom order',
                                });
                              }}
                            >
                              Reorder Packages
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                collectionAction(
                                  'share-collection',
                                  service,
                                  g.name,
                                )
                              }
                            >
                              Shareable link to package group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {choice(
                          'Sort ' + (g.name || service),
                          g.sort,
                          packageSorts,
                          (sort) =>
                            void act({
                              action: 'sort_group',
                              service,
                              group: g.name,
                              sort,
                            }),
                        )}
                      </div>
                    </div>
                    <div className="manager-package-list">
                      {members.map((p) => {
                        const index = g.packages.findIndex(
                          (x) => x.id === p.id,
                        );
                        return (
                          <article className="manager-package-row" key={p.id}>
                            <Checkbox
                              aria-label={'Select ' + p.name}
                              checked={selected.includes(p.id)}
                              disabled={busy}
                              onCheckedChange={(v) =>
                                toggle([p.id], v === true)
                              }
                            />
                            <button
                              className="manager-package-open"
                              onClick={() => onEdit(p)}
                            >
                              {p.images?.[0] ? (
                                <img src={imageUrl(p.images[0].id)} alt="" />
                              ) : (
                                <span className="package-icon">
                                  <Package size={23} />
                                </span>
                              )}
                              <span>
                                <strong>{p.name}</strong>
                                <small>{p.duration}</small>
                              </span>
                            </button>
                            <span
                              className={
                                'manager-visibility ' +
                                p.settings?.status?.toLowerCase()
                              }
                            >
                              {p.settings?.status || 'Public'}
                            </span>
                            <strong className="manager-price">
                              {money(p.price)}
                              <small>
                                {p.settings?.unitMode === 'Per unit'
                                  ? '/ ' + p.settings.unitLabel
                                  : 'starting rate'}
                              </small>
                            </strong>
                            {ordering && g.sort === 'Custom order' && (
                              <div className="manager-move">
                                <button
                                  className="icon-button"
                                  aria-label={'Move ' + p.name + ' up'}
                                  disabled={
                                    busy ||
                                    index === 0 ||
                                    !!query ||
                                    visibility !== 'All packages'
                                  }
                                  onClick={() =>
                                    void act({
                                      action: 'sort_group',
                                      service,
                                      group: g.name,
                                      sort: 'Custom order',
                                      ids: swap(
                                        g.packages.map((x) => x.id),
                                        index,
                                        -1,
                                      ),
                                    })
                                  }
                                >
                                  <ArrowUp size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={'Move ' + p.name + ' down'}
                                  disabled={
                                    busy ||
                                    index === g.packages.length - 1 ||
                                    !!query ||
                                    visibility !== 'All packages'
                                  }
                                  onClick={() =>
                                    void act({
                                      action: 'sort_group',
                                      service,
                                      group: g.name,
                                      sort: 'Custom order',
                                      ids: swap(
                                        g.packages.map((x) => x.id),
                                        index,
                                        1,
                                      ),
                                    })
                                  }
                                >
                                  <ArrowDown size={15} />
                                </button>
                              </div>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="icon-button"
                                aria-label={'Manage ' + p.name}
                                disabled={busy}
                              >
                                <MoreHorizontal size={19} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-64 max-w-[calc(100vw-2rem)]"
                              >
                                <DropdownMenuItem onClick={() => onEdit(p)}>
                                  Edit package
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    void act({
                                      action: 'duplicate_package',
                                      id: p.id,
                                    })
                                  }
                                >
                                  <Copy size={15} />
                                  Duplicate package
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openBulk([p.id])}
                                >
                                  Set Visibility / edit price
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openBulk([p.id])}
                                >
                                  Move to group
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSharing(p);
                                    setModal('share');
                                  }}
                                >
                                  Shareable package link
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => remove({ ids: [p.id] })}
                                >
                                  Delete Package
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    void act({
                                      action: 'bulk_packages',
                                      ids: [p.id],
                                      changes: {
                                        status:
                                          p.settings?.status === 'Disabled'
                                            ? 'Private'
                                            : 'Disabled',
                                      },
                                    })
                                  }
                                >
                                  {p.settings?.status === 'Disabled'
                                    ? 'Enable as Private'
                                    : 'Disable package'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </article>
                        );
                      })}
                      {!members.length && (
                        <p className="manager-empty">
                          {g.packages.length
                            ? 'No packages match this filter.'
                            : 'This group is ready for its first package.'}
                        </p>
                      )}
                    </div>
                    <button
                      className="text-button manager-add"
                      onClick={() => onNew(service, g.name)}
                    >
                      <Plus size={15} />
                      Add a package
                    </button>
                  </div>
                );
              })}
              {!groups.length && (
                <p className="manager-empty">
                  Create a group or add your first package for this service.
                </p>
              )}
              <button
                className="text-button manager-add"
                onClick={() => openGroup(service)}
              >
                <Plus size={15} />
                Add a new package group to {service}
              </button>
            </section>
          );
        })}
      {!services.length && (
        <section className="panel manager-empty">
          <Package size={28} />
          <h2>Build your service catalog</h2>
          <p>Add a service, create a group, then add packages.</p>
        </section>
      )}
      {!!query &&
        !visible.length &&
        (bulkView ||
          !services.some(
            (s) =>
              matchesName(s) ||
              managerGroups(data, s).some((g) => matchesName(g.name)),
          )) && <p className="manager-empty">No packages match your search.</p>}
      <button
        className="secondary"
        disabled={!data.business}
        onClick={() => openService()}
      >
        <Plus size={17} />
        Build a new service
      </button>
      <p className="muted manager-footnote">
        Disabled packages remain under All packages and can be enabled again.
        Existing proposals and bookings are preserved.
      </p>
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setModal('');
            setError('');
          }
        }}
      >
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>
              {modal === 'share-collection'
                ? 'Sharing link'
                : modal === 'visibility-collection'
                  ? 'Set visibility of packages'
                  : modal === 'duplicate-service'
                    ? 'Duplicate service'
                    : modal === 'duplicate-group'
                      ? 'Duplicate package group'
                      : modal === 'share'
                        ? 'Package link'
                        : modal === 'bulk'
                          ? 'Bulk edit ' +
                            selected.length +
                            ' package' +
                            (selected.length === 1 ? '' : 's')
                          : modal === 'new-service'
                            ? 'New service'
                            : modal === 'edit-service'
                              ? 'Edit service'
                              : modal === 'new-group'
                                ? 'New package group'
                                : 'Edit package group'}
            </DialogTitle>
            <DialogDescription>
              {modal === 'bulk'
                ? 'Apply the same changes to your selected packages. Existing quotes keep their prices.'
                : modal === 'share'
                  ? 'Open the selected package or copy its direct preview link.'
                  : 'Organize your service catalog.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {modal === 'share-collection' && collection && data.business ? (
            <AvailabilityLink
              businessId={data.business.id}
              scope={collection}
            />
          ) : modal === 'share' && sharing ? (
            <PackageLink item={sharing} />
          ) : (
            <form className="form-stack" onSubmit={submit}>
              {modal === 'visibility-collection' ? (
                <>
                  <p>
                    Update every package in{' '}
                    {collection?.group ?? collection?.service}, including
                    packages hidden by the current filter.
                  </p>
                  {choice(
                    'Visibility',
                    bulkStatus,
                    ['Public', 'Private', 'Disabled'],
                    setBulkStatus,
                  )}
                </>
              ) : modal === 'bulk' ? (
                <>
                  <div className="form-grid">
                    {choice(
                      'Visibility',
                      bulkStatus,
                      ['No change', 'Public', 'Private', 'Disabled'],
                      setBulkStatus,
                    )}
                    {choice(
                      'Move to service',
                      bulkService,
                      ['No change', ...editableServices],
                      (v) => {
                        setBulkService(v);
                        setBulkGroup(
                          v === 'No change'
                            ? 'Keep current group'
                            : 'Ungrouped',
                        );
                      },
                    )}
                    {choice(
                      'Package group',
                      bulkGroup,
                      ['Keep current group', 'Ungrouped', ...destinationGroups],
                      setBulkGroup,
                    )}
                    {choice(
                      'Pricing change',
                      priceMode,
                      [
                        'No change',
                        'Set price',
                        'Adjust by percent',
                        'Adjust by amount',
                      ],
                      setPriceMode,
                    )}
                    {priceMode !== 'No change' && (
                      <label className="field">
                        <span>
                          {priceMode === 'Adjust by percent'
                            ? 'Adjustment (%)'
                            : 'Amount (USD)'}
                        </span>
                        <input
                          type="number"
                          required
                          min={priceMode === 'Set price' ? 0 : -1000000}
                          max={1000000}
                          step="0.01"
                          value={priceValue}
                          onChange={(e) =>
                            setPriceValue(Number(e.target.value))
                          }
                        />
                      </label>
                    )}
                  </div>
                  <BulkPackageSettings
                    value={bulkSettings}
                    onChange={setBulkSettings}
                    resources={data.resources || []}
                    busy={busy}
                  />
                  <p className="muted">
                    Negative adjustments reduce prices. The complete update is
                    rejected if any resulting price falls below zero.
                  </p>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>
                      {modal.includes('service')
                        ? 'Service name'
                        : 'Group name'}
                    </span>
                    <input
                      required
                      maxLength={modal.includes('service') ? 70 : 100}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, name: e.target.value }))
                      }
                    />
                  </label>
                  {modal.includes('group') && modal !== 'duplicate-group' && (
                    <div className="form-grid">
                      {choice('Service', draft.service, editableServices, (v) =>
                        setDraft((d) => ({ ...d, service: v })),
                      )}
                      {choice(
                        'Package sort order',
                        draft.sort,
                        packageSorts,
                        (v) => setDraft((d) => ({ ...d, sort: v })),
                      )}
                    </div>
                  )}
                  {!modal.startsWith('duplicate-') && (
                    <CatalogPresentationEditor
                      value={presentation}
                      onChange={setPresentation}
                      data={data}
                      onData={onData}
                      busy={busy}
                      onBusy={setBusy}
                      scope={
                        modal === 'edit-service'
                          ? { service: draft.original }
                          : modal === 'edit-group'
                            ? {
                                service: draft.fromService,
                                group: draft.original,
                              }
                            : undefined
                      }
                    />
                  )}
                  {modal === 'edit-group' && (
                    <p className="muted">
                      Renaming or moving this group updates all packages in the
                      group.
                    </p>
                  )}
                  {modal.startsWith('duplicate-') && (
                    <p className="muted">
                      Copies packages, settings and photos. Copied packages
                      start as Private and can be edited independently.
                    </p>
                  )}
                  {modal === 'edit-service' && (
                    <p className="muted">
                      Renaming this service updates its packages and groups.
                    </p>
                  )}
                </>
              )}
              <div className="form-footer">
                <span>
                  {modal === 'bulk'
                    ? selected.length + ' packages selected'
                    : 'Changes save to your business.'}
                </span>
                <button className="primary" disabled={busy}>
                  {busy
                    ? 'Saving…'
                    : modal === 'bulk'
                      ? 'Apply changes'
                      : 'Save'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deletion}
        onOpenChange={(open) => {
          if (!open && !busy) setDeletion(undefined);
        }}
      >
        <AlertDialogContent className="manager-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{' '}
              {deletion?.ids
                ? 'packages'
                : deletion?.group === undefined
                  ? 'service'
                  : 'package group'}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deletion?.count} package(s), their
              photos{deletion?.ids ? '' : ' and this catalog section'}. Existing
              proposals and bookings keep their saved details. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="field">
            <span>
              Type <strong>{deletion?.label}</strong> to confirm
            </span>
            <input
              aria-label="Deletion confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={busy}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <button
              className="primary manager-delete-button"
              disabled={busy || confirmation !== deletion?.label}
              onClick={async () => {
                if (
                  deletion &&
                  (await act({ ...deletion, confirm: confirmation }))
                ) {
                  setDeletion(undefined);
                  setSelected([]);
                }
              }}
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
