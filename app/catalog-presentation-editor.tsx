'use client';
import { useState } from 'react';
import type { Data } from '@/lib/crm';
import type { CatalogPresentation } from '@/lib/catalog-presentation';
export function CatalogPresentationEditor({
  value,
  onChange,
  scope,
  data,
  onData,
  busy,
  onBusy,
}: {
  value: CatalogPresentation;
  onChange: (value: CatalogPresentation) => void;
  scope?: { service: string; group?: string };
  data: Data;
  onData: (data: Data) => void;
  busy: boolean;
  onBusy: (value: boolean) => void;
}) {
  const [error, setError] = useState('');
  const record =
    scope &&
    data.resources?.find(
      (r) =>
        !r.archived &&
        (scope.group === undefined
          ? r.kind === 'service_settings' && r.name === scope.service
          : r.kind === 'package_groups' &&
            r.name === scope.group &&
            r.data.service === scope.service),
    );
  async function upload(file?: File) {
    if (!scope) return;
    setError('');
    onBusy(true);
    try {
      if (
        file &&
        (file.size > 5 * 1024 * 1024 ||
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
      )
        throw Error('Choose a PNG, JPEG or WebP image under 5 MB.');
      const r = await fetch(
        '/api/catalog-image?' + new URLSearchParams(scope),
        {
          method: file ? 'PUT' : 'DELETE',
          ...(file
            ? { headers: { 'Content-Type': file.type }, body: file }
            : {}),
        },
      );
      const result = (await r.json()) as Data & { error?: string };
      if (!r.ok) throw Error(result.error);
      onData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update image.');
    } finally {
      onBusy(false);
    }
  }
  return (
    <fieldset className="catalog-presentation-editor" disabled={busy}>
      <legend>Booking page</legend>
      <label className="bulk-toggle-label">
        <input
          type="checkbox"
          checked={value.showTitle}
          onChange={(e) => onChange({ ...value, showTitle: e.target.checked })}
        />{' '}
        Show name on the booking page
      </label>
      <label className="field">
        <span>Subheader</span>
        <textarea
          maxLength={500}
          rows={2}
          value={value.subheader}
          onChange={(e) => onChange({ ...value, subheader: e.target.value })}
        />
      </label>
      <div className="field">
        <span>Primary image</span>
        {record?.data.imageId && (
          <div className="catalog-image-preview">
            <img
              src={
                '/api/catalog-image?' +
                new URLSearchParams({
                  id: record.id,
                  v: String(record.data.imageId),
                })
              }
              alt="Current primary image"
            />
            <button
              type="button"
              className="text-button"
              onClick={() => void upload()}
            >
              Remove image
            </button>
          </div>
        )}
        {scope ? (
          <>
            <input
              aria-label="Upload primary image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = '';
              }}
            />
            <small>
              PNG, JPEG or WebP, up to 5 MB. Image changes save immediately.
            </small>
          </>
        ) : (
          <small>
            Save this new service or group, then edit it to upload an image.
          </small>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
