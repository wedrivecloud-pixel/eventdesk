'use client';
import { useEffect, useState } from 'react';
import type { Data } from '@/lib/crm';
export function SalesFiles({ id }: { id: string; data: Data }) {
  const [files, setFiles] = useState<
      { id: string; filename: string; size: number }[]
    >([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/sales/files?record=' + encodeURIComponent(id))
      .then((r) => {
        if (!r.ok) throw Error('Unable to load attachments.');
        return r.json() as Promise<{
          files: { id: string; filename: string; size: number }[];
        }>;
      })
      .then((r) => {
        if (active) setFiles(r.files);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <section className="sales-attachments">
      <h3>Attachments</h3>
      <p className="muted">
        PDF, PNG or JPEG, up to 5 MB each. Receipts stay private to this
        workspace.
      </p>
      {files.map((f) => (
        <a
          key={f.id}
          className="record-link"
          href={'/api/sales/files?id=' + encodeURIComponent(f.id)}
          download
        >
          {f.filename} · {Math.ceil(f.size / 1024)} KB
        </a>
      ))}
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        aria-label="Upload expense attachment"
        disabled={busy}
        onChange={async (ev) => {
          const file = ev.target.files?.[0];
          if (!file) return;
          setError('');
          setBusy(true);
          try {
            if (file.size > 5 * 1024 * 1024)
              throw Error('Files must be under 5 MB.');
            const r = await fetch(
                `/api/sales/files?record=${encodeURIComponent(id)}&name=${encodeURIComponent(file.name)}`,
                {
                  method: 'PUT',
                  headers: { 'Content-Type': file.type },
                  body: file,
                },
              ),
              value = (await r.json()) as {
                error?: string;
                files: { id: string; filename: string; size: number }[];
              };
            if (!r.ok) throw Error(value.error);
            setFiles(value.files);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed.');
          } finally {
            setBusy(false);
            ev.target.value = '';
          }
        }}
      />
      {busy && <p role="status">Uploading…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
