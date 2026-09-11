import { money, prettyDate, type Data, type EventRecord } from './crm';
import { details, appliesTo } from './manage-config';
import {
  normalizedMessage,
  rolesFor,
  timingLabel,
  triggerCategory,
} from './message-catalog';
import type { Resource } from './settings';
import type { SalesRecord } from './sales';

export type MessageContext = { event?: EventRecord; appointment?: SalesRecord };
export function messageContexts(r: Resource, data: Data) {
  const d = normalizedMessage(r).data;
  const category =
    r.kind === 'automations'
      ? triggerCategory(String(d.eventTrigger))
      : String(d.category);
  if (category === 'Appointments')
    return (data.sales || [])
      .filter((a) => a.kind === 'appointment' && !a.archived)
      .map((appointment) => ({
        appointment,
        event: data.events.find((e) => e.id === appointment.data.eventId),
      }));
  const status =
    category === 'Leads'
      ? 'lead'
      : category === 'Proposals'
        ? 'proposal'
        : 'confirmed';
  return data.events
    .filter(
      (e) =>
        e.status === status &&
        !['Deleted', 'Spam', 'Archived'].includes(e.lifecycle || ''),
    )
    .map((event) => ({ event }));
}
export const contextId = (c: MessageContext) =>
  c.appointment ? 'appointment:' + c.appointment.id : 'event:' + c.event?.id;
export const contextTitle = (c: MessageContext) =>
  c.appointment ? String(c.appointment.data.title) : c.event?.title || '';
export function zonedParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const p = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export function localInstant(date: string, time: string, timezone: string) {
  const wall = new Date(`${date}T${time || '00:00'}:00Z`);
  if (!Number.isFinite(wall.valueOf())) return undefined;
  let candidate = wall;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(candidate, timezone),
      displayed = Date.parse(`${p.date}T${p.time}:00Z`);
    const offset = wall.valueOf() - displayed;
    if (!offset) return candidate;
    candidate = new Date(candidate.valueOf() + offset);
  }
  return undefined;
}
export function offsetInstant(
  base: Date,
  amount: number,
  unit: string,
  timezone: string,
) {
  if (['Minutes', 'Hours'].includes(unit))
    return new Date(
      base.valueOf() + amount * (unit === 'Minutes' ? 60000 : 3600000),
    );
  const p = zonedParts(base, timezone),
    date = new Date(p.date + 'T12:00:00Z');
  if (unit === 'Months' || unit === 'Years') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + amount * (unit === 'Years' ? 12 : 1));
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  } else
    date.setUTCDate(date.getUTCDate() + amount * (unit === 'Weeks' ? 7 : 1));
  return localInstant(date.toISOString().slice(0, 10), p.time, timezone);
}
export function messageSchedule(
  r: Resource,
  c: MessageContext,
  data: Data,
  occurredAt = '',
) {
  const d = normalizedMessage(r).data,
    e = c.event,
    a = c.appointment,
    tz = String(data.settings?.timezone || 'America/Los_Angeles');
  if (r.kind !== 'automations' || d.timing === 'Manual')
    return {
      label: 'Manual preparation only',
      basis: '',
      date: '',
      time: '',
      timezone: tz,
    };
  let basis = '',
    base: Date | undefined;
  const timestamp = (value?: string) =>
    value && Number.isFinite(Date.parse(value)) ? new Date(value) : undefined;
  switch (d.eventTrigger) {
    case 'Booked Date':
      basis = 'Booking secured';
      base =
        e?.status === 'confirmed'
          ? timestamp(e.operations?.sales?.confirmedAt)
          : undefined;
      break;
    case 'Lead Creation Date':
      basis = 'Lead received';
      base = timestamp(e?.created_at);
      break;
    case 'Proposal Creation Date':
      basis = 'Proposal created';
      base = timestamp(e?.operations?.sales?.proposalCreatedAt);
      break;
    case 'Appointment Created':
      basis = 'Appointment created';
      base = timestamp(a?.created_at);
      break;
    case 'Customer Signed':
      basis = 'Signature recorded';
      base = e?.operations?.sales?.signatureDate
        ? localInstant(e.operations.sales.signatureDate, '00:00', tz)
        : undefined;
      break;
    case 'Scheduled Date':
    case 'Proposed Date':
    case 'Lead Scheduled Event Date':
      basis = 'Event scheduled';
      base = e?.date ? localInstant(e.date, e.time, tz) : undefined;
      break;
    case 'Appointment Scheduled Time':
      basis = 'Appointment scheduled';
      base = a?.data.date
        ? localInstant(a.data.date, a.data.time, tz)
        : undefined;
      break;
    case 'Payment Due Date':
      basis = 'Final payment due';
      base = e?.operations?.quote?.dueDate
        ? localInstant(e.operations.quote.dueDate, '00:00', tz)
        : undefined;
      break;
    case 'Proposal Expiration Date': {
      const day =
        e?.operations?.sales?.expires || e?.operations?.quote?.validUntil;
      basis = 'Proposal expires';
      base = day ? localInstant(day, '00:00', tz) : undefined;
      break;
    }
    default:
      basis = String(d.eventTrigger);
  }
  if (!base && occurredAt) base = timestamp(occurredAt);
  if (!base)
    return {
      label:
        d.eventTrigger === 'Booked Date'
          ? 'No secured booking date recorded. A lead or proposal creation date is not a booked date.'
          : 'No trigger timestamp recorded. Enter the actual trigger time to preview this rule.',
      basis,
      date: '',
      time: '',
      timezone: tz,
    };
  const scheduled =
    d.timing === 'When'
      ? base
      : offsetInstant(
          base,
          Number(d.offset) * (d.timing === 'Before' ? -1 : 1),
          String(d.timeUnit),
          tz,
        );
  if (!scheduled)
    return {
      label: 'This time falls in a daylight-saving gap. Choose another time.',
      basis,
      date: '',
      time: '',
      timezone: tz,
    };
  const p = zonedParts(scheduled, tz);
  return {
    ...p,
    basis,
    timezone: tz,
    label: `${p.date} at ${p.time} (${tz}) · ${timingLabel(r)}`,
  };
}
export function conditionResults(
  r: Resource,
  c: MessageContext,
  data: Data,
  now = new Date(),
) {
  const e = c.event,
    a = c.appointment,
    payments = (data.payments || []).filter((p) => p.event_id === e?.id),
    paid = payments.reduce((n, p) => n + p.amount, 0),
    tips = payments.reduce((n, p) => n + (p.tip || 0), 0);
  const date = String(a?.data.date || e?.date || ''),
    today = zonedParts(
      now,
      String(data.settings?.timezone || 'America/Los_Angeles'),
    ).date;
  const values: Record<string, string> = {
    ...(e
      ? {
          Balance: paid >= e.total ? 'Fully paid' : 'Not fully paid',
          Deposit: paid >= e.deposit ? 'Paid' : 'Not fully paid',
          Tips: tips > 0 ? 'Received' : 'Not received',
          Staff: e.operations?.staffIds?.length ? 'Assigned' : 'Not assigned',
          Backdrop: e.operations?.quote?.backdropId
            ? 'Selected'
            : 'Not selected',
          Designs: e.operations?.designId ? 'Selected' : 'Not selected',
          Contract:
            e.operations?.sales?.signature === 'Recorded'
              ? 'Signed'
              : 'Not signed',
          Questionnaires: e.operations?.questionsFinalized
            ? 'Complete'
            : 'Incomplete',
          Origin: e.operations?.sales?.origin || e.source,
          'Lead Type': e.operations?.sales?.heat || '',
        }
      : {}),
    ...(date
      ? {
          'Day of week': new Date(date + 'T12:00:00Z').toLocaleDateString(
            'en-US',
            { weekday: 'long', timeZone: 'UTC' },
          ),
          'Date Status':
            date < today ? 'Past' : date === today ? 'Today' : 'Upcoming',
        }
      : {}),
  };
  const aliases: Record<string, string> = { Unpaid: 'Not fully paid' };
  return details(r).conditions.map((condition) => {
    const v = condition.value,
      expected = aliases[v] || v;
    let actual: string | undefined = values[condition.field],
      same = actual === expected;
    if (condition.field === 'Excluded Package') {
      actual = e ? 'Evaluated' : undefined;
      same = !!e && !e.items.some((p) => p.id === v);
    }
    if (condition.field === 'Add-on') {
      actual = e ? 'Evaluated' : undefined;
      same = !!e && !!e.operations?.quote?.addonIds.includes(v);
    }
    // Preserve numeric conditions saved by the earlier editor.
    if (
      e &&
      v.trim() !== '' &&
      Number.isFinite(Number(v)) &&
      ['Balance', 'Deposit', 'Tips'].includes(condition.field)
    ) {
      const n =
        condition.field === 'Balance'
          ? Math.max(0, e.total - paid)
          : condition.field === 'Deposit'
            ? e.deposit
            : tips;
      same = n / 100 === Number(v);
    }
    const legacy: Record<string, string> = {
      Yes:
        condition.field === 'Staff'
          ? 'Assigned'
          : condition.field === 'Contract'
            ? 'Signed'
            : 'Selected',
      No:
        condition.field === 'Staff'
          ? 'Not assigned'
          : condition.field === 'Contract'
            ? 'Not signed'
            : 'Not selected',
    };
    if (legacy[v]) same = actual === legacy[v];
    return {
      condition,
      actual: actual ?? 'Not recorded',
      matches:
        actual !== undefined &&
        (condition.operator === 'Is not' ? !same : same),
    };
  });
}
export function messageRecipients(r: Resource, c: MessageContext, data: Data) {
  const d = normalizedMessage(r).data,
    channel = String(d.channel),
    roles = rolesFor(d),
    e = c.event,
    a = c.appointment;
  const list: { address: string; name: string }[] = [];
  const add = (name: unknown, email: unknown, phone: unknown) => {
    const address = String((channel === 'SMS' ? phone : email) || '').trim();
    if (address) list.push({ address, name: String(name || '') });
  };
  if (roles.includes('Client') || roles.includes('Primary attendee'))
    a
      ? add(a.data.name, a.data.email, a.data.phone)
      : add(e?.client, e?.email, e?.phone);
  if (roles.includes('Additional attendees') && a && channel === 'Email')
    String(a.data.additional || '')
      .split(',')
      .filter(Boolean)
      .forEach((email) => add('', email, ''));
  if (roles.includes('My business'))
    add(data.business?.name, data.business?.email, data.business?.phone);
  if (roles.includes('Assigned staff'))
    (data.resources || [])
      .filter(
        (s) =>
          s.kind === 'staff' &&
          !s.archived &&
          (a?.data.staffIds || e?.operations?.staffIds || []).includes(s.id),
      )
      .forEach((s) => add(s.name, s.data.email, s.data.phone));
  String(d.extraRecipients || '')
    .split(',')
    .filter((x) => x.trim())
    .forEach((address) => add('', address, address));
  return list.filter(
    (v, i, all) =>
      all.findIndex(
        (x) => x.address.toLowerCase() === v.address.toLowerCase(),
      ) === i,
  );
}
export function messageValues(
  c: MessageContext,
  data: Data,
  recipient?: { address: string; name: string },
  origin = '',
) {
  const e = c.event,
    a = c.appointment,
    values: Record<string, string> = {},
    tz = String(data.settings?.timezone || 'America/Los_Angeles');
  const set = (key: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '')
      values[key] = String(value);
  };
  set('business_name', data.business?.name);
  set('brand_signature', data.settings?.signature || data.business?.name);
  const name = String(a?.data.name || e?.client || '');
  set('client_name', name);
  set('client_first_name', name.split(' ')[0]);
  set('client_last_name', name.split(' ').slice(1).join(' '));
  set('client_email', a?.data.email || e?.email);
  set('client_phone', a?.data.phone || e?.phone);
  const rn = recipient?.name || name;
  set('recipient_name', rn);
  set('recipient_first_name', rn.split(' ')[0]);
  set('recipient_last_name', rn.split(' ').slice(1).join(' '));
  set('recipient_email', recipient?.address || a?.data.email || e?.email);
  if (e) {
    set('event_title', e.title);
    set('event_date', prettyDate(e.date));
    set('event_time', e.time || 'Time to be confirmed');
    set('created_date', zonedParts(new Date(e.created_at), tz).date);
    if (e.status === 'confirmed' && e.operations?.sales?.confirmedAt)
      set(
        'booked_date',
        zonedParts(new Date(e.operations.sales.confirmedAt), tz).date,
      );
    set(
      'event_date_day_of_week',
      new Date(e.date + 'T12:00:00Z').toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: 'UTC',
      }),
    );
    const paid = (data.payments || [])
      .filter((p) => p.event_id === e.id)
      .reduce((n, p) => n + p.amount, 0);
    set('event_starting_balance', money(e.total));
    set('event_balance_due', money(Math.max(0, e.total - paid)));
    set('event_deposit_due', money(Math.max(0, e.deposit - paid)));
    set(
      'event_due_date',
      e.operations?.invoice?.dueOn || e.operations?.quote?.dueDate || e.date,
    );
    set('package_name', e.items.map((p) => p.name).join(', '));
    set('package_service_name', e.items.map((p) => p.service).join(', '));
    set(
      'package_description',
      e.items
        .map(
          (p) =>
            p.description ??
            data.packages.find((x) => x.id === p.id)?.description ??
            '',
        )
        .filter(Boolean)
        .join('\n\n') || 'No description recorded',
    );
    set(
      'event_hours',
      e.items
        .map((p) => {
          const duration =
            p.duration ||
            (p.minutes
              ? `${p.minutes / 60} hours`
              : 'Duration to be confirmed');
          return e.items.length > 1 ? `${p.name}: ${duration}` : duration;
        })
        .join('\n') || 'Duration to be confirmed',
    );
    const quote = e.operations?.quote;
    set(
      'add_on_list_with_descriptions',
      quote?.extras
        .filter((x) => x.kind === 'addons')
        .map((x) => {
          const description = String(x.snapshot?.data.description || '');
          return `${x.name} × ${x.quantity || 1}${x.included ? ' (included)' : ''}${description ? '\n' + description : ''}`;
        })
        .join('\n\n') || 'No add-ons recorded',
    );
    // Use the structured booking address only while it still matches the venue
    // saved on the event; a later manual edit must not revive an old address.
    const savedVenue = e.operations?.customerRequest?.venueDetails;
    const venueLines = savedVenue
      ? [
          savedVenue.name,
          savedVenue.address,
          savedVenue.address2,
          [
            savedVenue.city,
            [savedVenue.state, savedVenue.postalCode].filter(Boolean).join(' '),
          ]
            .filter(Boolean)
            .join(', '),
          savedVenue.country,
        ].filter(Boolean)
      : [];
    const useSavedVenue = !!savedVenue && venueLines.join(', ') === e.venue;
    const venues =
      data.resources?.filter(
        (r) => r.kind === 'venues' && !r.archived && r.name === e.venue,
      ) || [];
    set(
      'venue_name',
      useSavedVenue ? savedVenue.name || e.venue : e.venue || 'To be confirmed',
    );
    set(
      'venue_address',
      useSavedVenue
        ? venueLines.slice(savedVenue.name ? 1 : 0).join('\n')
        : (venues.length === 1 ? venues[0].data.address : '') ||
            'Address to be confirmed',
    );
    set(
      'backdrop_name',
      e.operations?.quote?.extras.find(
        (x) => x.id === e.operations?.quote?.backdropId,
      )?.name || 'No backdrop recorded',
    );
    set(
      'design_name',
      data.resources?.find((r) => r.id === e.operations?.designId)?.name,
    );
    set(
      'staff_names',
      data.resources
        ?.filter((r) => e.operations?.staffIds?.includes(r.id))
        .map((r) => r.name)
        .join(', ') || 'No staff assigned',
    );
    set('coupon_code', quote?.discountRule?.data.code || 'None recorded');
    set(
      'proposal_expiration_date',
      e.operations?.sales?.expires || quote?.validUntil,
    );
    // Reuse an already issued client link. Previewing never creates access.
    // The caller supplies the page/request origin, never a template value.
    const link = data.sales?.find(
      (r) =>
        String(r.kind) === 'proposal_link' &&
        !r.archived &&
        r.data.eventId === e.id,
    );
    if (
      link &&
      ['proposal', 'confirmed'].includes(e.status) &&
      !['Deleted', 'Spam', 'Archived'].includes(e.lifecycle || '')
    ) {
      try {
        const base = new URL(origin);
        const token = String(link.data.token || '');
        if (
          !base.username &&
          !base.password &&
          (base.protocol === 'https:' ||
            (base.protocol === 'http:' &&
              ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) &&
          /^[A-Za-z0-9_-]{43}$/.test(token)
        ) {
          const url = new URL(
            '/proposal/' + encodeURIComponent(e.id),
            base.origin,
          );
          url.searchParams.set('token', token);
          set('event_link', url.href);
          set('proposal_link', url.href);
          url.searchParams.set('view', 'invoice');
          set('invoice_link', url.href);
        }
      } catch {
        /* Missing or invalid origin keeps links unresolved. */
      }
    }
  }
  if (a) {
    set('appointment_title', a.data.title);
    set('appointment_date', prettyDate(a.data.date));
    set('appointment_time', a.data.time);
    set('appointment_location', a.data.location || 'Location to be confirmed');
    set('event_title', a.data.title);
    set('created_date', zonedParts(new Date(a.created_at), tz).date);
  }
  for (const [alias, key] of Object.entries({
    client: 'client_name',
    event: 'event_title',
    business: 'business_name',
    date: 'event_date',
    total: 'event_starting_balance',
  }))
    if (values[key]) values[alias] = values[key];
  return values;
}
export function renderMessage(text: string, values: Record<string, string>) {
  const unresolved: string[] = [];
  const rendered = text.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (token, key) => {
      if (values[key] !== undefined && values[key] !== '') return values[key];
      unresolved.push(key);
      return token;
    },
  );
  return { text: rendered, unresolved: [...new Set(unresolved)] };
}
export function messageIssues(r: Resource, c: MessageContext, data: Data) {
  const e = c.event,
    a = c.appointment,
    issues: string[] = [];
  if (!a && !e) issues.push('Choose a record to preview.');
  if (!appliesTo(r, e?.items.map((p) => p.id) || []))
    issues.push('This record is outside the selected packages.');
  if (r.archived) issues.push('Restore this template before preparing drafts.');
  if (r.kind === 'automations') {
    const canceled =
      e?.lifecycle === 'Canceled' || a?.data.status === 'Canceled';
    if (canceled && !String(r.data.eventTrigger).includes('Canceled'))
      issues.push('This record was canceled. Choose a cancellation message.');
    if (r.data.enabled === false) issues.push('This rule is paused.');
    if (e?.operations?.sales?.automationsPaused)
      issues.push('Automated messages are paused for this event.');
    if (conditionResults(r, c, data).some((x) => !x.matches))
      issues.push('This record does not match every condition.');
  }
  return issues;
}
