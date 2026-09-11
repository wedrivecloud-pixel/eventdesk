'use client';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { bulkPackageSections } from '@/lib/bulk-package-fields';
import { packageSettings } from '@/lib/package-config';
import type { Resource } from '@/lib/settings';
export function BulkPackageSettings({
  value,
  onChange,
  resources,
  busy,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  resources: Resource[];
  busy: boolean;
}) {
  const defaults = packageSettings();
  function set(key: string, v: unknown) {
    onChange({ ...value, [key]: v });
  }
  return (
    <div className="bulk-settings-sections">
      <p className="muted">
        Only checked settings will change. Unchecked settings keep each
        package’s current value.
      </p>
      {Object.entries(bulkPackageSections).map(([name, fields]) => (
        <details key={name}>
          <summary>{name}</summary>
          <div className="form-grid">
            {fields.map((f) => {
              const enabled = Object.hasOwn(value, f.key);
              return (
                <div className="field bulk-setting" key={f.key}>
                  <label className="package-toggle">
                    <Checkbox
                      disabled={busy}
                      checked={enabled}
                      onCheckedChange={(checked) => {
                        if (checked)
                          set(f.key, defaults[f.key as keyof typeof defaults]);
                        else {
                          const next = { ...value };
                          delete next[f.key];
                          onChange(next);
                        }
                      }}
                    />
                    <span>{f.label}</span>
                  </label>
                  {enabled &&
                    (f.key === 'days' ? (
                      <div className="bulk-days">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                          (d, i) => (
                            <label key={d}>
                              <Checkbox
                                aria-label={d}
                                disabled={busy}
                                checked={(value.days as number[]).includes(i)}
                                onCheckedChange={(v) =>
                                  set(
                                    'days',
                                    v
                                      ? [...(value.days as number[]), i]
                                      : (value.days as number[]).filter(
                                          (x) => x !== i,
                                        ),
                                  )
                                }
                              />
                              {d}
                            </label>
                          ),
                        )}
                      </div>
                    ) : f.key === 'includedAddonIds' ? (
                      <div className="bulk-addons">
                        {resources
                          .filter((r) => r.kind === 'addons' && !r.archived)
                          .map((r) => (
                            <label className="package-toggle" key={r.id}>
                              <Checkbox
                                disabled={busy}
                                checked={(
                                  value.includedAddonIds as string[]
                                ).includes(r.id)}
                                onCheckedChange={(v) =>
                                  set(
                                    'includedAddonIds',
                                    v
                                      ? [
                                          ...(value.includedAddonIds as string[]),
                                          r.id,
                                        ]
                                      : (
                                          value.includedAddonIds as string[]
                                        ).filter((x) => x !== r.id),
                                  )
                                }
                              />
                              {r.name}
                            </label>
                          ))}
                        <small>
                          Leaving all unchecked clears included add-ons.
                        </small>
                      </div>
                    ) : f.type === 'select' || f.type === 'checkbox' ? (
                      <Select
                        value={String(value[f.key])}
                        onValueChange={(v) =>
                          set(
                            f.key,
                            f.type === 'checkbox'
                              ? v === 'true'
                              : f.key === 'increment'
                                ? Number(v)
                                : String(v),
                          )
                        }
                        disabled={busy}
                      >
                        <SelectTrigger aria-label={'New ' + f.label}>
                          <SelectValue>
                            {f.type === 'checkbox'
                              ? value[f.key]
                                ? 'Yes'
                                : 'No'
                              : String(value[f.key])}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(f.type === 'checkbox'
                            ? ['true', 'false']
                            : f.options!
                          ).map((o) => (
                            <SelectItem key={o} value={o}>
                              {f.type === 'checkbox'
                                ? o === 'true'
                                  ? 'Yes'
                                  : 'No'
                                : o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <input
                        aria-label={'New ' + f.label}
                        disabled={busy}
                        type={
                          f.type === 'number'
                            ? 'number'
                            : f.key.endsWith('Time')
                              ? 'time'
                              : 'text'
                        }
                        min={f.min}
                        max={f.max}
                        step={
                          ['extraRate', 'depositValue'].includes(f.key)
                            ? '0.01'
                            : '1'
                        }
                        maxLength={f.key === 'slots' ? 1000 : 250}
                        value={String(value[f.key] ?? '')}
                        onChange={(e) =>
                          set(
                            f.key,
                            f.type === 'number'
                              ? Number(e.target.value)
                              : e.target.value,
                          )
                        }
                      />
                    ))}
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
