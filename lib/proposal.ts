import {
  date,
  text,
  type EventRecord,
  type Payment,
  type PackageRecord,
} from './crm';
import { details } from './manage-config';
export const proposalTabs = [
  'Overview',
  'Checklists',
  'Designs',
  'Questionnaires',
  'Make Payment',
  'Invoice',
  'Attachments',
  'Messages',
] as const;
export type InvoiceDetails = {
  number: string;
  poNumber: string;
  issuedOn: string;
  dueOn: string;
  recipient: string;
  email: string;
  notes: string;
};
export function invoiceDetails(e: EventRecord): InvoiceDetails {
  return {
    number: 'ED-' + e.id.slice(0, 8).toUpperCase(),
    poNumber: '',
    issuedOn: e.created_at.slice(0, 10),
    dueOn: e.operations?.quote?.dueDate || e.date,
    recipient: e.client,
    email: e.email,
    notes: '',
    ...e.operations?.invoice,
  };
}
export function checkedInvoice(d: Record<string, unknown>): InvoiceDetails {
  return {
    number: text(d.number, 'Invoice number', 80),
    poNumber: text(d.poNumber ?? '', 'PO number', 80, false),
    issuedOn: date(d.issuedOn, 'Invoice date'),
    dueOn: date(d.dueOn, 'Payment due date'),
    recipient: text(d.recipient, 'Invoice recipient', 120),
    email: text(d.email ?? '', 'Recipient email', 254, false),
    notes: text(d.notes ?? '', 'Invoice notes', 5000, false),
  };
}
export function safeAttachmentUrl(value: unknown): string {
  const raw = text(value, 'Link', 2000);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw Error('Enter a full https:// or http:// link.');
  }
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
    throw Error('Enter a full https:// or http:// link.');
  return u.href;
}
export type EventAttachment = {
  id: string;
  eventId: string;
  name: string;
  kind: 'Document' | 'Link';
  url?: string;
  filename?: string;
  contentType?: string;
  size?: number;
  clientView: boolean;
  staffView: boolean;
  updatedAt: string;
};
export function proposalSummary(
  e: EventRecord,
  payments: Payment[],
  packages: PackageRecord[] = [],
  mediaBase = '',
) {
  const quote = e.operations?.quote;
  // Explicit allowlist: never pass operations, private notes, staff, drafts or
  // payment references into a client-visible document or a client component.
  return {
    id: e.id,
    title: e.title,
    status: e.status,
    date: e.date,
    time: e.time,
    venue: e.venue,
    client: e.client,
    email: e.email,
    items: e.items.map((p) => ({
      id: p.id,
      name: p.name,
      service: p.service,
      duration: p.duration,
      price: p.price,
      units: p.units || 1,
      description:
        p.description ?? packages.find((x) => x.id === p.id)?.description ?? '',
      imageUrl: (() => {
        const pkg = packages.find((x) => x.id === p.id);
        const image =
          pkg?.images?.find((x) => x.is_primary) || pkg?.images?.[0];
        return image && mediaBase
          ? mediaBase +
              '&package=' +
              encodeURIComponent(p.id) +
              '&id=' +
              encodeURIComponent(image.id)
          : '';
      })(),
    })),
    total: e.total,
    deposit: e.deposit,
    invoice: invoiceDetails(e),
    extras:
      quote?.extras.map((x) => ({
        id: x.id,
        name: x.name,
        price: x.price,
        kind: x.kind,
        packageId: x.packageId || e.items[0]?.id || '',
        quantity: x.quantity || 1,
        unitPrice: x.unitPrice ?? x.price,
        included: Boolean(x.included),
        description: String(x.snapshot?.data.description || ''),
        imageUrl:
          details(x.snapshot).images[0] && mediaBase
            ? mediaBase +
              '&extra=' +
              encodeURIComponent(x.id) +
              '&id=' +
              encodeURIComponent(details(x.snapshot).images[0])
            : '',
      })) || [],
    adjustment: quote?.adjustment || 0,
    discount: quote?.discount || 0,
    tax: quote?.tax || 0,
    taxLabel: quote?.taxLabel || 'Tax',
    travel: quote?.travel || 0,
    intro: quote?.intro || '',
    terms: e.operations?.contract || quote?.terms || '',
    validUntil: quote?.validUntil || '',
    presentation: quote?.presentation
      ? {
          theme: quote.presentation.theme,
          pricingTitle: quote.presentation.pricingTitle,
          about: quote.presentation.about,
          reviews: quote.presentation.reviews.map((r) => ({
            reviewer: r.reviewer,
            body: r.body,
            rating: r.rating,
          })),
        }
      : null,
    payments: payments.map((p) => ({
      id: p.id,
      date: p.date,
      method: p.method,
      amount: p.amount,
      tip: p.tip || 0,
    })),
    paid: payments.reduce((sum, p) => sum + p.amount, 0),
    paymentPlan: e.operations?.paymentPlan
      ? {
          name: e.operations.paymentPlan.name,
          schedule: e.operations.paymentPlan.schedule,
        }
      : null,
  };
}
export type ProposalSummary = ReturnType<typeof proposalSummary>;
export type ProposalOption = {
  id: string;
  name: string;
  kind: 'addons' | 'backdrops';
  description: string;
  category: string;
  imageUrl: string;
  maxQuantity: number;
  locked: boolean;
  fixedQuantity?: number;
  packages: { id: string; name: string; price: number; included: boolean }[];
};
export type ProposalSelections = {
  addonIds: string[];
  backdropId: string;
  addonQuantities: Record<string, number>;
  extraPackageIds: Record<string, string>;
};
export type ProposalClientData = {
  summary: ProposalSummary;
  options: ProposalOption[];
  selections: ProposalSelections;
  revision: string;
  editable: boolean;
  editReason: string;
};
