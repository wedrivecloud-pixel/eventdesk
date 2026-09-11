'use client';
/* oxlint-disable next/no-img-element -- Saved client artwork is served by the scoped media endpoint. */
import { useState } from 'react';
import type { FormField } from '@/lib/manage-config';
export function QuestionInput({
  field: q,
  value,
  onChange,
  answers = {},
  uploadContext,
  preview = false,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  answers?: Record<string, string>;
  uploadContext?: { packageId?: string; formId?: string; eventId?: string };
  preview?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (
    q.conditionField &&
    (answers[q.conditionField] || '') !== q.conditionValue
  )
    return null;
  if (q.type === 'Separator') return <hr />;
  if (['Header', 'Subheader'].includes(q.type)) return <h3>{q.label}</h3>;
  if (['Plain Text', 'Rich Text'].includes(q.type))
    return <p style={{ whiteSpace: 'pre-wrap' }}>{q.label}</p>;
  if (q.type === 'Static Image')
    return q.label.startsWith('https://') ? (
      <img style={{ maxWidth: '100%' }} src={q.label} alt={q.hint} />
    ) : (
      <p>{q.label}</p>
    );
  const label = q.label + (q.required ? ' *' : '');
  const multiple =
    ['Double Text Field', 'Triple Text Field', 'Quadruple Text Field'].indexOf(
      q.type,
    ) + 2;
  async function upload(file?: File) {
    if (!file || !uploadContext) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch(
          '/api/question-file?' +
            new URLSearchParams({
              ...uploadContext,
              field: q.id,
              name: file.name,
            }),
          { method: 'PUT', body: file, headers: { 'Content-Type': file.type } },
        ),
        j = (await r.json()) as { id: string; error?: string };
      if (!r.ok) throw Error(j.error || 'Upload failed.');
      onChange(j.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="field cb-field">
      <label htmlFor={'question-' + q.id}>{label}</label>
      {q.type === 'Dropdown' ? (
        <select
          id={'question-' + q.id}
          required={q.required && !preview}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose…</option>
          {q.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : ['Radio Buttons', 'Checkbox Group'].includes(q.type) ? (
        <fieldset>
          <legend className="sr-only">{label}</legend>
          {q.options.map((o) => (
            <label
              key={o}
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <input
                type={q.type === 'Radio Buttons' ? 'radio' : 'checkbox'}
                name={'q-' + q.id}
                value={o}
                checked={
                  q.type === 'Radio Buttons'
                    ? value === o
                    : value.split('\n').includes(o)
                }
                onChange={(e) =>
                  onChange(
                    q.type === 'Radio Buttons'
                      ? o
                      : (e.target.checked
                          ? [...value.split('\n').filter(Boolean), o]
                          : value.split('\n').filter((v) => v !== o)
                        ).join('\n'),
                  )
                }
              />
              {o}
            </label>
          ))}
        </fieldset>
      ) : q.type === 'Checkbox' ? (
        <label style={{ display: 'flex', gap: 8 }}>
          <input
            id={'question-' + q.id}
            type="checkbox"
            required={q.required && !preview}
            checked={value === 'Yes'}
            onChange={(e) => onChange(e.target.checked ? 'Yes' : '')}
          />
          Yes
        </label>
      ) : ['File Upload Field', 'Image Upload Field'].includes(q.type) ? (
        <>
          <input
            id={'question-' + q.id}
            type="file"
            disabled={busy || !uploadContext}
            accept={
              q.type === 'Image Upload Field'
                ? 'image/png,image/jpeg,image/webp'
                : 'image/png,image/jpeg,image/webp,application/pdf'
            }
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <small>
            {busy
              ? 'Uploading…'
              : value
                ? 'File attached.'
                : uploadContext
                  ? 'PNG, JPEG, WebP or PDF, up to 10 MB.'
                  : 'Uploads are available on the actual form.'}
          </small>
          {value && uploadContext?.eventId && (
            <a
              href={'/api/question-file?id=' + encodeURIComponent(value)}
              target="_blank"
              rel="noreferrer"
            >
              View attached file
            </a>
          )}
          {error && <p role="alert">{error}</p>}
        </>
      ) : multiple > 1 ? (
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: multiple }, (_, i) => (
            <input
              key={i}
              aria-label={
                q.placeholder.includes('|')
                  ? label + ' — ' + q.placeholder.split('|')[i]?.trim()
                  : label + ' ' + (i + 1)
              }
              required={q.required && !preview}
              value={value.split('\n')[i] || ''}
              maxLength={1000}
              placeholder={
                q.placeholder.includes('|')
                  ? q.placeholder.split('|')[i]?.trim()
                  : q.placeholder
              }
              onChange={(e) => {
                const a = Array.from(
                  { length: multiple },
                  (_, n) => value.split('\n')[n] || '',
                );
                a[i] = e.target.value;
                onChange(a.join('\n'));
              }}
            />
          ))}
        </div>
      ) : ['Text Box', 'Song List'].includes(q.type) || q.repeat ? (
        <textarea
          id={'question-' + q.id}
          required={q.required && !preview}
          value={value}
          maxLength={4000}
          placeholder={q.placeholder}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={'question-' + q.id}
          required={q.required && !preview}
          type={
            q.type === 'Date Field'
              ? 'date'
              : q.type === 'Time Field'
                ? 'time'
                : q.type === 'Color Picker'
                  ? 'color'
                  : q.type.includes('Playlist')
                    ? 'url'
                    : 'text'
          }
          value={value}
          maxLength={4000}
          placeholder={q.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {['Song', 'Song List'].includes(q.type) && q.options.length > 0 && (
        <div className="questionnaire-song-suggestions">
          <span>Song suggestions</span>
          {q.options.filter(Boolean).map((song) => (
            <button
              key={song}
              type="button"
              className="secondary"
              onClick={() =>
                onChange(
                  q.type === 'Song List'
                    ? [
                        ...new Set([
                          ...value.split('\n').filter(Boolean),
                          song,
                        ]),
                      ].join('\n')
                    : song,
                )
              }
            >
              {song}
            </button>
          ))}
          <small>You can also enter any song and artist.</small>
        </div>
      )}
      {q.hint && <small>{q.hint}</small>}
      {q.repeat && <small>Enter one answer per line.</small>}
      {q.timeline && q.type !== 'Time Field' && (
        <small>Include the time alongside your answer.</small>
      )}
    </div>
  );
}
