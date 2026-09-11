import type { Data, PackageRecord } from './crm';
export const packageSorts = [
  'Price: low to high',
  'Price: high to low',
  'Name',
  'Custom order',
];
export function managerServices(data: Data) {
  return [
    ...new Set([
      ...(data.business?.services || []),
      ...data.packages.map((p) => p.service),
    ]),
  ];
}
export function managerGroups(data: Data, service: string) {
  const records = (data.resources || []).filter(
    (r) =>
      r.kind === 'package_groups' && !r.archived && r.data.service === service,
  );
  const names = [
    ...new Set([
      ...records.map((r) => r.name),
      ...data.packages
        .filter((p) => p.service === service)
        .map((p) => p.settings?.group || ''),
    ]),
  ];
  return names
    .map((name) => {
      const record = records.find((r) => r.name === name),
        sort = String(record?.data.sort || packageSorts[0]);
      let ids: string[] = [];
      try {
        const parsed = JSON.parse(String(record?.data.order || '[]'));
        if (Array.isArray(parsed)) ids = parsed;
      } catch {}
      const packages = data.packages
        .filter(
          (p) => p.service === service && (p.settings?.group || '') === name,
        )
        .sort((a, b) => {
          if (sort === 'Custom order') {
            const ai = ids.indexOf(a.id),
              bi = ids.indexOf(b.id);
            return (
              (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi) ||
              a.name.localeCompare(b.name)
            );
          }
          return (
            (sort === 'Name'
              ? 0
              : (a.price - b.price) * (sort === packageSorts[1] ? -1 : 1)) ||
            a.name.localeCompare(b.name)
          );
        });
      return { name, service, record, sort, packages };
    })
    .sort(
      (a, b) =>
        Number(a.record?.data.position ?? 100000) -
          Number(b.record?.data.position ?? 100000) ||
        a.name.localeCompare(b.name),
    );
}
export function orderedPackages(data: Data): PackageRecord[] {
  return managerServices(data).flatMap((s) =>
    managerGroups(data, s).flatMap((g) => g.packages),
  );
}
