'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function ProposalDiscountForm({
  appliedCode,
  busy,
  error,
  onApply,
}: {
  appliedCode: string;
  busy: boolean;
  error: string;
  onApply: (code: string) => void;
}) {
  const [code, setCode] = useState(appliedCode);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    setCode(appliedCode);
    setExpanded(false);
    if (formRef.current?.contains(document.activeElement))
      triggerRef.current?.focus();
  }, [appliedCode]);
  return (
    <form
      ref={formRef}
      className="proposal-discount-form"
      aria-label="Proposal discount"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim() && !busy) onApply(code);
      }}
    >
      {appliedCode && (
        <div className="proposal-discount-applied">
          <span>
            Applied: <strong>{appliedCode}</strong>
          </span>
          <button
            type="button"
            className="text-button"
            disabled={busy || !ready}
            onClick={() => onApply('')}
          >
            Remove code
          </button>
        </div>
      )}
      <Collapsible
        open={expanded}
        onOpenChange={(open) => { if (!busy) setExpanded(open); }}
      >
        <CollapsibleTrigger
          ref={triggerRef}
          type="button"
          className="proposal-discount-toggle"
          disabled={busy || !ready}
        >
          {appliedCode ? 'Change discount code' : 'Have a discount code?'}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="proposal-discount-entry">
            <label htmlFor="proposal-discount-code">Discount code</label>
            <div className="proposal-discount-controls">
              <input
                id="proposal-discount-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Enter your code"
                maxLength={80}
                autoCapitalize="characters"
                spellCheck={false}
                disabled={busy || !ready}
                aria-describedby="proposal-discount-help"
              />
              <button className="primary" disabled={busy || !ready || !code.trim()}>
                {busy ? 'Updating…' : 'Apply code'}
              </button>
            </div>
            <p id="proposal-discount-help">
              One code per proposal. Eligible discounts update your total and balance.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
