'use client';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { checklistItems } from '@/lib/checklist-catalog';
import { appliesTo } from '@/lib/manage-config';
import { localToday } from '@/lib/manage-pricing';
import { prettyDate, type Data } from '@/lib/crm';
import type { Resource } from '@/lib/settings';
import { SField, SToggle } from './sales-ui';

export function ChecklistSetup({ onData }: { onData: (data: Data) => void }) {
  const [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    fetch('/api/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initialize_checklists' }),
    })
      .then(async (r) => {
        const j = (await r.json()) as Data & { error?: string };
        if (!r.ok) throw Error(j.error);
        if (active) onData(j);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Unable to load checklists.',
          );
      });
    return () => {
      active = false;
    };
  }, [onData, retry]);
  return (
    <section className="panel padded">
      <h2>Checklist templates</h2>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button
            className="secondary"
            onClick={() => {
              setError('');
              setRetry(retry + 1);
            }}
          >
            Try again
          </button>
        </>
      ) : (
        <p>Loading equipment, pre-event, and post-event checklists…</p>
      )}
    </section>
  );
}
export function ChecklistBookingDialog({
  category,
  reset,
  data,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  category: Resource;
  reset: boolean;
  data: Data;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [ids, setIds] = useState<string[]>([]),
    [confirm, setConfirm] = useState('');
  const templates = checklistItems(data.resources || [], category.id);
  const events = data.events.filter(
    (e) =>
      e.status === 'confirmed' &&
      (e.lifecycle || 'Active') === 'Active' &&
      e.date >= localToday(data.settings || {}),
  );
  const count = (e: (typeof events)[number]) =>
    templates.filter((t) =>
      appliesTo(
        t,
        e.items.map((p) => p.id),
      ),
    ).length;
  return (
    <Dialog open onOpenChange={(v) => !busy && !v && onClose()}>
      <DialogContent className="crm-dialog manage-editor-dialog">
        <DialogHeader>
          <DialogTitle>
            {reset
              ? 'Reset booking checklists'
              : 'Apply / synchronize checklist'}{' '}
            · {category.name}
          </DialogTitle>
          <DialogDescription>
            {reset
              ? 'Replace this category on selected upcoming bookings. Its checked status and booking-specific changes will be cleared. Other checklists stay intact.'
              : 'Add matching items and update previously applied copies. Checked items keep their completion status.'}
          </DialogDescription>
        </DialogHeader>
        <p>
          Items are selected using each template’s package rules. Set packages
          on the templates before applying them.
        </p>
        <SToggle
          label="Select all upcoming bookings"
          value={events.length > 0 && events.every((e) => ids.includes(e.id))}
          onChange={(v) => setIds(v ? events.map((e) => e.id) : [])}
        />
        <div className="form-stack">
          {events.map((e) => (
            <SToggle
              key={e.id}
              label={`${e.title} · ${prettyDate(e.date)} · ${count(e)} matching items`}
              value={ids.includes(e.id)}
              onChange={(v) =>
                setIds(v ? [...ids, e.id] : ids.filter((id) => id !== e.id))
              }
            />
          ))}
        </div>
        {!events.length && (
          <p className="muted">No upcoming confirmed bookings.</p>
        )}
        {reset && (
          <SField
            label="Type RESET to confirm"
            value={confirm}
            onChange={setConfirm}
          />
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="primary"
          disabled={busy || !ids.length || (reset && confirm !== 'RESET')}
          onClick={async () => {
            if (
              await onSubmit({
                action: reset
                  ? 'reset_checklist_category'
                  : 'apply_checklist_category',
                categoryId: category.id,
                eventIds: ids,
                confirm,
              })
            )
              onClose();
          }}
        >
          {busy
            ? 'Saving…'
            : reset
              ? 'Reset selected bookings'
              : 'Apply / synchronize selected bookings'}
        </button>
      </DialogContent>
    </Dialog>
  );
}
