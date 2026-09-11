'use client';
import { useState } from 'react';
import type { Data, EventRecord } from '@/lib/crm';
import type { BookingDesignCollection } from '@/lib/design-collections';
import { SChoice } from './sales-ui';
import { QuestionInput } from './question-input';
import { DesignPreview } from './design-collections';
import type { Save } from './forms';
export function BookingDesigns({
  event,
  onSave,
  busy,
}: {
  event: EventRecord;
  data: Data;
  onSave: Save;
  busy: boolean;
}) {
  return (
    <div className="form-stack">
      <h3>Design collections</h3>
      {(event.operations?.designCollections || []).map((c) => (
        <BookingDesign
          key={c.collectionId + JSON.stringify(c)}
          collection={c}
          eventId={event.id}
          onSave={onSave}
          busy={busy}
        />
      ))}
      {!event.operations?.designCollections?.length && (
        <p className="muted">
          Matching collections are added when a booking is confirmed. For
          existing bookings, use Manage → Design Collections → Sync.
        </p>
      )}
    </div>
  );
}
function BookingDesign({
  collection: c,
  eventId,
  onSave,
  busy,
}: {
  collection: BookingDesignCollection;
  eventId: string;
  onSave: Save;
  busy: boolean;
}) {
  const [id, setId] = useState(c.selectedId),
    [answers, setAnswers] = useState(c.answers);
  const choices = [...c.templates];
  if (c.selectedTemplate && !choices.some((t) => t.id === c.selectedId))
    choices.push(c.selectedTemplate);
  const selected = choices.find((t) => t.id === id);
  return (
    <form
      className="manage-section form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          action: 'save_design_choice',
          eventId,
          collectionId: c.collectionId,
          templateId: id,
          answers,
        });
      }}
    >
      <h4>{c.name}</h4>
      <SChoice
        label={'Template for ' + c.name}
        value={id}
        options={[
          { value: '', label: 'No selection' },
          ...choices.map((t) => ({
            value: t.id,
            label:
              t.name +
              (c.templates.some((x) => x.id === t.id)
                ? ''
                : ' (previous selection)'),
          })),
        ]}
        onChange={setId}
      />
      {selected && (
        <div className="booking-design-preview">
          <DesignPreview item={selected} />
        </div>
      )}
      {c.fields.map((q) => (
        <QuestionInput
          key={q.id}
          field={q}
          value={answers[q.id] || ''}
          answers={answers}
          onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
          uploadContext={{ eventId }}
        />
      ))}
      <button className="primary" disabled={busy}>
        Save Design Choice
      </button>
    </form>
  );
}
