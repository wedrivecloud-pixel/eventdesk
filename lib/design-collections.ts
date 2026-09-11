import {
  appliesTo,
  details,
  emptyDetails,
  ordered,
  type FormField,
} from './manage-config';
import type { Resource } from './settings';
import type { EventRecord } from './crm';

export const designTabs = [
  'View Templates',
  'Settings',
  'Categories',
  'Layouts',
  'Extra Questions',
  'Sync',
];
export const layoutPresets = [
  '2x6 3 Photo',
  '2x6 4 Photo',
  '4x6 1 Photo Landscape',
  '4x6 1 Photo Portrait',
  '4x6 2 Photo Side',
  '4x6 2 Photo Top',
  '4x6 3 Photo A',
  '4x6 3 Photo B',
  '4x6 3 Photo C',
  '4x6 4 Photo',
];
export const designQuestionTypes = [
  ['Instructions', 'Plain Text'],
  ['Text Field', 'Text Field'],
  ['Multiline Text Box', 'Text Box'],
  ['Dropdown', 'Dropdown'],
  ['Radio', 'Radio Buttons'],
  ['Checkbox Group', 'Checkbox Group'],
  ['Color Picker', 'Color Picker'],
  ['File Upload', 'File Upload Field'],
  ['Song', 'Song'],
];
export function designQuestion(id: string): FormField {
  return {
    id,
    label: 'Tell us how we can personalize this design for you.',
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
  };
}
export function designIds(r: Resource, key: 'tagIds' | 'layoutIds'): string[] {
  try {
    const a = JSON.parse(String(r.data[key] || '[]'));
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function designCollections(resources: Resource[]) {
  return ordered(
    resources.filter(
      (r) =>
        r.kind === 'categories' &&
        r.data.ownerKind === 'designs' &&
        !r.archived,
    ),
  );
}
export function collectionTemplates(
  resources: Resource[],
  collection: Resource,
) {
  const rows = ordered(
    resources.filter(
      (r) =>
        r.kind === 'designs' &&
        r.data.categoryId === collection.id &&
        !r.archived,
    ),
  );
  if (collection.data.sortTemplates === 'Alphabetically')
    rows.sort((a, b) => a.name.localeCompare(b.name));
  if (collection.data.sortTemplates === 'Date Added')
    rows.sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || '')),
    );
  return rows;
}
export function designSeed(bid: string, resources: Resource[]): Resource[] {
  const existing = resources.find(
    (r) =>
      r.kind === 'categories' &&
      r.data.ownerKind === 'designs' &&
      r.name.toLowerCase() === 'layout options',
  );
  const id = existing?.id || `design:${bid}:layouts`,
    rows: Resource[] = [];
  if (!existing)
    rows.push({
      id,
      kind: 'categories',
      name: 'Layout Options',
      archived: 0,
      data: {
        ownerKind: 'designs',
        sortTemplates: 'Default',
        position: 0,
        details: JSON.stringify({
          ...emptyDetails(),
          fields: [designQuestion(`${id}:personalize`)],
        }),
      },
    });
  layoutPresets.forEach((name, i) => {
    if (
      !resources.some(
        (r) =>
          r.kind === 'designs' &&
          r.data.categoryId === id &&
          r.name.toLowerCase() === name.toLowerCase(),
      )
    )
      rows.push({
        id: `design:${bid}:preset:${i}`,
        kind: 'designs',
        name,
        archived: 0,
        data: {
          categoryId: id,
          preset: name,
          position: i,
          showGallery: true,
          tagIds: '[]',
          layoutIds: '[]',
          details: JSON.stringify(emptyDetails()),
        },
      });
  });
  return rows;
}
export type BookingDesignCollection = {
  collectionId: string;
  name: string;
  templates: Resource[];
  fields: FormField[];
  selectedId: string;
  selectedTemplate?: Resource;
  answers: Record<string, string>;
};
export function designSnapshot(
  collection: Resource,
  resources: Resource[],
  event: EventRecord,
  previous?: BookingDesignCollection,
): BookingDesignCollection {
  const ids = event.items.map((p) => p.id),
    fields = details(collection).fields;
  const templates = collectionTemplates(resources, collection).filter((t) =>
    appliesTo(t, ids),
  );
  const selectedId =
    previous?.selectedId ||
    (templates.some((t) => t.id === event.operations?.designId)
      ? event.operations!.designId!
      : '');
  return {
    collectionId: collection.id,
    name: collection.name,
    templates,
    fields,
    selectedId,
    selectedTemplate:
      previous?.selectedTemplate || templates.find((t) => t.id === selectedId),
    answers: { ...previous?.answers },
  };
}
export function syncDesigns(
  event: EventRecord,
  resources: Resource[],
  collection: Resource,
  choices: { add: boolean; update: boolean; remove: boolean },
) {
  const before = event.operations?.designCollections || [],
    previous = before.find((x) => x.collectionId === collection.id);
  const matches =
    !collection.archived &&
    appliesTo(
      collection,
      event.items.map((p) => p.id),
    );
  if (previous && !matches && choices.remove)
    return before.filter((x) => x.collectionId !== collection.id);
  if (previous && matches && choices.update)
    return before.map((x) =>
      x.collectionId === collection.id
        ? designSnapshot(collection, resources, event, x)
        : x,
    );
  if (!previous && matches && choices.add)
    return [...before, designSnapshot(collection, resources, event)];
  return before;
}
export function designSyncChange(
  event: EventRecord,
  resources: Resource[],
  collection: Resource,
) {
  const previous = event.operations?.designCollections?.find(
    (c) => c.collectionId === collection.id,
  );
  const matches =
    !collection.archived &&
    appliesTo(
      collection,
      event.items.map((p) => p.id),
    );
  if (!previous && matches) return 'Add';
  if (previous && !matches) return 'Remove';
  if (
    previous &&
    matches &&
    JSON.stringify(previous) !==
      JSON.stringify(designSnapshot(collection, resources, event, previous))
  )
    return 'Update';
  return '';
}
