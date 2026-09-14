'use client';

import { useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import {
  money,
  prettyDate,
  type Data,
  type EventRecord,
  type Payment,
} from '@/lib/crm';
import './payment-void.css';

export function PaymentVoidAudit({ payment }: { payment: Payment }) {
  return (
    <div className="payment-void-audit">
      <strong>Voided</strong>
      <span>{payment.void_reason}</span>
      <small>
        By {payment.voided_by_name || 'Business owner'} ·{' '}
        {payment.voided_at ? new Date(payment.voided_at).toLocaleString() : ''}
      </small>
    </div>
  );
}

export function VoidPaymentButton({
  payment,
  event,
  data,
  onData,
  disabled = false,
}: {
  payment: Payment;
  event: EventRecord;
  data: Data;
  onData: (data: Data) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false);
  const paid = (data.payments || [])
    .filter((p) => p.event_id === event.id)
    .reduce((sum, p) => sum + p.amount, 0);
  if (payment.voided_at) return null;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending.current) setOpen(value);
      }}
    >
      <button
        type="button"
        className="secondary payment-void-trigger"
        disabled={disabled}
        onClick={() => {
          setReason('');
          setError('');
          setOpen(true);
        }}
      >
        Void payment
      </button>
      <AlertDialogContent className="payment-void-dialog">
        <AlertDialogTitle>Void this recorded payment?</AlertDialogTitle>
        <AlertDialogDescription>
          This corrects your records and keeps the original entry in the payment
          history. It does not refund or transfer money.
        </AlertDialogDescription>
        <div className="payment-void-summary">
          <strong>{event.title}</strong>
          <span>
            {money(payment.amount)}
            {payment.tip ? ` + ${money(payment.tip)} tip` : ''} ·{' '}
            {payment.method}
          </span>
          <span>Received {prettyDate(payment.date)}</span>
          {payment.reference && <span>Reference: {payment.reference}</span>}
          {payment.created_at && (
            <small>
              Recorded {new Date(payment.created_at).toLocaleString()}
            </small>
          )}
          <strong>
            Balance after correction:{' '}
            {money(event.total - paid + payment.amount)}
          </strong>
        </div>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending.current || !reason.trim()) return;
            pending.current = true;
            setBusy(true);
            setError('');
            try {
              const response = await fetch('/api/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'void_payment',
                  eventId: event.id,
                  paymentId: payment.id,
                  reason: reason.trim(),
                }),
              });
              const result = (await response.json()) as Data & {
                error?: string;
              };
              if (!response.ok)
                throw new Error(result.error || 'Unable to void payment.');
              onData(result);
              setOpen(false);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Unable to void payment.',
              );
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          <label className="field">
            <span>Reason for voiding</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={500}
              rows={3}
              disabled={busy}
              placeholder="For example, recorded twice by mistake"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="payment-void-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary payment-void-confirm"
              disabled={busy || !reason.trim()}
            >
              {busy ? 'Voiding…' : 'Confirm void'}
            </button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
