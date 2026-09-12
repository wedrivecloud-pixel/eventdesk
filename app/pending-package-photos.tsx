'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';

type PendingPhoto = { id: string; file: File; preview: string };

export function usePendingPackagePhotos() {
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const urls = useRef(new Set<string>());
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current.clear();
    },
    [],
  );

  function add(files: File[], savedCount: number) {
    if (photos.length + savedCount + files.length > 10)
      throw new Error('Each package can have up to 10 photos.');
    if (
      files.some(
        (file) =>
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
          !file.size ||
          file.size > 5 * 1024 * 1024,
      )
    )
      throw new Error('Choose a PNG, JPEG or WebP under 5 MB.');
    const added = files.map((file) => {
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      return { id: crypto.randomUUID(), file, preview };
    });
    setPhotos((previous) => [...previous, ...added]);
  }
  function remove(id: string) {
    const photo = photos.find((p) => p.id === id);
    if (photo) {
      URL.revokeObjectURL(photo.preview);
      urls.current.delete(photo.preview);
    }
    setPhotos((previous) => previous.filter((p) => p.id !== id));
  }
  function makePrimary(id: string) {
    setPhotos((previous) => [
      ...previous.filter((p) => p.id === id),
      ...previous.filter((p) => p.id !== id),
    ]);
  }
  return { photos, add, remove, makePrimary };
}

export function PendingPackagePhotos({
  queue,
  savedCount,
  disabled,
}: {
  queue: ReturnType<typeof usePendingPackagePhotos>;
  savedCount: number;
  disabled: boolean;
}) {
  const [error, setError] = useState('');
  return (
    <section className="package-photo-section" aria-label="Photos to save">
      <h3>{savedCount ? 'Photos waiting to save' : 'Package images'}</h3>
      <p className="muted">
        Choose photos now. They upload when you save the package. Up to 10 ·
        PNG, JPEG or WebP · 5 MB each.
      </p>
      <div className="package-photo-grid">
        {queue.photos.map((photo, index) => (
          <div className="package-photo" key={photo.id}>
            <img
              src={photo.preview}
              alt={`Selected package photo: ${photo.file.name}`}
            />
            <div>
              <span className="pill">
                {!savedCount && index === 0
                  ? 'Primary image'
                  : `Photo ${savedCount + index + 1}`}
              </span>
              <div className="photo-actions">
                {!savedCount && index > 0 && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={disabled}
                    onClick={() => queue.makePrimary(photo.id)}
                  >
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  className="text-button"
                  disabled={disabled}
                  aria-label={`Remove selected photo ${index + 1}`}
                  onClick={() => queue.remove(photo.id)}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <label className={`photo-upload ${disabled ? 'disabled' : ''}`}>
        <ImagePlus size={20} />
        {savedCount + queue.photos.length
          ? 'Add photos'
          : 'Choose primary image'}
        <input
          type="file"
          multiple
          aria-label="Choose package photos"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || savedCount + queue.photos.length >= 10}
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = '';
            setError('');
            try {
              queue.add(files, savedCount);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Unable to select photos.',
              );
            }
          }}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
