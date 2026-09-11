import { emptyDetails, ordered } from './manage-config';
import type { Resource } from './settings';

export const checklistCatalog = [
  {
    key: 'equipment',
    name: 'Equipment Checklist',
    description: 'Pack and check the equipment needed for each booking.',
    items: [
      ['Backdrop', 0, 'Days', 'Before'],
      ['Batteries', 0, 'Days', 'Before'],
      ['Camera & Cord', 0, 'Days', 'Before'],
      ['Gaffing Tape', 0, 'Days', 'Before'],
      ['iPad', 0, 'Days', 'Before'],
      ['Laptop', 0, 'Days', 'Before'],
      ['Media', 0, 'Days', 'Before'],
      ['Monitor', 0, 'Days', 'Before'],
      ['Power Cords', 0, 'Days', 'Before'],
      ['Power Strip', 0, 'Days', 'Before'],
      ['Printer', 0, 'Days', 'Before'],
      ['Rolling Cart', 0, 'Days', 'Before'],
    ],
  },
  {
    key: 'pre-event',
    name: 'Pre-event Tasks',
    description: 'Prepare your staff, client, and venue before the event.',
    items: [
      ['Confirm venue insurance requirements', 3, 'Weeks', 'Before'],
      ['Confirm with client', 1, 'Weeks', 'Before'],
      ['Confirm with Staff member', 1, 'Weeks', 'Before'],
      ['Review customer portal', 3, 'Days', 'Before'],
    ],
  },
  {
    key: 'post-event',
    name: 'Post-event Tasks',
    description: 'Finish gallery delivery and follow-up after the event.',
    items: [
      ['Send handwritten card', 2, 'Days', 'After'],
      ['Upload photos to online gallery', 1, 'Days', 'After'],
    ],
  },
] as const;
export function checklistSeed(
  businessId: string,
  resources: Resource[],
): Resource[] {
  return checklistCatalog.flatMap((group, position) => {
    const existing = resources.find(
      (r) =>
        r.kind === 'categories' &&
        r.data.ownerKind === 'checklists' &&
        r.name.toLowerCase() === group.name.toLowerCase(),
    );
    const categoryId = existing?.id || `checklist:${businessId}:${group.key}`;
    const category: Resource = {
      id: categoryId,
      kind: 'categories',
      name: group.name,
      archived: 0,
      data: {
        ownerKind: 'checklists',
        subheader: group.description,
        position,
        showTodo: true,
        staffView: true,
        staffEdit: true,
        clientView: false,
      },
    };
    return [
      ...(existing ? [] : [category]),
      ...group.items.flatMap(([name, offset, timeUnit, timing], i) =>
        resources.some(
          (r) =>
            r.kind === 'checklists' &&
            r.data.categoryId === categoryId &&
            r.name.toLowerCase() === name.toLowerCase(),
        )
          ? []
          : [
              {
                id: `checklist:${businessId}:${group.key}:${i}`,
                kind: 'checklists',
                name,
                archived: 0,
                data: {
                  categoryId,
                  body: name,
                  notes: '',
                  position: i,
                  automaticDue: group.key !== 'equipment',
                  offset,
                  timeUnit,
                  timing,
                  dateBasis: 'Event date',
                  assignee: '',
                  details: JSON.stringify({
                    ...emptyDetails(),
                    packageMode: 'none',
                  }),
                },
              },
            ],
      ),
    ];
  });
}
export function checklistDueLabel(r: Resource) {
  if (r.data.automaticDue === false) return 'No automatic due date';
  const amount = Number(r.data.offset || 0),
    unit = String(r.data.timeUnit || 'Days').toLowerCase();
  return `Due ${amount} ${amount === 1 ? unit.slice(0, -1) : unit} ${String(r.data.timing || 'Before').toLowerCase()} ${String(r.data.dateBasis || 'Event date').toLowerCase()}`;
}
export const checklistItems = (resources: Resource[], categoryId: string) =>
  ordered(
    resources.filter(
      (r) =>
        r.kind === 'checklists' &&
        !r.archived &&
        r.data.categoryId === categoryId,
    ),
  );
export function checklistInTodo(
  task: { categoryId?: string; templateId?: string; showTodo?: boolean },
  resources: Resource[],
) {
  const categoryId =
    task.categoryId ||
    resources.find((r) => r.id === task.templateId)?.data.categoryId;
  const category = resources.find(
    (r) => r.kind === 'categories' && r.id === categoryId,
  );
  return category ? category.data.showTodo !== false : task.showTodo !== false;
}
