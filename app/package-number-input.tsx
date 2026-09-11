'use client';
import { useState, type ComponentProps } from 'react';

/** Keep the text being edited separate from the saved numeric value. */
export function PackageNumberInput({
  value,
  onValueChange,
  ...props
}: Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'onBlur' | 'onFocus'
> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string>();
  return (
    <input
      {...props}
      type="number"
      value={draft ?? value}
      onFocus={(e) => {
        if (e.currentTarget.value === '0') e.currentTarget.select();
      }}
      onChange={(e) => {
        const input = e.currentTarget;
        setDraft(input.value);
        if (!input.validity.badInput) {
          onValueChange(input.value === '' ? 0 : Number(input.value));
        }
      }}
      onBlur={(e) => {
        // Normalize a completed number (or an empty zero) only after editing.
        // Keep invalid input visible so native form validation can explain it.
        if (
          e.currentTarget.validity.valid ||
          (e.currentTarget.value === '' && !e.currentTarget.validity.badInput)
        ) {
          setDraft(undefined);
        }
      }}
    />
  );
}
