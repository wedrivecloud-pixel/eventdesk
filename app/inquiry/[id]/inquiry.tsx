'use client';
import { useState, useRef, type FormEvent } from 'react';
import type { FormField, LeadField } from '@/lib/manage-config';
import { QuestionInput } from '../../question-input';
import { WidgetFrame } from '../../widget-frame';
import { widgetDefaults, type WidgetOptions } from '@/lib/website-integration';
export default function Inquiry({
  initial: i,
  widget = widgetDefaults(),
}: {
  widget?: WidgetOptions;
  initial: {
    id: string;
    name: string;
    business: { id: string; name: string; color: string };
    fields: LeadField[];
    questions: FormField[];
    packages: { id: string; name: string }[];
    button: string;
    privacy: { url: string; text: string; required: boolean };
  };
}) {
  const [values, setValues] = useState<Record<string, string>>({}),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [consent, setConsent] = useState(false),
    [trap, setTrap] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState('');
  const id = useRef('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (!id.current) id.current = crypto.randomUUID();
      const r = await fetch('/api/inquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formId: i.id,
            requestId: id.current,
            values,
            answers,
            consent,
            companyWebsite: trap,
          }),
        }),
        j = (await r.json()) as {
          message: string;
          redirect?: string;
          error?: string;
        };
      if (!r.ok) throw Error(j.error || 'Unable to send inquiry.');
      setReceipt(j.message);
      if (j.redirect) window.location.assign(j.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send inquiry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <WidgetFrame options={widget}>
      <main
        style={{
          fontFamily: 'inherit',
          margin: 0,
          color: 'inherit',
        }}
      >
        {!widget.embed && <p>{i.business.name}</p>}
        <h1>{i.name}</h1>
        {receipt ? (
          <div role="status">
            <h2>Inquiry received</h2>
            <p>{receipt}</p>
            <a href={'/reservation/start?business=' + i.business.id}>
              Browse packages
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="form-stack">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {i.fields
                .filter((f) => f.display !== 'Hidden')
                .map((f) => (
                  <label
                    className="field"
                    key={f.key}
                    style={{
                      flex: f.width === '100%' ? '1 1 100%' : '1 1 280px',
                    }}
                  >
                    <span
                      className={
                        widget.placeholders &&
                        !['packageId', 'date', 'time'].includes(f.key)
                          ? 'widget-sr-only'
                          : 'widget-label'
                      }
                    >
                      {f.label}
                      {f.display === 'Required' ? ' *' : ''}
                    </span>
                    {f.key === 'packageId' ? (
                      <select
                        required={f.display === 'Required'}
                        value={values[f.key] || ''}
                        onChange={(e) =>
                          setValues({ ...values, [f.key]: e.target.value })
                        }
                      >
                        <option value="">Choose a package</option>
                        {i.packages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : f.key === 'notes' ? (
                      <textarea
                        placeholder={
                          widget.placeholders
                            ? f.label + (f.display === 'Required' ? ' *' : '')
                            : undefined
                        }
                        rows={5}
                        required={f.display === 'Required'}
                        value={values[f.key] || ''}
                        maxLength={3000}
                        onChange={(e) =>
                          setValues({ ...values, [f.key]: e.target.value })
                        }
                      />
                    ) : (
                      <input
                        placeholder={
                          widget.placeholders
                            ? f.label + (f.display === 'Required' ? ' *' : '')
                            : undefined
                        }
                        type={
                          f.key === 'email'
                            ? 'email'
                            : f.key === 'date'
                              ? 'date'
                              : f.key === 'time'
                                ? 'time'
                                : ['guests', 'hours', 'budget'].includes(f.key)
                                  ? 'number'
                                  : 'text'
                        }
                        required={f.display === 'Required'}
                        maxLength={500}
                        value={values[f.key] || ''}
                        onChange={(e) =>
                          setValues({ ...values, [f.key]: e.target.value })
                        }
                      />
                    )}
                  </label>
                ))}
            </div>
            {i.questions.map((q) => (
              <QuestionInput
                key={q.id}
                field={q}
                value={answers[q.id] || ''}
                answers={answers}
                uploadContext={{ formId: i.id }}
                onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
              />
            ))}
            <label
              style={{ position: 'absolute', left: -10000 }}
              aria-hidden="true"
            >
              Company website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
              />
            </label>
            {i.privacy.required && (
              <label>
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />{' '}
                {i.privacy.text || 'I agree to the privacy policy.'}{' '}
                {i.privacy.url && (
                  <a href={i.privacy.url} target="_blank" rel="noreferrer">
                    Privacy policy
                  </a>
                )}
              </label>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button type="submit" className="widget-button" disabled={busy}>
              {busy ? 'Sending…' : i.button}
            </button>
            <small>Your inquiry is sent to the business for review.</small>
          </form>
        )}
      </main>
    </WidgetFrame>
  );
}
