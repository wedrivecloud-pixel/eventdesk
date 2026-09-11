'use client';
import { useEffect, useState } from 'react';
import type { EventAttachment } from '@/lib/proposal';
import { SField, SToggle, SChoice } from './sales-ui';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
export function EventAttachments({
  eventId,
  readOnly = false,
}: {
  eventId: string;
  readOnly?: boolean;
}) {
  const [files, setFiles] = useState<EventAttachment[]>([]),
    [editing, setEditing] = useState<EventAttachment | null>(null),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(''),
    [kind, setKind] = useState('Document'),
    [url, setUrl] = useState(''),
    [remove, setRemove] = useState<EventAttachment | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch('/api/event-attachments?event=' + encodeURIComponent(eventId))
      .then(async (r) => {
        const j = (await r.json()) as {
          files: EventAttachment[];
          error?: string;
        };
        if (!r.ok) throw Error(j.error);
        return j;
      })
      .then((j) => {
        if (active) setFiles(j.files);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);
  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/event-attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, eventId }),
        }),
        j = (await r.json()) as { files: EventAttachment[]; error?: string };
      if (!r.ok) throw Error(j.error);
      setFiles(j.files);
      setEditing(null);
      setCreating(false);
      setRemove(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="proposal-actions">
        <h3>Proposal attachments</h3>
        <button
          className="primary"
          disabled={readOnly || busy}
          onClick={() => {
            setCreating(true);
            setEditing(null);
            setName('');
            setUrl('');
          }}
        >
          Add attachment
        </button>
      </div>
      <p className="muted">
        Add a document or website link. New attachments stay private until you
        allow customers to see them.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <output>Loading attachments…</output>
      ) : (
        !files.length && <p className="proposal-empty">No attachments yet.</p>
      )}
      {files.map((f) => (
        <div className="proposal-attachment" key={f.id}>
          <div>
            <a
              href={
                f.kind === 'Link'
                  ? f.url
                  : '/api/event-attachments?event=' +
                    encodeURIComponent(eventId) +
                    '&id=' +
                    encodeURIComponent(f.id)
              }
              target="_blank"
              rel="noreferrer"
            >
              {f.name}
            </a>
            <small>
              {f.kind}
              {f.size ? ' · ' + Math.ceil(f.size / 1024) + ' KB' : ''} ·{' '}
              {f.clientView ? 'Visible to customers' : 'Private'}
              {f.staffView ? ' · Staff visible' : ''}
            </small>
          </div>
          <div className="proposal-actions">
            <button
              className="secondary"
              disabled={busy || readOnly}
              onClick={() => {
                setEditing({ ...f });
                setCreating(false);
              }}
            >
              Edit
            </button>
            <button
              className="text-button"
              disabled={busy || readOnly}
              onClick={() => setRemove(f)}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      {creating && (
        <div className="proposal-card proposal-editor form-stack">
          <SField
            label="Attachment name"
            value={name}
            onChange={setName}
            max={200}
          />
          <SChoice
            label="Kind"
            value={kind}
            onChange={setKind}
            options={['Document', 'Link']}
          />
          {kind === 'Link' ? (
            <>
              <SField
                label="Website link"
                value={url}
                onChange={setUrl}
                max={2000}
              />
              <button
                className="primary"
                disabled={busy || !name || !url}
                onClick={() => void run({ action: 'add_link', name, url })}
              >
                Save link
              </button>
            </>
          ) : (
            <>
              <p>PDF, PNG or JPEG · maximum 5 MB.</p>
              <input
                type="file"
                aria-label="Upload proposal attachment"
                accept="application/pdf,image/png,image/jpeg"
                disabled={busy || !name.trim()}
                onChange={async (ev) => {
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  setError('');
                  try {
                    if (file.size > 5 * 1024 * 1024)
                      throw Error('Files must be under 5 MB.');
                    const q = new URLSearchParams({
                        event: eventId,
                        name,
                        filename: file.name,
                      }),
                      r = await fetch('/api/event-attachments?' + q, {
                        method: 'PUT',
                        headers: { 'Content-Type': file.type },
                        body: file,
                      }),
                      j = (await r.json()) as {
                        files: EventAttachment[];
                        error?: string;
                      };
                    if (!r.ok) throw Error(j.error);
                    setFiles(j.files);
                    setCreating(false);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Upload failed.');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setCreating(false)}
          >
            Cancel
          </button>
        </div>
      )}
      {editing && (
        <form
          className="proposal-card proposal-editor form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ action: 'update', ...editing });
          }}
        >
          <SField
            label="Attachment name"
            value={editing.name}
            onChange={(name) => setEditing({ ...editing, name })}
            max={200}
            required
          />
          {editing.kind === 'Link' && (
            <SField
              label="Website link"
              value={editing.url}
              onChange={(url) => setEditing({ ...editing, url })}
              max={2000}
              required
            />
          )}
          <SToggle
            label="Allow staff to see this attachment"
            value={editing.staffView}
            onChange={(staffView) => setEditing({ ...editing, staffView })}
          />
          <SToggle
            label="Allow customers to see this attachment"
            value={editing.clientView}
            onChange={(clientView) => setEditing({ ...editing, clientView })}
          />
          <p className="muted">
            Customer-visible attachments appear on the client proposal and
            invoice. Staff visibility is saved for staff access when connected.
          </p>
          <button className="primary" disabled={busy}>
            Save attachment
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setEditing(null)}
          >
            Cancel
          </button>
        </form>
      )}
      <AlertDialog
        open={!!remove}
        onOpenChange={(v) => {
          if (!v && !busy) setRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the proposal and disables its download link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() =>
                remove &&
                void run({
                  action: 'remove',
                  id: remove.id,
                  updatedAt: remove.updatedAt,
                })
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
