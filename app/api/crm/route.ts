import { bookingQuestions, checkedAnswers } from '@/lib/manage-questions';
import { validateQuestionFiles } from '@/db/question-files';
import { discountGuard, checkDiscount } from '@/db/manage-guards';
import { bookingConfirmationGuard } from '@/db/booking-confirmation';
import {
  validatePackageSettings,
  packageSettings,
  pricePackage,
  validatePackageSchedule,
} from '@/lib/package-config';
import type { PackageRecord } from '@/lib/crm';
import { businessFor, snapshot, configuration, operations } from '@/db/store';
import { calculateQuote } from '@/lib/quote';
import { adjustedItems } from '@/lib/manage-pricing';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { rawDb } from '@/db/raw';
import { addBookingChecklists } from '@/db/checklists';
import { addBookingDesigns } from '@/db/design-collections';
import { text, date, cents, email, serviceList, nextStatus } from '@/lib/crm';
import type { LineItem } from '@/lib/crm';
export const dynamic = 'force-dynamic';
const response = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function identity() {
  const user = await getChatGPTUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
function fail(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to save.';
  if (message === 'UNAUTHENTICATED')
    return response({ error: 'Sign in to access your workspace.' }, 401);
  if (message === 'NOT_FOUND')
    return response({ error: 'Record not found in your workspace.' }, 404);
  if (
    message.startsWith('D1_') ||
    message.includes('SQLITE') ||
    message === 'Database unavailable.'
  ) {
    console.error('CRM database operation failed');
    return response(
      { error: 'Your workspace is temporarily unavailable. Please try again.' },
      503,
    );
  }
  return response({ error: message }, 400);
}
export async function GET() {
  try {
    const user = await identity();
    return response(await snapshot(user.userId));
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    const user = await identity();
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return response({ error: 'Invalid request origin.' }, 403);
    if (Number(req.headers.get('content-length') || 0) > 32000)
      return response({ error: 'Request too large.' }, 413);
    const source = await req.text();
    if (source.length > 32000)
      return response({ error: 'Request too large.' }, 413);
    const body = JSON.parse(source);
    const db = rawDb();
    const business = await businessFor(user.userId);
    const now = new Date().toISOString();
    if (body.action === 'save_business') {
      const name = text(body.name, 'Business name', 100),
        contact = email(body.email),
        phone = text(body.phone ?? '', 'Phone', 40, false),
        services = JSON.stringify(serviceList(body.services));
      if (business) {
        await db
          .prepare(
            'UPDATE businesses SET name=?,email=?,phone=?,services=? WHERE id=? AND owner_id=?',
          )
          .bind(name, contact, phone, services, business.id, user.userId)
          .run();
      } else {
        await db
          .prepare(
            'INSERT INTO businesses(id,owner_id,name,email,phone,services,created_at) VALUES(?,?,?,?,?,?,?)',
          )
          .bind(
            crypto.randomUUID(),
            user.userId,
            name,
            contact,
            phone,
            services,
            now,
          )
          .run();
      }
    } else {
      if (!business) throw new Error('Create your business workspace first.');
      const bid = business.id;
      if (body.action === 'save_package') {
        const name = text(body.name, 'Package name', 120),
          service = text(body.service, 'Service', 70),
          price = cents(body.price, 'Price'),
          duration = text(body.duration, 'Duration', 60),
          description = text(
            body.description ?? '',
            'Description',
            3000,
            false,
          );
        if (!JSON.parse(String(business.services)).includes(service))
          throw new Error('Enable this service in Business settings first.');
        const existing = body.id
          ? await db
              .prepare(
                'SELECT settings FROM packages WHERE id=? AND business_id=?',
              )
              .bind(text(body.id, 'Package ID'), bid)
              .first<{ settings: string }>()
          : null;
        if (body.id && !existing) throw new Error('NOT_FOUND');
        const config = validatePackageSettings(
          body.settings ?? (existing ? JSON.parse(existing.settings) : {}),
          duration,
        );
        for (const id of config.includedAddonIds) {
          const a = await db
            .prepare(
              "SELECT id FROM resources WHERE id=? AND business_id=? AND kind='addons' AND archived=0",
            )
            .bind(id, bid)
            .first();
          if (!a)
            throw new Error(
              'An included add-on is unavailable in your business.',
            );
        }
        const encoded = JSON.stringify(config);
        if (body.id) {
          const result = await db
            .prepare(
              'UPDATE packages SET name=?,service=?,price=?,duration=?,description=?,settings=? WHERE id=? AND business_id=?',
            )
            .bind(
              name,
              service,
              price,
              duration,
              description,
              encoded,
              text(body.id, 'Package ID'),
              bid,
            )
            .run();
          if (!result.meta.changes) throw new Error('NOT_FOUND');
        } else
          await db
            .prepare(
              'INSERT INTO packages(id,business_id,name,service,price,duration,description,created_at,settings) VALUES(?,?,?,?,?,?,?,?,?)',
            )
            .bind(
              crypto.randomUUID(),
              bid,
              name,
              service,
              price,
              duration,
              description,
              now,
              encoded,
            )
            .run();
      } else if (body.action === 'save_event') {
        let current: Record<string, unknown> | null = null;
        if (body.id) {
          current = await db
            .prepare('SELECT * FROM events WHERE id=? AND business_id=?')
            .bind(text(body.id, 'Event ID'), bid)
            .first();
          if (!current) throw new Error('NOT_FOUND');
          if (current.lifecycle !== 'Active')
            throw new Error(
              'Restore this record before editing or confirming it.',
            );
        }
        const title = text(body.title, 'Event title', 150),
          client = text(body.client, 'Client name', 120),
          contact = email(body.email),
          phone = text(body.phone ?? '', 'Phone', 40, false),
          day = date(body.date, 'Event date'),
          time = text(body.time ?? '', 'Time', 5, false),
          venue = text(body.venue ?? '', 'Venue', 1000, false),
          source = text(body.source ?? '', 'Source', 80, false),
          notes = text(body.notes ?? '', 'Notes', 5000, false),
          followUp = date(body.follow_up ?? '', 'Follow-up date', false);
        if (
          current?.status === 'confirmed' &&
          (day !== current.date || time !== current.time)
        )
          throw new Error('Reopen this booking before changing its schedule.');
        if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
          throw new Error('Enter a valid time.');
        let items: LineItem[];
        if (current?.status === 'confirmed') {
          items = JSON.parse(String(current.items));
        } else {
          if (!Array.isArray(body.packageIds) || body.packageIds.length > 20)
            throw new Error('Choose up to 20 packages.');
          const ids = [
            ...new Set(
              body.packageIds.map((id: unknown) => text(id, 'Package ID')),
            ),
          ];
          const previous: LineItem[] = current
            ? JSON.parse(String(current.items))
            : [];
          items = [];
          for (const id of ids) {
            const old = previous.find((x) => x.id === id);
            let p: PackageRecord | LineItem;
            if (old) p = old;
            else {
              const row = await db
                .prepare(
                  'SELECT id,name,service,price,duration,description,settings FROM packages WHERE id=? AND business_id=?',
                )
                .bind(id, bid)
                .first<PackageRecord & { settings: string }>();
              if (!row)
                throw new Error(
                  'A selected package is unavailable in your business.',
                );
              p = {
                ...row,
                settings: packageSettings(
                  JSON.parse(row.settings),
                  row.duration,
                ),
              };
              if (p.settings?.status === 'Disabled')
                throw new Error(p.name + ' is disabled.');
              if (
                body.bookingPreview &&
                p.settings?.status !== 'Public' &&
                body.packageLinkId !== p.id
              )
                throw new Error('This package is not publicly listed.');
            }
            const selection = body.packageSelections?.[String(id)];
            if (
              selection &&
              (typeof selection !== 'object' || Array.isArray(selection))
            )
              throw new Error('Invalid package selection.');
            items.push(pricePackage(p, selection));
          }
        }
        const config = await configuration(bid);
        const oldOps = current ? await operations(current.id, bid) : {};
        if (current?.status !== 'confirmed')
          validatePackageSchedule(
            items,
            day,
            time,
            String(body.backdropId || ''),
          );
        if (!config.settings.multiplePackages && items.length > 1)
          throw new Error('This business allows only one package per event.');
        const quote =
          current?.status === 'confirmed' && oldOps.quote
            ? oldOps.quote
            : calculateQuote(
                items,
                config.resources,
                config.settings,
                {
                  date: day,
                  time,
                  context: body.pricingContext,
                  addonQuantities:
                    body.addonQuantities ?? oldOps.quote?.addonQuantities,
                  extraPackageIds:
                    body.extraPackageIds ?? oldOps.quote?.extraPackageIds,
                  addonIds: body.addonIds || oldOps.quote?.addonIds || [],
                  backdropId: body.backdropId ?? oldOps.quote?.backdropId,
                  discountId: body.discountId ?? oldOps.quote?.discountId,
                  miles: body.miles ?? oldOps.quote?.miles,
                },
                oldOps.quote,
              );
        if (current?.status !== 'confirmed') {
          const updated = adjustedItems(items, quote.extras);
          items.splice(0, items.length, ...updated);
        }
        const total = quote.total;
        cents(total, 'Total');
        const paid = current
          ? await db
              .prepare(
                'SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE event_id=? AND business_id=?',
              )
              .bind(current.id, bid)
              .first<{ amount: number }>()
          : null;
        if (paid && total < paid.amount)
          throw new Error('Quote total cannot be less than recorded payments.');
        const deposit = cents(body.deposit ?? quote.depositDefault, 'Deposit');
        if (deposit > total)
          throw new Error('Deposit cannot exceed the total.');
        if (
          !current &&
          body.initialStatus &&
          !['lead', 'proposal', 'confirmed'].includes(body.initialStatus)
        )
          throw Error('Choose a valid event status.');
        if (
          !current &&
          body.bookingPreview &&
          body.initialStatus &&
          body.initialStatus !== 'lead'
        )
          throw Error(
            'Online booking requests must be reviewed before confirmation.',
          );
        if (!current && body.initialStatus === 'proposal' && !items.length)
          throw Error('Select a package for this proposal.');
        const eventId = current
          ? text(current.id, 'Event ID')
          : crypto.randomUUID();
        const initialStatus = body.initialStatus || 'lead';
        const creatingBooking = !current && initialStatus === 'confirmed';
        let staffIds: string[] = [];
        if (creatingBooking) {
          if (
            body.staffIds !== undefined &&
            (!Array.isArray(body.staffIds) || body.staffIds.length > 30)
          )
            throw Error('Choose up to 30 staff.');
          staffIds = [
            ...new Set<string>(
              (body.staffIds || []).map((id: unknown) =>
                text(id, 'Staff ID', 100),
              ),
            ),
          ];
        }
        const confirmation = creatingBooking
          ? await bookingConfirmationGuard(
              bid,
              eventId,
              { date: day, time, items },
              staffIds,
              quote.backdropId || '',
              config,
            )
          : { sql: 'FALSE', args: [] };
        const eventWrite = current
          ? db
              .prepare(
                'UPDATE events SET title=?,client=?,email=?,phone=?,date=?,time=?,venue=?,source=?,deposit=?,notes=?,follow_up=?,items=?,total=?,updated_at=? WHERE id=? AND business_id=?',
              )
              .bind(
                title,
                client,
                contact,
                phone,
                day,
                time,
                venue,
                source,
                deposit,
                notes,
                followUp,
                JSON.stringify(items),
                total,
                now,
                current.id,
                bid,
              )
          : db
              .prepare(
                `INSERT INTO events(id,business_id,title,client,email,phone,date,time,venue,source,status,items,total,deposit,notes,follow_up,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT ${confirmation.sql}`,
              )
              .bind(
                eventId,
                bid,
                title,
                client,
                contact,
                phone,
                day,
                time,
                venue,
                source,
                initialStatus,
                JSON.stringify(items),
                total,
                deposit,
                notes,
                followUp,
                now,
                now,
                ...confirmation.args,
              );
        const bookingFields =
            oldOps.bookingFields ||
            bookingQuestions(
              config.resources,
              items.map((p) => p.id),
              true,
            ),
          bookingAnswers = checkedAnswers(
            body.bookingAnswers ?? oldOps.bookingAnswers,
            bookingFields,
            false,
          );
        await validateQuestionFiles(
          String(bid),
          'event:' + eventId,
          bookingAnswers,
          bookingFields,
        );
        const operationWrite = db
          .prepare(
            'INSERT INTO event_operations(event_id,business_id,data) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=? AND business_id=?) ON CONFLICT(event_id) DO UPDATE SET data=ed_patch(event_operations.data,ed_json(?)) WHERE event_operations.business_id=?',
          )
          .bind(
            eventId,
            bid,
            JSON.stringify({
              ...oldOps,
              ...(!current && initialStatus === 'proposal'
                ? { sales: { proposalCreatedAt: now } }
                : creatingBooking
                  ? { sales: { confirmedAt: now }, staffIds }
                  : {}),
              quote,
              bookingAnswers,
              bookingFields,
            }),
            eventId,
            bid,
            JSON.stringify({ quote, bookingAnswers, bookingFields }),
            bid,
          );
        await checkDiscount(bid, eventId, quote.discountId);
        const writes = await db.batch([
          discountGuard(bid, eventId, quote.discountId),
          eventWrite,
          operationWrite,
        ]);
        if (creatingBooking && !writes[1].meta.changes)
          throw Error(
            'Booking capacity or staff availability changed. Choose another time or available staff and try again.',
          );
        if (creatingBooking) {
          await addBookingChecklists(bid, eventId);
          await addBookingDesigns(bid, eventId);
        }
      } else if (body.action === 'advance_event') {
        const id = text(body.id, 'Event ID');
        const current = await db
          .prepare(
            'SELECT lifecycle,status,items,date,time FROM events WHERE id=? AND business_id=?',
          )
          .bind(id, bid)
          .first<{
            lifecycle: string;
            status: string;
            items: string;
            date: string;
            time: string;
          }>();
        if (!current) throw new Error('NOT_FOUND');
        if (current.lifecycle !== 'Active')
          throw new Error(
            'Restore this record before editing or confirming it.',
          );
        const status = nextStatus(current.status, body.status);
        if (!JSON.parse(current.items).length)
          throw new Error(
            'A proposal needs a package. Edit the lead and select its packages.',
          );
        const config = await configuration(bid);
        const currentOps = await operations(id, bid);
        const confirmation =
          status === 'confirmed'
            ? await bookingConfirmationGuard(
                bid,
                id,
                {
                  date: current.date,
                  time: current.time,
                  items: JSON.parse(current.items),
                },
                currentOps.staffIds || [],
                currentOps.quote?.backdropId || '',
                config,
              )
            : { sql: 'FALSE', args: [] };
        const result = await db
          .prepare(
            `UPDATE events SET status=?,updated_at=? WHERE id=? AND business_id=? AND status=? AND lifecycle='Active' AND NOT ${confirmation.sql}`,
          )
          .bind(status, now, id, bid, current.status, ...confirmation.args)
          .run();
        if (!result.meta.changes)
          throw new Error(
            'Booking capacity or staff availability changed, or this record was updated. Refresh and try again.',
          );
        if (
          (status === 'confirmed' || status === 'proposal') &&
          current.status !== status
        )
          await db
            .prepare(
              'INSERT INTO event_operations(event_id,business_id,data) VALUES(?,?,?) ON CONFLICT(event_id) DO UPDATE SET data=ed_set(event_operations.data,?,?) WHERE event_operations.business_id=?',
            )
            .bind(
              id,
              bid,
              JSON.stringify({
                sales: {
                  [status === 'confirmed'
                    ? 'confirmedAt'
                    : 'proposalCreatedAt']: now,
                },
              }),
              status === 'confirmed'
                ? '$.sales.confirmedAt'
                : '$.sales.proposalCreatedAt',
              now,
              bid,
            )
            .run();
        if (status === 'confirmed') await addBookingChecklists(bid, id);
        if (status === 'confirmed') await addBookingDesigns(bid, id);
      } else throw new Error('Unknown action.');
    }
    return response(await snapshot(user.userId));
  } catch (e) {
    return fail(e);
  }
}
