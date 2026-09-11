'use client';
import { Fragment } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { managerServices, managerGroups } from '@/lib/package-manager';
import { money, type Data, type PackageRecord } from '@/lib/crm';
import { packageDurationLabel, durationRules } from '@/lib/package-pricing';
import { imageUrl } from '@/lib/package-config';
export function BulkPackageTable({
  data,
  selected,
  toggle,
  matches,
  onEdit,
  busy,
}: {
  data: Data;
  selected: string[];
  toggle: (ids: string[], checked: boolean) => void;
  matches: (p: PackageRecord) => boolean;
  onEdit: (p: PackageRecord) => void;
  busy: boolean;
}) {
  function check(ids: string[], label: string) {
    const all = ids.length > 0 && ids.every((id) => selected.includes(id)),
      some = ids.some((id) => selected.includes(id));
    return (
      <Checkbox
        aria-label={label}
        disabled={busy || !ids.length}
        checked={all}
        indeterminate={some && !all}
        onCheckedChange={(v) => toggle(ids, v === true)}
      />
    );
  }
  return (
    <div className="panel bulk-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Select</TableHead>
            <TableHead>Package</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pricing</TableHead>
            <TableHead>Deposit</TableHead>
            <TableHead>Scheduling</TableHead>
            <TableHead>Advanced</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {managerServices(data).map((service) => {
            const groups = managerGroups(data, service)
              .map((g) => ({ ...g, packages: g.packages.filter(matches) }))
              .filter((g) => g.packages.length);
            if (!groups.length) return null;
            return (
              <Fragment key={service}>
                <TableRow className="bulk-service">
                  <TableCell>
                    {check(
                      groups.flatMap((g) => g.packages.map((p) => p.id)),
                      'Select all in ' + service,
                    )}
                  </TableCell>
                  <TableCell colSpan={6}>
                    <strong>{service}</strong> · Service
                  </TableCell>
                </TableRow>
                {groups.map((g) => (
                  <Fragment key={g.name}>
                    <TableRow className="bulk-group">
                      <TableCell>
                        {check(
                          g.packages.map((p) => p.id),
                          'Select all in ' +
                            service +
                            ' / ' +
                            (g.name || 'Ungrouped'),
                        )}
                      </TableCell>
                      <TableCell colSpan={6}>
                        {g.name || 'Ungrouped packages'} · Package group
                      </TableCell>
                    </TableRow>
                    {g.packages.map((p) => {
                      const s = p.settings!;
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            {check([p.id], 'Select ' + p.name)}
                          </TableCell>
                          <TableCell>
                            <button
                              className="bulk-package-name"
                              onClick={() => onEdit(p)}
                            >
                              {p.images?.[0] && (
                                <img src={imageUrl(p.images[0].id)} alt="" />
                              )}
                              {p.name}
                            </button>
                          </TableCell>
                          <TableCell>{s.status}</TableCell>
                          <TableCell>
                            {money(p.price)}
                            <small>
                              {packageDurationLabel(s)} included
                              {s.taxable ? ' · Taxable' : ''}
                            </small>
                            {durationRules(s).dayBased && s.extraDays && (
                              <small>+{money(s.dailyRate * 100)} / day</small>
                            )}
                            {s.extraHours && !durationRules(s).dayBased && (
                              <small>+{money(s.extraRate * 100)} / hour</small>
                            )}
                          </TableCell>
                          <TableCell>
                            {s.depositMode === 'Flat rate'
                              ? money(s.depositValue * 100)
                              : s.depositMode === 'Percentage'
                                ? s.depositValue + '%'
                                : s.depositMode}
                          </TableCell>
                          <TableCell>
                            {s.dateMode}
                            <small>{s.picker}</small>
                          </TableCell>
                          <TableCell>
                            {s.bookingMode}
                            <small>
                              {s.requiredStaff} staff · {s.leadDays} days notice
                            </small>
                            <small>
                              {s.requireBackdrop
                                ? s.allowSkipBackdrop
                                  ? 'Optional backdrop'
                                  : 'Required backdrop'
                                : 'No backdrop'}
                            </small>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
