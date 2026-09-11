import { rawDb } from './raw';
import type { FormField } from '@/lib/manage-config';
export async function validateQuestionFiles(
  bid: string,
  scope: string,
  answers: Record<string, string>,
  fields: FormField[],
) {
  for (const q of fields.filter((q) =>
    ['File Upload Field', 'Image Upload Field'].includes(q.type),
  )) {
    const id = answers[q.id];
    if (!id) continue;
    const r = await rawDb()
      .prepare(
        "SELECT data FROM resources WHERE id=? AND business_id=? AND kind='response_files' AND archived=0",
      )
      .bind(id, bid)
      .first<{ data: string }>();
    if (!r) throw Error(`Upload a file for ${q.label}.`);
    const d = JSON.parse(r.data);
    if (
      d.scope !== scope ||
      d.field !== q.id ||
      (q.type === 'Image Upload Field' && !d.mime.startsWith('image/'))
    )
      throw Error(`Upload a file for ${q.label}.`);
  }
}
