import type { PreparedStatement } from '@/db/raw';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor, snapshot } from '@/db/store';
import { rawDb } from '@/db/raw';
import { text, cents, serviceList, type PackageRecord } from '@/lib/crm';
import { packageSettings, validatePackageSettings } from '@/lib/package-config';
import { cloneCatalog, deleteCatalogPackages } from '@/db/catalog-mutations';
import { bulkSettingKeys } from '@/lib/bulk-package-fields';
import { validateCatalogPresentation } from '@/lib/catalog-presentation';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const sorts = [
  'Price: low to high',
  'Price: high to low',
  'Name',
  'Custom order',
];
export async function POST(req: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return reply({ error: 'Sign in first.' }, 401);
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return reply({ error: 'Invalid origin.' }, 403);
    const raw = await req.text();
    if (raw.length > 32000) return reply({ error: 'Request too large.' }, 413);
    const body = JSON.parse(raw),
      b = await businessFor(user.userId);
    if (!b) return reply({ error: 'Create your business first.' }, 400);
    const db = rawDb(),
      bid = b.id,
      now = new Date().toISOString(),
      services = JSON.parse(String(b.services)) as string[];
    const rows = (
      await db
        .prepare('SELECT * FROM packages WHERE business_id=?')
        .bind(bid)
        .all()
    ).results;
    const packages = rows.map((p) => ({
      ...p,
      settings: packageSettings(
        JSON.parse(String(p.settings)),
        String(p.duration),
      ),
    })) as unknown as PackageRecord[];
    const groups = (
      await db
        .prepare(
          "SELECT * FROM resources WHERE business_id=? AND kind='package_groups' AND archived=0",
        )
        .bind(bid)
        .all<{ id: string; name: string; data: string }>()
    ).results.map((g) => ({ ...g, data: JSON.parse(String(g.data)) }));
    const validService = (v: unknown) => {
      const service = text(v, 'Service', 70);
      if (!services.includes(service))
        throw Error('Enable this service first.');
      return service;
    };
    const findGroup = (service: string, name: string) =>
      groups.find((g) => g.data.service === service && g.name === name);
    function groupWrite(
      service: string,
      name: string,
      data: Record<string, unknown>,
      existing?: (typeof groups)[number],
    ) {
      return existing
        ? db
            .prepare(
              "UPDATE resources SET name=?,data=?,updated_at=? WHERE id=? AND business_id=? AND kind='package_groups'",
            )
            .bind(name, JSON.stringify(data), now, existing.id, bid)
        : db
            .prepare(
              'INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
            )
            .bind(
              crypto.randomUUID(),
              bid,
              'package_groups',
              name,
              JSON.stringify(data),
              now,
              now,
            );
    }
    if (body.action === 'save_service') {
      const name = text(body.name, 'Service name', 70),
        old =
          body.original === undefined
            ? ''
            : text(body.original, 'Original service', 70);
      if (old && !services.includes(old)) throw Error('Service not found.');
      if (
        name !== old &&
        services.some((s) => s.toLowerCase() === name.toLowerCase())
      )
        throw Error('A service with that name already exists.');
      const next = serviceList(
        old ? services.map((s) => (s === old ? name : s)) : [...services, name],
      );
      const writes = [
        db
          .prepare('UPDATE businesses SET services=? WHERE id=? AND owner_id=?')
          .bind(JSON.stringify(next), bid, user.userId),
      ];
      const record = await db
        .prepare(
          "SELECT id,data FROM resources WHERE business_id=? AND kind='service_settings' AND name=? AND archived=0",
        )
        .bind(bid, old || name)
        .first<{ id: string; data: string }>();
      const presentation =
        body.presentation === undefined
          ? {}
          : validateCatalogPresentation(body.presentation);
      const settingsData = JSON.stringify({
        ...JSON.parse(record?.data || '{}'),
        ...presentation,
      });
      writes.push(
        record
          ? db
              .prepare(
                "UPDATE resources SET name=?,data=?,updated_at=? WHERE business_id=? AND id=? AND kind='service_settings'",
              )
              .bind(name, settingsData, now, bid, record.id)
          : db
              .prepare(
                "INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,'service_settings',?,?,?,?)",
              )
              .bind(crypto.randomUUID(), bid, name, settingsData, now, now),
      );
      if (old && old !== name) {
        writes.push(
          db
            .prepare(
              'UPDATE packages SET service=? WHERE business_id=? AND service=?',
            )
            .bind(name, bid, old),
        );
        writes.push(
          db
            .prepare(
              "UPDATE resources SET data=ed_set(data,'$.service',?),updated_at=? WHERE business_id=? AND kind='package_groups' AND ed_text(data,'$.service')=?",
            )
            .bind(name, now, bid, old),
        );
      }
      await db.batch(writes);
    } else if (body.action === 'reorder_services') {
      const next = serviceList(body.services);
      if (
        next.length !== services.length ||
        next.some((s) => !services.includes(s))
      )
        throw Error('Include every service exactly once.');
      await db
        .prepare('UPDATE businesses SET services=? WHERE id=? AND owner_id=?')
        .bind(JSON.stringify(next), bid, user.userId)
        .run();
    } else if (body.action === 'save_group') {
      const service = validService(body.service),
        name = text(body.name, 'Group name', 100),
        old =
          body.original === undefined
            ? name
            : text(body.original, 'Original group', 100),
        from =
          body.fromService === undefined
            ? service
            : validService(body.fromService);
      const existing = findGroup(from, old);
      if (
        body.original !== undefined &&
        !existing &&
        !packages.some((p) => p.service === from && p.settings?.group === old)
      )
        throw Error('Group not found.');
      if (
        (name !== old || service !== from) &&
        (findGroup(service, name) ||
          packages.some(
            (p) => p.service === service && p.settings?.group === name,
          ))
      )
        throw Error('A group with that name already exists in this service.');
      const sort = body.sort || existing?.data.sort || sorts[0];
      if (!sorts.includes(sort)) throw Error('Choose a valid sort order.');
      const writes = [
        groupWrite(
          service,
          name,
          {
            ...existing?.data,
            ...(body.presentation === undefined
              ? {}
              : validateCatalogPresentation(body.presentation)),
            service,
            sort,
          },
          existing,
        ),
      ];
      if (name !== old || service !== from)
        writes.push(
          db
            .prepare(
              "UPDATE packages SET service=?,settings=ed_set(settings,'$.group',?) WHERE business_id=? AND service=? AND COALESCE(ed_text(settings,'$.group'),'')=?",
            )
            .bind(service, name, bid, from, old),
        );
      await db.batch(writes);
    } else if (body.action === 'sort_group') {
      const service = validService(body.service),
        name = text(body.group ?? '', 'Group', 100, false),
        sort = text(body.sort, 'Sort');
      if (!sorts.includes(sort)) throw Error('Choose a valid sort order.');
      const existing = findGroup(service, name),
        members = packages.filter(
          (p) => p.service === service && (p.settings?.group || '') === name,
        );
      let order = existing?.data.order || '[]';
      if (body.ids !== undefined) {
        if (
          !Array.isArray(body.ids) ||
          body.ids.length !== members.length ||
          new Set(body.ids).size !== members.length ||
          body.ids.some((id: unknown) => !members.some((p) => p.id === id))
        )
          throw Error('Include every package in this group exactly once.');
        order = JSON.stringify(body.ids);
      }
      await groupWrite(
        service,
        name,
        { ...existing?.data, service, sort, order },
        existing,
      ).run();
    } else if (body.action === 'reorder_groups') {
      const service = validService(body.service),
        names = [
          ...new Set([
            ...groups
              .filter((g) => g.data.service === service)
              .map((g) => String(g.name)),
            ...packages
              .filter((p) => p.service === service)
              .map((p) => p.settings?.group || ''),
          ]),
        ];
      if (
        !Array.isArray(body.groups) ||
        body.groups.length !== names.length ||
        new Set(body.groups).size !== names.length ||
        body.groups.some((n: unknown) => !names.includes(String(n)))
      )
        throw Error('Include every group exactly once.');
      await db.batch(
        body.groups.map((name: string, i: number) => {
          const g = findGroup(service, name);
          return groupWrite(
            service,
            name,
            {
              ...g?.data,
              service,
              sort: g?.data.sort || sorts[0],
              position: i,
            },
            g,
          );
        }),
      );
    } else if (body.action === 'bulk_packages') {
      if (
        !Array.isArray(body.ids) ||
        !body.ids.length ||
        body.ids.length > 100 ||
        new Set(body.ids).size !== body.ids.length
      )
        throw Error('Choose between 1 and 100 packages.');
      const targets = body.ids.map((id: unknown) => {
        const p = packages.find((p) => p.id === id);
        if (!p) throw Error('Package not found in your business.');
        return p;
      }) as PackageRecord[];
      const patch = body.changes;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch))
        throw Error('Choose an update.');
      if (
        patch.status !== undefined &&
        !['Public', 'Private', 'Disabled'].includes(patch.status)
      )
        throw Error('Invalid visibility.');
      const service =
        patch.service !== undefined ? validService(patch.service) : undefined;
      const group =
        patch.group !== undefined
          ? text(patch.group, 'Group', 100, false)
          : undefined;
      if (
        patch.priceMode !== undefined &&
        !['Set price', 'Adjust by percent', 'Adjust by amount'].includes(
          patch.priceMode,
        )
      )
        throw Error('Invalid price adjustment.');
      if (
        patch.priceMode &&
        (typeof patch.priceValue !== 'number' ||
          !Number.isFinite(patch.priceValue) ||
          Math.abs(patch.priceValue) > 1000000)
      )
        throw Error('Invalid price adjustment.');
      const settingsPatch = patch.settings ?? {};
      if (
        !settingsPatch ||
        typeof settingsPatch !== 'object' ||
        Array.isArray(settingsPatch) ||
        Object.keys(settingsPatch).some((k) => !bulkSettingKeys.has(k))
      )
        throw Error('Invalid bulk package settings.');
      if (
        !Object.keys(patch).some((k) =>
          ['status', 'service', 'group', 'priceMode'].includes(k),
        ) &&
        !Object.keys(settingsPatch).length
      )
        throw Error('Choose at least one change.');
      if (settingsPatch.includedAddonIds !== undefined) {
        if (!Array.isArray(settingsPatch.includedAddonIds))
          throw Error('Choose valid included add-ons.');
        for (const id of settingsPatch.includedAddonIds) {
          const r = await db
            .prepare(
              "SELECT id FROM resources WHERE id=? AND business_id=? AND kind='addons' AND archived=0",
            )
            .bind(id, bid)
            .first();
          if (!r)
            throw Error('An included add-on is unavailable in your business.');
        }
      }
      const writes = targets.map((p) => {
        const delta: Record<string, unknown> = { ...settingsPatch };
        if (patch.status !== undefined) delta.status = patch.status;
        if (group !== undefined) delta.group = group;
        if (
          group !== undefined &&
          group &&
          !findGroup(service || p.service, group) &&
          !packages.some(
            (x) =>
              x.service === (service || p.service) &&
              x.settings?.group === group,
          )
        )
          throw Error('Create that package group first.');
        let price = p.price;
        if (patch.priceMode === 'Set price')
          price = Math.round(patch.priceValue * 100);
        else if (patch.priceMode === 'Adjust by percent')
          price = Math.round(p.price * (1 + patch.priceValue / 100));
        else if (patch.priceMode === 'Adjust by amount')
          price = p.price + Math.round(patch.priceValue * 100);
        cents(price, 'Updated price');
        validatePackageSettings({ ...p.settings, ...delta }, p.duration);
        return db
          .prepare(
            'UPDATE packages SET price=?,service=?,settings=ed_patch(settings,?) WHERE id=? AND business_id=?',
          )
          .bind(price, service || p.service, JSON.stringify(delta), p.id, bid);
      });
      await db.batch(writes);
    } else if (
      ['duplicate_package', 'duplicate_group', 'duplicate_service'].includes(
        body.action,
      )
    ) {
      const sourceService =
          body.action === 'duplicate_package' ? '' : validService(body.service),
        sourceGroup =
          body.action === 'duplicate_group'
            ? text(body.group, 'Group', 100, false)
            : '';
      const original = packages.find((p) => p.id === body.id);
      if (body.action === 'duplicate_package' && !original)
        throw Error('Package not found in your business.');
      const name = text(
        body.name ??
          (body.action === 'duplicate_package'
            ? original!.name.slice(0, 110) + ' (copy)'
            : ''),
        'Copy name',
        body.action === 'duplicate_service'
          ? 70
          : body.action === 'duplicate_group'
            ? 100
            : 120,
      );
      if (
        body.action === 'duplicate_service' &&
        (services.some((s) => s.toLowerCase() === name.toLowerCase()) ||
          packages.some((p) => p.service.toLowerCase() === name.toLowerCase()))
      )
        throw Error('A service with that name already exists.');
      if (body.action === 'duplicate_service' && services.length >= 30)
        throw Error('You can have up to 30 services.');
      if (
        body.action === 'duplicate_group' &&
        (findGroup(sourceService, name) ||
          packages.some(
            (p) => p.service === sourceService && p.settings?.group === name,
          ))
      )
        throw Error('A group with that name already exists.');
      const members =
        body.action === 'duplicate_package'
          ? [original!]
          : packages.filter(
              (p) =>
                p.service === sourceService &&
                (body.action === 'duplicate_service' ||
                  (p.settings?.group || '') === sourceGroup),
            );
      if (
        body.action === 'duplicate_group' &&
        !members.length &&
        !findGroup(sourceService, sourceGroup)
      )
        throw Error('Group not found.');
      await cloneCatalog(
        String(bid),
        members,
        (p) => ({
          name: body.action === 'duplicate_package' ? name : p.name,
          service: body.action === 'duplicate_service' ? name : p.service,
          group:
            body.action === 'duplicate_group' ? name : p.settings?.group || '',
        }),
        (ids) => {
          const writes: PreparedStatement[] = [];
          if (body.action === 'duplicate_service')
            writes.push(
              db
                .prepare(
                  'UPDATE businesses SET services=? WHERE id=? AND owner_id=?',
                )
                .bind(JSON.stringify([...services, name]), bid, user.userId),
              db
                .prepare(
                  "INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) SELECT ?,business_id,kind,?,data,?,? FROM resources WHERE business_id=? AND kind='service_settings' AND name=? AND archived=0 LIMIT 1",
                )
                .bind(crypto.randomUUID(), name, now, now, bid, sourceService),
            );
          const copiedGroups =
            body.action === 'duplicate_service'
              ? groups.filter((g) => g.data.service === sourceService)
              : body.action === 'duplicate_group'
                ? [findGroup(sourceService, sourceGroup)].filter(Boolean)
                : [];
          for (const g of copiedGroups) {
            const toService =
                body.action === 'duplicate_service' ? name : sourceService,
              toName = body.action === 'duplicate_group' ? name : g!.name;
            let order: string[] = [];
            try {
              order = JSON.parse(g!.data.order || '[]')
                .map((id: string) => ids.get(id))
                .filter(Boolean);
            } catch {}
            writes.push(
              groupWrite(toService, toName, {
                ...g!.data,
                service: toService,
                order: JSON.stringify(order),
              }),
            );
          }
          if (body.action === 'duplicate_group' && !copiedGroups.length)
            writes.push(
              groupWrite(sourceService, name, {
                service: sourceService,
                sort: sorts[0],
              }),
            );
          return writes;
        },
      );
    } else if (
      body.action === 'delete_service' ||
      body.action === 'delete_group' ||
      body.action === 'delete_packages'
    ) {
      let targets: PackageRecord[] = [],
        extra: PreparedStatement[] = [];
      if (body.action === 'delete_packages') {
        if (
          !Array.isArray(body.ids) ||
          !body.ids.length ||
          body.ids.length > 100 ||
          new Set(body.ids).size !== body.ids.length
        )
          throw Error('Choose between 1 and 100 packages.');
        targets = body.ids.map((id: unknown) => {
          const p = packages.find((p) => p.id === id);
          if (!p) throw Error('Package not found in your business.');
          return p;
        });
        if (body.confirm !== 'DELETE')
          throw Error('Type DELETE to confirm permanent package deletion.');
      } else {
        const service = text(body.service, 'Service', 70),
          group = text(body.group ?? '', 'Group', 100, false);
        if (
          !services.includes(service) &&
          !packages.some((p) => p.service === service)
        )
          throw Error('Service not found.');
        const label =
          body.action === 'delete_service' ? service : group || 'Ungrouped';
        if (body.confirm !== label)
          throw Error('Type the exact name to confirm deletion.');
        targets = packages.filter(
          (p) =>
            p.service === service &&
            (body.action === 'delete_service' ||
              (p.settings?.group || '') === group),
        );
        if (
          body.action === 'delete_group' &&
          !targets.length &&
          !findGroup(service, group)
        )
          throw Error('Group not found.');
        if (body.action === 'delete_service')
          extra.push(
            db
              .prepare(
                'UPDATE businesses SET services=? WHERE id=? AND owner_id=?',
              )
              .bind(
                JSON.stringify(services.filter((s) => s !== service)),
                bid,
                user.userId,
              ),
            db
              .prepare(
                "DELETE FROM resources WHERE business_id=? AND ((kind='package_groups' AND ed_text(data,'$.service')=?) OR (kind='service_settings' AND name=?))",
              )
              .bind(bid, service, service),
          );
        else
          extra.push(
            db
              .prepare(
                "DELETE FROM resources WHERE business_id=? AND kind='package_groups' AND name=? AND ed_text(data,'$.service')=?",
              )
              .bind(bid, group, service),
          );
      }
      await deleteCatalogPackages(String(bid), targets, extra);
    } else if (body.action === 'set_catalog_visibility') {
      const service = text(body.service, 'Service', 70),
        group =
          body.group === undefined
            ? undefined
            : text(body.group, 'Group', 100, false),
        status = text(body.status, 'Visibility');
      if (
        !services.includes(service) &&
        !packages.some((p) => p.service === service)
      )
        throw Error('Service not found.');
      if (!['Public', 'Private', 'Disabled'].includes(status))
        throw Error('Invalid visibility.');
      if (
        group !== undefined &&
        !findGroup(service, group) &&
        !packages.some(
          (p) => p.service === service && (p.settings?.group || '') === group,
        )
      )
        throw Error('Group not found.');
      if (group === undefined)
        await db
          .prepare(
            "UPDATE packages SET settings=ed_set(settings,'$.status',?) WHERE business_id=? AND service=?",
          )
          .bind(status, bid, service)
          .run();
      else
        await db
          .prepare(
            "UPDATE packages SET settings=ed_set(settings,'$.status',?) WHERE business_id=? AND service=? AND COALESCE(ed_text(settings,'$.group'),'')=?",
          )
          .bind(status, bid, service, group)
          .run();
    } else throw Error('Unknown package manager action.');
    return reply(await snapshot(user.userId));
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Unable to update packages.';
    if (message.includes('D1_') || message.includes('SQLITE'))
      return reply(
        { error: 'Unable to update the package manager. Please try again.' },
        503,
      );
    return reply({ error: message }, 400);
  }
}
