'use client';
import { useState } from 'react';
import { BookingDesigns } from './booking-designs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  money,
  prettyDate,
  type Data,
  type EventRecord,
  type LineItem,
} from '@/lib/crm';
import { calculateQuote, type Quote } from '@/lib/quote';
import { mergedSettings } from '@/lib/settings';
import { extraAvailable, appliesTo } from '@/lib/manage-config';
import {bookingQuestions} from '@/lib/manage-questions';
import { QuestionInput } from './question-input';
import {bookingVenueLines} from '@/lib/booking-venue';
import { messageValues, renderMessage } from '@/lib/message-preview';
import type { Save } from './forms';
export function QuoteBreakdown({ quote }: { quote?: Quote }) {
  return quote ? (
    <div className="quote-breakdown">
      {quote.extras.map((x) => (
        <div key={x.id}>
          <span>{x.name}</span>
          <b>{money(x.price)}</b>
        </div>
      ))}
      {quote.adjustment !== 0 && (
        <div>
          <span>Flexible pricing</span>
          <b>{money(quote.adjustment)}</b>
        </div>
      )}
      {quote.discount > 0 && (
        <div>
          <span>Discount · {quote.discountName}</span>
          <b>−{money(quote.discount)}</b>
        </div>
      )}
      {quote.tax > 0 && (
        <div>
          <span>{quote.taxLabel}</span>
          <b>{money(quote.tax)}</b>
        </div>
      )}
      {quote.travel > 0 && (
        <div>
          <span>Travel</span>
          <b>{money(quote.travel)}</b>
        </div>
      )}
      <small>Final balance due {prettyDate(quote.dueDate)}</small>
    </div>
  ) : null;
}
export function EventExtras({
  data,
  item,
  ids,
  date,
  pricedItems,
}: {
  pricedItems?: LineItem[];
  data: Data;
  item?: EventRecord;
  ids: string[];
  date: string;
}) {
  const old = item?.operations?.quote;
  const [addonIds, setAddonIds] = useState(old?.addonIds || []),
    [backdropId, setBackdropId] = useState(old?.backdropId || ''),
    [discountId, setDiscountId] = useState(old?.discountId || ''),
    [miles, setMiles] = useState(old?.miles || 0),
    [quantities, setQuantities] = useState(old?.addonQuantities || {}),
    [parents, setParents] = useState(old?.extraPackageIds || {}),
    [context, setContext] = useState(old?.context || {}),
    [bookingAnswers,setBookingAnswers]=useState(item?.operations?.bookingAnswers||{});
  const bookingFields=item?.operations?.bookingFields||bookingQuestions(data.resources||[],ids,true);
  const r = data.resources || [],
    s = mergedSettings(data.settings);
  const packages =
    pricedItems ??
    data.packages
      .filter((p) => ids.includes(p.id))
      .map((p) => item?.items.find((x) => x.id === p.id) || p);
  const included = [
    ...new Set(
      packages.flatMap(
        (p) =>
          ('packageSettings' in p ? p.packageSettings?.includedAddonIds : []) ||
          [],
      ),
    ),
  ];
  let quote: Quote | undefined,
    error = '';
  try {
    quote =
      item?.status === 'confirmed' && old
        ? old
        : calculateQuote(
            packages,
            r,
            s,
            {
              date: date || new Date().toISOString().slice(0, 10),
              addonIds,
              addonQuantities: quantities,
              extraPackageIds: parents,
              context,
              backdropId,
              discountId,
              miles,
            },
            old,
          );
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unable to estimate.';
  }
  function choose(
    label: string,
    kind: string,
    value: string,
    change: (v: string) => void,
  ) {
    return (
      <div className="field">
        <span>{label}</span>
        <Select
          value={value || 'none'}
          onValueChange={(v) => change(v === 'none' ? '' : String(v))}
          disabled={item?.status === 'confirmed'}
        >
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {r
              .filter(
                (x) =>
                  x.kind === kind &&
                  (!x.archived || old?.extras.some((e) => e.id === x.id)) &&
                  (kind !== 'backdrops' ||
                    extraAvailable(x, r, ids) ||
                    old?.backdropId === x.id),
              )
              .map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <>
      <input type="hidden" name="addonIds" value={JSON.stringify(addonIds)} />
      <input
        type="hidden"
        name="addonQuantities"
        value={JSON.stringify(quantities)}
      />
      <input
        type="hidden"
        name="extraPackageIds"
        value={JSON.stringify(parents)}
      />
      <input
        type="hidden"
        name="pricingContext"
        value={JSON.stringify(context)}
      />
      <input type="hidden" name="bookingAnswers" value={JSON.stringify(bookingAnswers)}/>
      {bookingFields.length>0&&<fieldset className="form-stack"><legend>Additional booking details</legend>{bookingFields.map(q=><QuestionInput key={q.id} field={q} value={bookingAnswers[q.id]||''} answers={bookingAnswers} uploadContext={item?{eventId:item.id}:undefined} onChange={v=>setBookingAnswers({...bookingAnswers,[q.id]:v})}/>)}</fieldset>}
      <input type="hidden" name="backdropId" value={backdropId} />
      <input type="hidden" name="discountId" value={discountId} />
      <fieldset>
        <legend>Add-ons</legend>
        <div className="package-choices">
          {r
            .filter(
              (x) =>
                x.kind === 'addons' &&
                (extraAvailable(x, r, ids) || old?.addonIds.includes(x.id)),
            )
            .map((a) => (
              <div key={a.id} className="check-card">
                <Checkbox
                  checked={addonIds.includes(a.id) || included.includes(a.id)}
                  disabled={
                    item?.status === 'confirmed' || included.includes(a.id)
                  }
                  onCheckedChange={(v) =>
                    setAddonIds(
                      v
                        ? [...addonIds, a.id]
                        : addonIds.filter((x) => x !== a.id),
                    )
                  }
                />
                <span>{a.name}</span>
                {(addonIds.includes(a.id) || included.includes(a.id)) && (
                  <div>
                    <label>
                      Quantity
                      <input
                        aria-label={'Quantity for ' + a.name}
                        type="number"
                        min={1}
                        max={Number(
                          old?.extras.find((x) => x.id === a.id)?.snapshot?.data
                            .maxQuantity ||
                            a.data.maxQuantity ||
                            1,
                        )}
                        step={1}
                        disabled={item?.status === 'confirmed'}
                        value={quantities[a.id] || 1}
                        onChange={(e) =>
                          setQuantities({
                            ...quantities,
                            [a.id]: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    {packages.length > 1 && (
                      <label>
                        For package
                        <select
                          disabled={item?.status === 'confirmed'}
                          value={
                            parents[a.id] ||
                            old?.extras.find((x) => x.id === a.id)?.packageId ||
                            packages.find((p) => appliesTo(a, [p.id]))?.id ||
                            ''
                          }
                          onChange={(e) =>
                            setParents({ ...parents, [a.id]: e.target.value })
                          }
                        >
                          {packages
                            .filter((p) => appliesTo(a, [p.id]))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
                <b>
                  {included.includes(a.id)
                    ? 'Included'
                    : money(Number(a.data.price) * 100)}
                </b>
              </div>
            ))}
          {!r.some((x) => x.kind === 'addons' && !x.archived) && (
            <p className="muted">Add optional extras under Manage → Add-ons.</p>
          )}
        </div>
      </fieldset>
      <details>
        <summary>Venue details for pricing rules</summary>
        <div className="form-grid">
          {[
            ['venueCity', 'City'],
            ['venueState', 'State / province'],
            ['venuePostalCode', 'Postal code'],
            ['setupLocation', 'Indoor or Outdoor'],
            ['stairs', 'Stairs: Yes or No'],
          ].map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input
                value={String((context as Record<string, string>)[key] || '')}
                maxLength={120}
                disabled={item?.status === 'confirmed'}
                onChange={(e) =>
                  setContext({ ...context, [key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
      </details>
      <div className="form-grid">
        {choose('Backdrop', 'backdrops', backdropId, setBackdropId)}
        {choose('Discount code', 'discounts', discountId, setDiscountId)}
        <label className="field">
          Travel distance (miles)
          <input
            name="miles"
            type="number"
            min="0"
            max="10000"
            step="0.1"
            value={miles}
            readOnly={item?.status === 'confirmed'}
            onChange={(e) => setMiles(Number(e.target.value))}
          />
        </label>
        <label className="field">
          Requested retainer / deposit (USD)
          <input
            key={String(quote?.depositDefault)}
            name="deposit"
            type="number"
            min="0"
            max={(quote?.total || 0) / 100}
            step="0.01"
            defaultValue={
              item ? item.deposit / 100 : (quote?.depositDefault || 0) / 100
            }
          />
        </label>
      </div>
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <>
          <QuoteBreakdown quote={quote} />
          <div className="quote-total">
            <span>Estimated total</span>
            <strong>{money(quote?.total || 0)}</strong>
          </div>
        </>
      )}
    </>
  );
}
export function EventPlanning({
  item,
  data,
  onSave,
  busy,
  initialTab = 'planning',
  section,
}: {
  item: EventRecord;
  data: Data;
  onSave: Save;
  busy: boolean;
  initialTab?: string;
  section?: 'checklists'|'questionnaires'|'designs'|'staff'|'payments';
}) {
  const [template, setTemplate] = useState(''),
    [answerValues, setAnswerValues] = useState<Record<string, string>>({}),
    [method, setMethod] = useState('Cash'),
    [planId, setPlanId] = useState(''),
    [messageId, setMessageId] = useState(''),
    [copied, setCopied] = useState(false);
  const ops = item.operations || {},
    resources = data.resources || [],
    payments = (data.payments || []).filter((p) => p.event_id === item.id),
    paid = payments.reduce((s, p) => s + p.amount, 0);
  const active = resources.filter((x) => !x.archived);
  const message = active.find((x) => x.id === messageId);
  const render = (text: string) => renderMessage(text, messageValues({event:item},data)).text;
  return (
    <Tabs value={section} defaultValue={initialTab} className="planning-tabs">
      {!section&&<TabsList>
        <TabsTrigger value="planning">Planning</TabsTrigger>
        <TabsTrigger value="team">Staff & designs</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="messages">Messages</TabsTrigger>
      </TabsList>}
      <TabsContent value={section==='checklists'||section==='questionnaires'?section:'planning'}>
        {!section && <ClientSubmission item={item} />}

        <div className="form-stack">
          <div className="template-apply">
            <Select
              value={template || 'none'}
              onValueChange={(v) => setTemplate(String(v))}
            >
              <SelectTrigger aria-label={section==='checklists'?'Checklist template':section==='questionnaires'?'Questionnaire template':'Planning template'}>
                <SelectValue>{active.find(r=>r.id===template)?.name || 'Choose a template'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose a template</SelectItem>
                {active
                  .filter((x) =>
                    (section?[section]:['checklists', 'questionnaires', 'contracts']).includes(
                      x.kind,
                    ),
                  )
                  .map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.name} · {x.kind}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <button
              className="secondary"
              disabled={!template || template === 'none' || busy}
              onClick={() =>
                void onSave({
                  action: 'apply_template',
                  eventId: item.id,
                  templateId: template,
                })
              }
            >
              Apply template
            </button>
          </div>
          {section!=='questionnaires'&&(ops.tasks?.length ? (
            <div className="planning-list">
              {[...new Set(ops.tasks.map(task => task.categoryId || ''))].map(categoryId => <section key={categoryId}>
              <h3>{resources.find(r => r.id === categoryId && r.kind === 'categories')?.name || ops.tasks?.find(t => t.categoryId === categoryId)?.categoryName || 'Event checklist'}</h3>
              {ops.tasks!.filter(task => (task.categoryId || '') === categoryId).map((task) => (
                <label key={task.id} className="check-card">
                  <Checkbox
                    checked={task.done}
                    disabled={busy}
                    onCheckedChange={(done) =>
                      void onSave({
                        action: 'save_planning',
                        eventId: item.id,
                        taskId: task.id,
                        done,
                      })
                    }
                  />
                  <span><span className={task.done ? 'done' : ''}>{task.label}</span>
                    {task.due && <small style={{ display: 'block' }}>Due {prettyDate(task.due)}</small>}
                    {task.assignee && <small style={{ display: 'block' }}>Assigned to {task.assignee === 'owner' ? 'Business owner' : resources.find(r => r.id === task.assignee)?.name || 'Staff'}</small>}
                    {task.notes && <small style={{ display: 'block', whiteSpace: 'pre-wrap' }}>{task.notes}</small>}
                  </span>
                </label>
              ))}</section>)}
            </div>
          ) : (
            <p className="muted">
              Apply a checklist template to plan this event.
            </p>
          ))}
          {section!=='checklists'&&!!ops.questions?.length && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void onSave({
                  action: 'save_planning',
                  eventId: item.id,
                  answers: Object.fromEntries(
                    ops.questions!.map((q) => [
                      q.id,
                      answerValues[q.id] ?? q.answer,
                    ]),
                  ),
                });
              }}
            >
              <h3>Questionnaire responses</h3>
              <fieldset
                disabled={ops.questionsFinalized}
                className="form-stack"
              >
                {ops.questions.map((q) => (
                  <QuestionInput
                    key={q.id}
                    field={{
                      type: 'Text Box',
                      hint: '',
                      placeholder: '',
                      required: false,
                      options: [],
                      tab: 'General',
                      repeat: false,
                      timeline: false,
                      conditionField: '',
                      conditionValue: '',
                      ...q,
                    }}
                    value={answerValues[q.id] ?? q.answer}
                    answers={Object.fromEntries(
                      ops.questions!.map((q) => [
                        q.id,
                        answerValues[q.id] ?? q.answer,
                      ]),
                    )}
                    uploadContext={{ eventId: item.id }}
                    onChange={(v) =>
                      setAnswerValues({ ...answerValues, [q.id]: v })
                    }
                  />
                ))}
              </fieldset>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void onSave({
                    action: 'save_planning',
                    eventId: item.id,
                    finalized: !ops.questionsFinalized,
                    answers: Object.fromEntries(
                      ops.questions!.map((q) => [
                        q.id,
                        answerValues[q.id] ?? q.answer,
                      ]),
                    ),
                  })
                }
              >
                {ops.questionsFinalized
                  ? 'Reopen questionnaire'
                  : 'Finalize questionnaire'}
              </button>
              <button className="secondary" disabled={busy}>
                Save answers
              </button>
            </form>
          )}
          {!section&&ops.contract && (
            <div className="notes">
              <h3>Attached contract text</h3>
              <p>{ops.contract}</p>
              <small>E-signatures not connected.</small>
            </div>
          )}
        </div>
      </TabsContent>
      <TabsContent value={section==='designs'||section==='staff'?section:'team'}>
        <div className="form-stack">
          {section!=='staff'&&<BookingDesigns event={item} data={data} onSave={onSave} busy={busy}/>}
          {section!=='designs'&&<>
          <h3>Assigned staff</h3>
          {active
            .filter((x) => x.kind === 'staff')
            .map((x) => (
              <label key={x.id} className="check-card">
                <Checkbox
                  checked={ops.staffIds?.includes(x.id) || false}
                  disabled={busy}
                  onCheckedChange={(v) =>
                    void onSave({
                      action: 'save_planning',
                      eventId: item.id,
                      staffIds: v
                        ? [...(ops.staffIds || []), x.id]
                        : (ops.staffIds || []).filter((id) => id !== x.id),
                    })
                  }
                />
                <span>
                  {x.name}
                  <small>{String(x.data.role)}</small>
                </span>
              </label>
            ))}
          {!active.some((x) => x.kind === 'staff') && (
            <p className="muted">
              Add your roster under Manage → Staff & user accounts.
            </p>
          )}
          </>}
          {section!=='staff'&&<div className="field">
            <span>Selected design</span>
            <Select
              value={ops.designId || 'none'}
              onValueChange={(v) =>
                void onSave({
                  action: 'save_planning',
                  eventId: item.id,
                  designId: v === 'none' ? '' : v,
                })
              }
            >
              <SelectTrigger aria-label="Selected design">
                <SelectValue>{active.find(r=>r.id===ops.designId)?.name || 'None'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {active
                  .filter((x) => x.kind === 'designs')
                  .map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>}
        </div>
      </TabsContent>
      <TabsContent value="payments">
        <div className="form-stack">
          <div className="quote-total">
            <span>Recorded payments {money(paid)}</span>
            <strong>Balance {money(item.total - paid)}</strong>
          </div>
          <div className="form-grid">
            <label className="field">
              Payment plan
              <select
                value={planId || ops.paymentPlan?.id || ''}
                onChange={(e) => setPlanId(e.target.value)}
              >
                <option value="">Choose a plan</option>
                {active
                  .filter(
                    (r) =>
                      r.kind === 'payment_plans' && r.data.enabled !== false,
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              disabled={busy || !planId}
              onClick={() =>
                void onSave({
                  action: 'apply_payment_plan',
                  eventId: item.id,
                  planId,
                })
              }
            >
              Apply payment plan
            </button>
          </div>
          {ops.paymentPlan && (
            <div>
              <h3>{ops.paymentPlan.name}</h3>
              {ops.paymentPlan.schedule.map((s, i) => (
                <p key={i}>
                  {prettyDate(s.date)} · {s.label}: {money(s.amount)}
                </p>
              ))}
              <small>
                Scheduled amounts are requests. Automatic payment collection is
                not connected.
              </small>
            </div>
          )}
          {payments.map((p) => (
            <div className="payment-row" key={p.id}>
              <span>
                {prettyDate(p.date)} · {p.method}
                <small>{p.reference}</small>
              </span>
              <b>
                {money(p.amount)}
                {p.tip ? <small> + {money(p.tip)} tip</small> : null}
              </b>
            </div>
          ))}
          {item.total >= paid && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void onSave({
                  action: 'record_payment',
                  eventId: item.id,
                  amount: Math.round(Number(f.get('amount')) * 100),
                  tip: Math.round(Number(f.get('tip')||0)*100),
                  date: f.get('date'),
                  method,
                  reference: f.get('reference'),
                });
              }}
            >
              <h3>Record a payment received elsewhere</h3>
              <div className="form-grid">
                <label className="field">
                  Amount (USD)
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={(item.total - paid) / 100}
                    required
                  />
                </label>
                <label className="field">Tip (USD)<input name="tip" type="number" min="0" max="1000000" step="0.01" defaultValue="0"/></label>
                <label className="field">
                  Received date
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </label>
                <div className="field">
                  <span>Method</span>
                  <Select
                    value={method}
                    onValueChange={(v) => setMethod(String(v))}
                  >
                    <SelectTrigger aria-label="Payment method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        'Cash',
                        'Check',
                        'Bank transfer',
                        'External card payment',
                        'Other',
                        ...active
                          .filter(
                            (r) =>
                              r.kind === 'payment_methods' &&
                              r.data.enabled !== false,
                          )
                          .map((r) => r.name),
                      ].map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="field">
                  Reference
                  <input name="reference" maxLength={200} />
                </label>
              </div>
              <p className="fine-print">
                This records an existing payment. It does not charge or transfer
                money.
              </p>
              <button className="primary" disabled={busy}>
                Record payment
              </button>
            </form>
          )}
        </div>
      </TabsContent>
      <TabsContent value="messages">
        <div className="form-stack">
          <Select
            value={messageId || 'none'}
            onValueChange={(v) => {
              setMessageId(String(v));
              setCopied(false);
            }}
          >
            <SelectTrigger aria-label="Message template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose a message template</SelectItem>
              {active
                .filter((x) => x.kind === 'messages')
                .map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {message ? (
            <>
              <h3>{render(String(message.data.subject))}</h3>
              <div className="notes">
                <p>{render(String(message.data.body))}</p>
              </div>
              <button
                className="secondary"
                onClick={() => {
                  navigator.clipboard
                    .writeText(
                      render(String(message.data.subject)) +
                        '\n\n' +
                        render(String(message.data.body)),
                    )
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? 'Copied' : 'Copy message'}
              </button>
            </>
          ) : (
            <p className="muted">
              Add reusable messages under Manage → Message templates.
            </p>
          )}
          <p className="fine-print">
            Copy the message to your email app. Outbound sending is not
            connected.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export function ClientSubmission({item}:{item:EventRecord}) {
 const ops=item.operations||{};
 return <>        {ops.customerRequest && (
          <section className="notes">
            <h3>Client submission</h3>
            <p>
              {ops.customerRequest.formName || 'Online booking request'} ·{' '}
              {prettyDate(ops.customerRequest.receivedAt.slice(0, 10))}
            </p>
            {ops.customerRequest.venueDetails&&<div><strong>Venue address submitted by the client</strong><address style={{fontStyle:'normal'}}>{bookingVenueLines(ops.customerRequest.venueDetails).map((line,i)=><div key={i}>{line}</div>)}</address></div>}
            {Object.entries(ops.customerRequest.values || {}).map(([k, v]) => (
              <p key={k}>
                <strong>{k}:</strong> {v}
              </p>
            ))}
            {Object.entries(ops.customerRequest.answers || {}).map(
              ([id, value]) => {
                const field = ops.customerRequest?.fields?.find(
                  (f) => f.id === id,
                );
                return (
                  <p key={id}>
                    <strong>{field?.label || 'Question'}:</strong>{' '}
                    {field?.type.includes('Upload') && value ? (
                      <a
                        href={
                          '/api/question-file?id=' + encodeURIComponent(value)
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        View attachment
                      </a>
                    ) : (
                      value
                    )}
                  </p>
                );
              },
            )}
          </section>
        )}</>;
}
