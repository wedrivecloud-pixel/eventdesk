'use client';
import { useState } from 'react';
import { QrCode } from 'lucide-react';

export function LinkQR({ href }: { href: string }) {
  const [image, setImage] = useState<{ href: string; src: string }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function generate() {
    setBusy(true);
    setError('');
    try {
      const QRCode = await import('qrcode');
      const src = await QRCode.toDataURL(href, {
        errorCorrectionLevel: 'M',
        width: 256,
        margin: 4,
      });
      setImage({ href, src });
    } catch {
      setError('Unable to generate the QR code. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="booking-link-qr">
      <button
        type="button"
        className="text-button"
        disabled={!href || busy}
        onClick={() => void generate()}
      >
        <QrCode size={16} /> {busy ? 'Generating…' : 'Generate QR code'}
      </button>
      {image?.href === href && (
        <figure>
          <img
            src={image.src}
            width={256}
            height={256}
            alt="QR code for this booking link"
          />
          <figcaption>
            <a href={image.src} download="eventdesk-booking-qr.png">
              Download QR code
            </a>
          </figcaption>
        </figure>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
