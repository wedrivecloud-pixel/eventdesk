'use client';
import { useState } from 'react';
import { ArrowLeft, ClipboardList, Eye, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  questionnaireSamples,
  questionnaireFromSample,
  planningQuestionnaire,
  type QuestionnaireSample,
} from '@/lib/questionnaire-samples';
import { details, type FormField } from '@/lib/manage-config';
import { visibleQuestion } from '@/lib/manage-questions';
import type { Resource } from '@/lib/settings';
import { SField, STabs } from './sales-ui';
import { QuestionInput } from './question-input';

export function PlanningQuestionnaireStarter({
  onUse,
  onPreview,
}: {
  onUse: (resource: Resource) => void;
  onPreview: (resource: Resource) => void;
}) {
  return (
    <article className="questionnaire-planning-starter">
      <ClipboardList size={26} aria-hidden="true" />
      <div>
        <span className="questionnaire-starter-label">
          Ready-to-use sample · 6 questions
        </span>
        <h3>Planning Questionnaire</h3>
        <p>{planningQuestionnaire.description}</p>
      </div>
      <div className="questionnaire-library-actions">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onPreview(questionnaireFromSample(planningQuestionnaire))
          }
          aria-label="Preview Planning Questionnaire"
        >
          <Eye size={16} />
          Preview
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => onUse(questionnaireFromSample(planningQuestionnaire))}
        >
          Use Planning Questionnaire
        </button>
      </div>
    </article>
  );
}

export function QuestionnairePreview({
  fields,
  tabs,
}: {
  fields: FormField[];
  tabs: string[];
}) {
  const [tab, setTab] = useState(tabs[0] || 'General');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <div className="questionnaire-preview">
      <p className="capability-note">
        Interactive preview. Answers entered here are not saved.
      </p>
      {tabs.length > 1 && <STabs tabs={tabs} value={tab} onChange={setTab} />}
      <div className="form-stack">
        {fields
          .filter((f) => f.tab === tab && visibleQuestion(f, fields, answers))
          .map((f) => (
            <QuestionInput
              key={f.id}
              field={f}
              value={answers[f.id] || ''}
              answers={answers}
              preview
              onChange={(v) =>
                setAnswers((previous) => ({ ...previous, [f.id]: v }))
              }
            />
          ))}
        {!fields.some((f) => f.tab === tab) && (
          <p className="muted">This tab has no questions yet.</p>
        )}
      </div>
    </div>
  );
}

export function QuestionnairePreviewDialog({
  resource,
  onClose,
}: {
  resource: Resource;
  onClose: () => void;
}) {
  const d = details(resource);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="crm-dialog manage-editor-dialog">
        <DialogHeader>
          <DialogTitle>{resource.name}</DialogTitle>
          <DialogDescription>Questionnaire preview</DialogDescription>
        </DialogHeader>
        <QuestionnairePreview fields={d.fields} tabs={d.tabs} />
      </DialogContent>
    </Dialog>
  );
}

export function QuestionnaireLibrary({
  onClose,
  onUse,
  onCreate,
}: {
  onClose: () => void;
  onUse: (r: Resource) => void;
  onCreate: (name: string) => void;
}) {
  const [sample, setSample] = useState<QuestionnaireSample>();
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const matches = questionnaireSamples.filter((s) =>
    `${s.name} ${s.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="crm-dialog manage-editor-dialog questionnaire-library">
        <DialogHeader>
          <DialogTitle>
            {sample ? sample.name : 'New Questionnaire Template'}
          </DialogTitle>
          <DialogDescription>
            {sample
              ? sample.description
              : 'Create your own questionnaire or start with an editable Eventdeskly sample.'}
          </DialogDescription>
        </DialogHeader>
        {sample ? (
          <>
            <div className="questionnaire-library-actions">
              <button
                className="secondary"
                onClick={() => setSample(undefined)}
              >
                <ArrowLeft size={16} /> Back to samples
              </button>
              <button
                className="primary"
                onClick={() => onUse(questionnaireFromSample(sample))}
              >
                Use this sample
              </button>
            </div>
            {sample.staffOnly && (
              <p className="capability-note">
                Staff only by default. Client viewing and editing are turned
                off.
              </p>
            )}
            <QuestionnairePreview
              key={sample.id}
              fields={sample.fields}
              tabs={[...new Set(sample.fields.map((f) => f.tab))]}
            />
          </>
        ) : (
          <>
            <section className="questionnaire-scratch">
              <div>
                <h3>Create from scratch</h3>
                <p>
                  Build a questionnaire with your own questions and sections.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (title.trim()) onCreate(title.trim());
                }}
              >
                <SField
                  label="Template title"
                  value={title}
                  onChange={setTitle}
                  required
                  max={120}
                />
                <button type="submit" className="primary">
                  <Plus size={16} /> Create template
                </button>
              </form>
            </section>
            <div className="panel-heading">
              <div>
                <h3>Eventdeskly samples</h3>
                <p className="muted">
                  Preview a sample, then customize and save a copy to your
                  templates.
                </p>
              </div>
              <span className="questionnaire-count">
                {questionnaireSamples.length} samples
              </span>
            </div>
            <SField label="Find a sample" value={search} onChange={setSearch} />
            <div className="questionnaire-sample-grid">
              {matches.map((s) => (
                <article className="questionnaire-sample-card" key={s.id}>
                  <ClipboardList size={22} aria-hidden="true" />
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <small>
                    {new Set(s.fields.map((f) => f.tab)).size}{' '}
                    {new Set(s.fields.map((f) => f.tab)).size === 1
                      ? 'section'
                      : 'sections'}
                    {s.staffOnly ? ' · Staff only' : ''}
                    {s.showWhen === 'After event' ? ' · After event' : ''}
                  </small>
                  <div className="questionnaire-library-actions">
                    <button
                      className="secondary"
                      onClick={() => setSample(s)}
                      aria-label={'Preview ' + s.name}
                    >
                      <Eye size={15} /> Preview
                    </button>
                    <button
                      className="primary"
                      onClick={() => onUse(questionnaireFromSample(s))}
                      aria-label={'Use ' + s.name}
                    >
                      Use sample
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!matches.length && (
              <p className="muted">No samples match your search.</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
