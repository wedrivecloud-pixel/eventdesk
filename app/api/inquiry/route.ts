import { leadFormContext } from '@/db/lead-forms';
import { rawDb } from '@/db/raw';
import { digest } from '@/db/public-booking';
import { limit } from '../booking/route';
import { checkedAnswers } from '@/lib/manage-questions';
import { text, email, date } from '@/lib/crm';
import { validateQuestionFiles } from '@/db/question-files';
const json = (v: unknown, status = 200) =>
  Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(req: Request) {
  try {
    if (
      (req.headers.get('origin') &&
        req.headers.get('origin') !== new URL(req.url).origin) ||
      req.headers.get('sec-fetch-site') === 'cross-site'
    )
      return json({ error: 'Invalid origin.' }, 403);
    const raw = await req.text();
    if (raw.length > 32000) return json({ error: 'Form is too large.' }, 413);
    const body = JSON.parse(raw),
      c = await leadFormContext(text(body.formId, 'Form', 100));
    if (!c) return json({ error: 'Form unavailable.' }, 404);
    if (body.companyWebsite) throw Error('Unable to send this inquiry.');
    if (c.b.settings.requireConsent && body.consent !== true)
      throw Error('Accept the privacy consent to continue.');
    const values: Record<string, string> = {};
    for (const f of c.fields.filter((f) => f.display !== 'Hidden'))
      values[f.key] = text(
        body.values?.[f.key] || '',
        f.label,
        f.key === 'notes' ? 3000 : 500,
        f.display === 'Required',
      );
    if (values.email) values.email = email(values.email);
    if (values.date) date(values.date, 'Event date');
    if (values.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time))
      throw Error('Enter a valid time.');
    if (values.packageId && !c.packages.some((p) => p.id === values.packageId))
      throw Error('Choose an available package.');
    const answers = checkedAnswers(body.answers, c.questions),
      id = text(body.requestId, 'Request ID', 36);
    if (
      !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
        id,
      )
    )
      throw Error('Refresh the form and try again.');
    await validateQuestionFiles(
      c.b.id,
      'form:' + c.form.id,
      answers,
      c.questions,
    );
    const fingerprint = await digest(
        JSON.stringify({ form: c.form.id, values, answers }),
      ),
      db = rawDb(),
      old = await db
        .prepare(
          'SELECT business_id,data FROM event_operations WHERE event_id=?',
        )
        .bind(id)
        .first<{ business_id: string; data: string }>();
    const success = () =>
      json({
        message: String(
          c.form.data.confirmation || 'Thank you. We will be in touch shortly.',
        ),
        redirect:
          c.form.data.afterSubmit === 'Open booking page'
            ? '/reservation/start?business=' + c.b.id
            : c.form.data.afterSubmit === 'Open URL' &&
                /^https?:\/\//.test(String(c.form.data.redirectUrl))
              ? c.form.data.redirectUrl
              : undefined,
      });
    if (old) {
      if (
        old.business_id === c.b.id &&
        JSON.parse(old.data).requestDigest === fingerprint
      )
        return success();
      return json(
        { error: 'This request ID was already used. Refresh the form.' },
        409,
      );
    }
    await limit(req, c.b.id, 'submit');
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          "INSERT INTO events(id,business_id,title,client,email,phone,date,time,venue,source,status,items,total,deposit,notes,follow_up,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'lead','[]',0,0,?,'',?,?)",
        )
        .bind(
          id,
          c.b.id,
          values.title || 'Website inquiry',
          (
            [values.firstName, values.lastName].filter(Boolean).join(' ') ||
            values.company ||
            'Website visitor'
          ).slice(0, 120),
          values.email || '',
          values.phone || '',
          values.date || '',
          values.time || '',
          [values.venue, values.address]
            .filter(Boolean)
            .join(' · ')
            .slice(0, 250),
          'Lead form: ' + c.form.name,
          values.notes || '',
          now,
          now,
        ),
      db
        .prepare(
          'INSERT INTO event_operations(event_id,business_id,data) VALUES(?,?,?)',
        )
        .bind(
          id,
          c.b.id,
          JSON.stringify({
            requestDigest: fingerprint,
            sales: { origin: 'Website inquiry', review: true },
            customerRequest: {
              formId: c.form.id,
              formName: c.form.name,
              receivedAt: now,
              values,
              answers,
              fields: c.questions,
              consent: c.b.settings.requireConsent
                ? {
                    acceptedAt: now,
                    text: c.b.settings.consentText,
                    url: c.b.settings.privacyUrl,
                  }
                : undefined,
            },
          }),
        ),
    ]);
    return success();
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Unable to send inquiry.';
    return json(
      {
        error:
          m === 'RATE_LIMIT'
            ? 'Too many submissions. Try again in 15 minutes.'
            : /D1_|SQLITE|R2_/.test(m)
              ? 'Unable to save inquiry. Please try again.'
              : m,
      },
      m === 'RATE_LIMIT' ? 429 : 400,
    );
  }
}
