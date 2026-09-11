import type { ChatGPTUser } from '@/app/chatgpt-auth';
import { rawDb } from './raw';
import {
  checkedProfile,
  defaultProfile,
  type AccountState,
} from '@/lib/user-account';
import { text } from '@/lib/crm';
import { emptyDetails } from '@/lib/manage-config';
import type { Resource } from '@/lib/settings';
import { defaultDashboard, checkedDashboard } from '@/lib/overview';
import {
  defaultOverview,
  checkedOverview,
  checkedRevenue,
} from '@/lib/overview-preferences';
const profileId = (bid: string, uid: string) =>
  'account-profile:' + bid + ':' + uid;
export async function accountState(
  bid: string,
  user: ChatGPTUser,
): Promise<AccountState> {
  const row = await rawDb()
    .prepare(
      "SELECT data,updated_at FROM resources WHERE id=? AND business_id=? AND kind='account_profile' AND archived=0",
    )
    .bind(profileId(bid, user.userId), bid)
    .first<{ data: string; updated_at: string }>();
  const stored = JSON.parse(row?.data || '{}');
  const docs = await rawDb()
    .prepare(
      "SELECT id,kind,name,data,archived,created_at FROM resources WHERE business_id=? AND kind='client_documents' AND archived=0 ORDER BY name",
    )
    .bind(bid)
    .all<Omit<Resource, 'data'> & { data: string }>();
  return {
    identity: {
      displayName: user.displayName,
      email: user.email,
      fullName: user.fullName,
    },
    profile: { ...defaultProfile(), ...stored.profile },
    supportDraft: stored.supportDraft || { subject: '', body: '' },
    dashboard: stored.dashboard || defaultDashboard(),
    overview: stored.overview || defaultOverview(stored.dashboard),
    overviewRevenue: stored.overviewRevenue,
    updatedAt: row?.updated_at || '',
    documents: docs.results.map((r) => ({ ...r, data: JSON.parse(r.data) })),
  };
}
async function validateMedia(bid: string, id: string, imageOnly = false) {
  if (!id) return;
  const r = await rawDb()
    .prepare(
      "SELECT data FROM resources WHERE id=? AND business_id=? AND kind='media' AND archived=0",
    )
    .bind(id, bid)
    .first<{ data: string }>();
  if (
    !r ||
    (imageOnly && !String(JSON.parse(r.data).mime).startsWith('image/'))
  )
    throw Error('Choose an available file from this business.');
}
export async function accountAction(
  bid: string,
  user: ChatGPTUser,
  body: Record<string, any>,
) {
  const db = rawDb(),
    state = await accountState(bid, user),
    now = new Date(
      Math.max(Date.now(), (Date.parse(state.updatedAt) || 0) + 1),
    ).toISOString();
  if (
    [
      'save_profile',
      'save_support_draft',
      'save_dashboard',
      'save_overview',
      'save_overview_revenue',
    ].includes(body.action)
  ) {
    if (body.updatedAt !== state.updatedAt) throw Error('CONFLICT');
    let profile = state.profile,
      supportDraft = state.supportDraft,
      dashboard = state.dashboard || defaultDashboard(),
      overview = state.overview,
      overviewRevenue = state.overviewRevenue;
    if (body.action === 'save_profile') {
      profile = checkedProfile(body.profile || {});
      if (profile.staffId) {
        const staff = await db
          .prepare(
            "SELECT id FROM resources WHERE id=? AND business_id=? AND kind='staff' AND archived=0",
          )
          .bind(profile.staffId, bid)
          .first();
        if (!staff)
          throw Error('Choose an active staff profile in this business.');
      }
      await validateMedia(bid, profile.photoId, true);
    } else if (body.action === 'save_dashboard')
      dashboard = checkedDashboard(body.dashboard);
    else if (body.action === 'save_overview')
      overview = checkedOverview(body.overview);
    else if (body.action === 'save_overview_revenue')
      overviewRevenue = checkedRevenue(body.preferences);
    else
      supportDraft = {
        subject: text(body.subject ?? '', 'Subject', 200, false),
        body: text(body.body ?? '', 'Message', 10000, false),
      };
    const id = profileId(bid, user.userId),
      payload = JSON.stringify({
        profile,
        supportDraft,
        dashboard,
        overview,
        overviewRevenue,
        details: JSON.stringify({
          ...emptyDetails(),
          images: profile.photoId ? [profile.photoId] : [],
        }),
      });
    const result = await db
      .prepare(
        "INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,'account_profile','My profile',?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE resources.business_id=? AND resources.kind='account_profile' AND resources.updated_at=?",
      )
      .bind(id, bid, payload, now, now, bid, state.updatedAt)
      .run();
    if (!result.meta.changes) throw Error('CONFLICT');
  } else if (body.action === 'save_document') {
    const name = text(body.name, 'File name or description', 200),
      mediaId = text(body.mediaId, 'File', 200);
    await validateMedia(bid, mediaId);
    if (
      typeof body.staffView !== 'boolean' ||
      typeof body.customerView !== 'boolean'
    )
      throw Error('Choose valid document visibility options.');
    const data = JSON.stringify({
      mediaId,
      staffView: body.staffView,
      customerView: body.customerView,
      details: JSON.stringify({ ...emptyDetails(), attachments: [mediaId] }),
    });
    if (body.id) {
      const result = await db
        .prepare(
          "UPDATE resources SET name=?,data=?,updated_at=? WHERE id=? AND business_id=? AND kind='client_documents' AND archived=0",
        )
        .bind(name, data, now, text(body.id, 'Document', 200), bid)
        .run();
      if (!result.meta.changes) throw Error('Document not found.');
    } else
      await db
        .prepare(
          "INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,'client_documents',?,?,?,?)",
        )
        .bind(crypto.randomUUID(), bid, name, data, now, now)
        .run();
  } else if (body.action === 'archive_document') {
    const result = await db
      .prepare(
        "UPDATE resources SET archived=1,updated_at=? WHERE id=? AND business_id=? AND kind='client_documents' AND archived=0",
      )
      .bind(now, text(body.id, 'Document', 200), bid)
      .run();
    if (!result.meta.changes) throw Error('Document not found.');
  } else throw Error('Unknown account action.');
}
