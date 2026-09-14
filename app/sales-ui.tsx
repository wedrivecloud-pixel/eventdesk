'use client';
import type { ReactNode } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import type { Data, EventRecord } from '@/lib/crm';
export type Editor = {
  kind: string;
  id?: string;
  updatedAt?: string;
  data?: Record<string, any>;
  title?: string;
};
export type SalesProps = {
  personal?: boolean;
  currentStaffId?: string;
  data: Data;
  onData: (data: Data) => void;
  onOpen: (e: EventRecord) => void;
  onNavigate: (s: string) => void;
  onOpenCatalog?: (report: string, id: string) => void;
  edit: (e: Editor) => void;
  run: (body: Record<string, unknown>, endpoint?: string) => Promise<boolean>;
  busy: boolean;
  onCreateEvent: (defaults?: Partial<EventRecord>) => void;
};
export function SField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  max = 5000,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  max?: number;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      {type === 'textarea' ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          maxLength={max}
          rows={4}
          required={required}
        />
      ) : (
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          maxLength={max}
          step={type === 'number' ? '0.01' : undefined}
        />
      )}
    </label>
  );
}
export function SChoice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  const opts = options.map((x) =>
    typeof x === 'string' ? { label: x, value: x } : x,
  );
  return (
    <div className="field">
      <span>{label}</span>
      <Select
        value={String(value ?? '')}
        onValueChange={(v) => onChange(String(v ?? ''))}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue>
            {opts.find((x) => x.value === String(value ?? ''))?.label ||
              'Choose…'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {opts.map((x) => (
            <SelectItem key={x.value} value={x.value}>
              {x.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function SToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="sales-toggle">
      <Checkbox checked={value} onCheckedChange={(v) => onChange(v === true)} />
      <span>{label}</span>
    </label>
  );
}
export function STable({
  headers,
  rows,
  empty = 'No records match these filters.',
}: {
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  return (
    <div className="sales-table">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h, i) => (
              <TableHead key={i}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((v, j) => (
                <TableCell key={j}>{v}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && <p className="padded muted">{empty}</p>}
    </div>
  );
}
export function SActions({
  label = 'Actions',
  items,
}: {
  label?: string;
  items: { label: string; action: () => void; disabled?: boolean }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="secondary" aria-label={label}>
        <MoreHorizontal size={17} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((x) => (
          <DropdownMenuItem
            key={x.label}
            onClick={x.action}
            disabled={x.disabled}
          >
            {x.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function STabs({
  tabs,
  value,
  onChange,
}: {
  tabs: string[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="sales-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          tabIndex={
            value === t || (!tabs.includes(value) && t === tabs[0]) ? 0 : -1
          }
          className={value === t ? 'active' : ''}
          onClick={() => onChange(t)}
          onKeyDown={(e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
              return;
            e.preventDefault();
            const index = tabs.indexOf(t);
            const next =
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? tabs.length - 1
                  : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
                    tabs.length;
            onChange(tabs[next]);
            e.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              [next]?.focus();
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
export function SHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      <div className="sales-actions">{children}</div>
    </div>
  );
}
export const staffOptions = (data: Data, owner = false) => [
  { value: '', label: 'Unassigned' },
  ...(owner ? [{ value: 'owner', label: 'Me (business owner)' }] : []),
  ...(data.resources || [])
    .filter((r) => r.kind === 'staff' && !r.archived)
    .map((r) => ({ value: r.id, label: r.name })),
];
export const eventOptions = (data: Data) => [
  { value: '', label: 'No linked event' },
  ...data.events
    .filter((e) => e.lifecycle === 'Active' || !e.lifecycle)
    .map((e) => ({ value: e.id, label: `${e.title} · ${e.date}` })),
];
export const staffName = (data: Data, id: string) =>
  id === 'owner'
    ? 'Me (business owner)'
    : data.resources?.find((r) => r.id === id)?.name || 'Unassigned';
