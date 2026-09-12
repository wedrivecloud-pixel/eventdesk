import { test, expect } from '@playwright/test';
import { signInOwner } from './owner-session';

const base = process.env.QA_BASE_URL || 'http://localhost:3100';
test('proposal client picker reuses contacts, accepts new clients, and preserves history', async ({ browser }) => {
  const owner = await browser.newContext();
  await signInOwner(owner, base);
  const page = await owner.newPage();
  page.setDefaultTimeout(20000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const suffix = crypto.randomUUID().slice(0, 8), prefix = `QA client picker ${suffix}`;
  const email = `qa-picker-${suffix}@example.test`, other = `qa-other-${suffix}@example.test`;
  const client = `QA Morgan ${suffix}`;
  let packageId = '';
  const post = async (path: string, data: Record<string, unknown>) => {
    const r = await owner.request.post(base + path, { headers: { Origin: base }, data });
    expect(r.status(), await r.text()).toBe(200);
    return r.json();
  };
  const snapshot = async () => (await owner.request.get(base + '/api/crm')).json();
  try {
    const initial = await snapshot();
    packageId = (await post('/api/crm', { action: 'save_package', name: prefix, service: initial.business.services[0], price: 50000, duration: '4 hr', description: 'Synthetic fixture', settings: { status: 'Private' } })).savedPackageId;
    for (const [label, contact, phone] of [['first', email, '555-0101'], ['repeat', email.toUpperCase(), '555-0102'], ['namesake', other, '']]) {
      await post('/api/crm', { action: 'save_event', initialStatus: 'lead', title: `${prefix} ${label}`, client, email: contact, phone, date: '2032-05-14', time: '17:00', packageIds: [packageId] });
    }
    await page.goto(base + '/?section=proposals');
    await page.getByRole('button', { name: 'New proposal', exact: true }).click();
    const search = page.getByRole('combobox', { name: 'Find an existing client' });
    await expect(search).toBeEnabled();
    await search.fill(client);
    await expect(page.getByRole('option')).toHaveCount(2);
    await search.fill(email.toUpperCase());
    await expect(page.getByRole('option')).toHaveCount(1);
    await page.getByRole('option').click();
    await expect(page.getByLabel('Client name', { exact: true })).toHaveValue(client);
    await expect(page.getByLabel('Client email', { exact: true })).toHaveValue(email);
    await expect(page.getByLabel('Phone (optional)', { exact: true })).toHaveValue('555-0102');
    // Keyboard selection of a namesake must clear the prior phone.
    await search.fill(other);
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toContainText(other);
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(page.getByLabel('Client email', { exact: true })).toHaveValue(other);
    await expect(page.getByLabel('Phone (optional)', { exact: true })).toHaveValue('');
    await page.getByRole('button', { name: 'Add new client', exact: true }).click();
    await expect(page.getByLabel('Client name', { exact: true })).toHaveValue('');
    await page.getByLabel('Client email', { exact: true }).fill(` ${email.toUpperCase()} `);
    await expect(page.getByRole('status').filter({ hasText: 'Existing client:' })).toBeVisible();
    await page.getByRole('button', { name: 'Use saved contact details' }).click();
    await page.getByLabel('Event title', { exact: true }).fill(prefix + ' saved existing');
    await page.getByLabel('Event date', { exact: true }).fill('2032-05-15');
    await page.locator('.check-card').filter({ hasText: prefix }).click();
    await page.getByRole('button', { name: 'Create proposal', exact: true }).click();
    await expect(search).toHaveCount(0);
    let saved = (await snapshot()).events.find((e: { title: string }) => e.title === prefix + ' saved existing');
    expect(saved.client).toBe(client);
    expect(saved.email).toBe(email);
    expect(saved.phone).toBe('555-0102');
    expect(saved.status).toBe('proposal');
    // A separate new client can be added at mobile width; cancelling changes nothing.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'New proposal', exact: true }).click();
    const newEmail = `qa-new-${suffix}@example.test`;
    await search.fill(newEmail);
    await expect(page.getByText('No matching clients.', { exact: false })).toBeVisible();
    await page.screenshot({ path: 'artifacts/proposal-client-picker-mobile.png' });
    await search.press('Escape');
    await page.getByRole('button', { name: 'Add new client', exact: true }).click();
    await expect(page.getByLabel('Client email', { exact: true })).toHaveValue(newEmail);
    await page.getByLabel('Client name', { exact: true }).fill('QA New Client');
    await page.getByLabel('Event title', { exact: true }).fill(prefix + ' saved new');
    await page.getByLabel('Event date', { exact: true }).fill('2032-05-16');
    await page.locator('.check-card').filter({ hasText: prefix }).click();
    const picker = page.getByRole('region', { name: 'Proposal client' });
    await picker.scrollIntoViewIfNeeded();
    const bounds = await picker.boundingBox();
    expect(bounds!.width).toBeLessThan(390);
    await page.getByRole('button', { name: 'Create proposal', exact: true }).click();
    await expect(search).toHaveCount(0);
    const final = await snapshot();
    saved = final.events.find((e: { title: string }) => e.title === prefix + ' saved new');
    expect(saved.email).toBe(newEmail);
    expect(final.events.find((e: { title: string }) => e.title === prefix + ' first').phone).toBe('555-0101');
    await page.getByRole('button', { name: 'New proposal', exact: true }).click();
    await search.fill(newEmail);
    await expect(page.getByRole('option')).toHaveCount(1);
    await search.press('Escape');
    await page.setViewportSize({ width: 1280, height: 900 });
    await search.fill(email);
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toContainText(email);
    await page.getByRole('option').click();
    await expect(page.getByLabel('Client email', { exact: true })).toHaveValue(email);
    await expect(page.getByRole('option')).toHaveCount(0);
    await page.screenshot({ path: 'artifacts/proposal-client-picker-desktop.png' });
    expect(errors).toEqual([]);
  } finally {
    const fixtures = (await snapshot()).events.filter((e: { title: string }) => e.title.startsWith(prefix));
    if (fixtures.length) await post('/api/sales', { action: 'event_lifecycle', ids: fixtures.map((e: { id: string }) => e.id), lifecycle: 'Deleted' });
    packageId ||= (await snapshot()).packages.find((p: { name: string }) => p.name === prefix)?.id || '';
    if (packageId) await post('/api/packages', { action: 'delete_packages', ids: [packageId], confirm: 'DELETE' });
    await owner.close();
  }
});
