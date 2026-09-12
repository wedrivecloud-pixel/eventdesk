import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const base = process.env.QA_BASE_URL || 'http://localhost:3100';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOfoAAAAASUVORK5CYII=',
  'base64',
);
const file = (name: string) => ({
  name,
  mimeType: 'image/png',
  buffer: Buffer.concat([png, Buffer.from(name)]),
});
async function signIn(context: BrowserContext) {
  if (process.env.QA_AUTH_MODE === 'sites-local') {
    if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
      throw Error('Local beta tests require loopback.');
    await context.addCookies([
      { name: '__sites_local_auth', value: '1', url: base },
    ]);
  } else {
    if (process.env.SEED_SYNTHETIC_DATA !== 'true')
      throw Error('Synthetic QA required.');
    const response = await context.request.post(
      base + '/api/auth/sign-in/email',
      {
        headers: { Origin: base },
        data: {
          email: 'qa-other@example.test',
          password: process.env.SEED_PASSWORD,
        },
      },
    );
    expect(response.status()).toBe(200);
  }
}
async function newPackage(page: Page, name: string) {
  await page.goto(base + '/?section=packages');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page
    .getByRole('menuitem', { name: 'New package', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Package title', { exact: true }).fill(name);
  return dialog;
}
async function removeFixtures(context: BrowserContext, name: string) {
  const data = await (await context.request.get(base + '/api/crm')).json();
  const ids = data.packages
    .filter((p: { name: string }) => p.name === name)
    .map((p: { id: string }) => p.id);
  if (ids.length) {
    const response = await context.request.post(base + '/api/packages', {
      headers: { Origin: base },
      data: { action: 'delete_packages', ids, confirm: 'DELETE' },
    });
    expect(response.status()).toBe(200);
  }
}

test('closing a new package discards selected photos without creating records or uploading', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await signIn(context);
  const page = await context.newPage();
  const name = `QA discard photos ${crypto.randomUUID()}`;
  let writes = 0;
  page.on('request', (request) => {
    if (request.method() !== 'GET' && /\/api\/(crm|package-images)/.test(request.url())) writes++;
  });
  try {
    const dialog = await newPackage(page, name);
    await dialog.getByLabel('Choose package photos').setInputFiles([file('primary.png'), file('extra.png')]);
    await dialog.locator('[aria-label="Photos to save"]').scrollIntoViewIfNeeded();
    await expect(dialog.locator('.package-photo')).toHaveCount(2);
    const image = dialog.locator('.package-photo img').first();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: 'artifacts/package-photos-mobile.png', fullPage: false });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    const fresh = await newPackage(page, name);
    await expect(fresh.locator('.package-photo')).toHaveCount(0);
    expect(writes).toBe(0);
  } finally {
    await context.close();
  }
});

test('new package selects, previews, changes primary and saves photos to its exact record', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await signIn(context);
  const name = `QA staged photos ${crypto.randomUUID()}`;
  const page = await context.newPage();
  let writes = 0;
  page.on('request', (request) => {
    if (
      request.method() !== 'GET' &&
      /\/api\/(crm|package-images)/.test(request.url())
    )
      writes++;
  });
  try {
    // Duplicate titles must not attach the new photos to an older package.
    const initial = await (await context.request.get(base + '/api/crm')).json();
    const duplicateResponse = await context.request.post(base + '/api/crm', {
      headers: { Origin: base },
      data: {
        action: 'save_package',
        name,
        service: initial.business.services[0],
        price: 10000,
        duration: '4 hr',
        description: 'Existing synthetic package',
      },
    });
    expect(duplicateResponse.status()).toBe(200);
    const duplicate = (await duplicateResponse.json()).savedPackageId;
    expect(duplicate).toBeTruthy();
    const dialog = await newPackage(page, name);
    const chooser = dialog.getByLabel('Choose package photos');
    await chooser.setInputFiles([
      file('first.png'),
      file('second.png'),
      file('remove.png'),
    ]);
    await expect(dialog.locator('.package-photo')).toHaveCount(3);
    await dialog
      .getByRole('button', { name: 'Remove selected photo 3' })
      .click();
    await dialog
      .locator('.package-photo')
      .nth(1)
      .getByRole('button', { name: 'Make primary' })
      .click();
    await expect(
      dialog.locator('.package-photo').first().getByRole('img'),
    ).toHaveAttribute('alt', 'Selected package photo: second.png');
    await chooser.setInputFiles({
      name: 'bad.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('invalid'),
    });
    await expect(dialog.getByRole('alert')).toContainText('PNG, JPEG or WebP');
    await chooser.setInputFiles({
      name: 'large.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await expect(dialog.getByRole('alert')).toContainText('5 MB');
    await chooser.setInputFiles(
      Array.from({ length: 9 }, (_, i) => file(`${i}.png`)),
    );
    await expect(dialog.getByRole('alert')).toContainText('up to 10 photos');
    await expect(dialog.locator('.package-photo')).toHaveCount(2);
    await dialog.getByRole('tab', { name: 'Overview', exact: true }).click();
    const cover = dialog.locator('.package-cover img');
    await expect(cover).toHaveAttribute(
      'alt',
      'Selected package photo: second.png',
    );
    expect(
      await cover.evaluate(
        (element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0,
      ),
    ).toBe(true);
    await dialog.getByRole('tab', { name: 'General', exact: true }).click();
    await dialog
      .getByLabel('Description / what’s included')
      .fill('All details and photos before saving.');
    expect(writes).toBe(0);
    await page.screenshot({
      path: 'artifacts/package-photos-before-save-mobile.png',
      fullPage: false,
    });
    await dialog
      .getByRole('button', { name: 'Save package', exact: true })
      .click();
    await expect(
      dialog.getByRole('tab', { name: 'Overview', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    const data = await (await context.request.get(base + '/api/crm')).json();
    const matches = data.packages.filter(
      (p: { name: string }) => p.name === name,
    );
    expect(matches).toHaveLength(2);
    expect(
      matches.find((p: { id: string }) => p.id === duplicate).images,
    ).toHaveLength(0);
    const created = matches.find((p: { id: string }) => p.id !== duplicate);
    expect(created.description).toBe('All details and photos before saving.');
    expect(created.images).toHaveLength(2);
    const primary = created.images.find(
      (p: { is_primary: number }) => p.is_primary,
    );
    const imageResponse = await context.request.get(
      base + '/api/package-images?id=' + primary.id,
    );
    expect(await imageResponse.body()).toEqual(file('second.png').buffer);
    // Existing-package immediate uploads still work after creation.
    await dialog.getByRole('tab', { name: 'General', exact: true }).click();
    await dialog
      .getByLabel('Upload package image')
      .setInputFiles(file('third.png'));
    await expect(dialog.locator('.package-photo')).toHaveCount(3);
  } finally {
    await removeFixtures(context, name);
    await context.close();
  }
});

test('partial photo upload failure keeps pending photos and retries without another package', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await signIn(context);
  const page = await context.newPage();
  const name = `QA photo retry ${crypto.randomUUID()}`;
  let uploads = 0;
  let releaseUpload: () => void = () => {};
  const holdUpload = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });
  await page.route('**/api/package-images?package=*', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    uploads++;
    if (uploads === 1) await holdUpload;
    if (uploads === 2)
      return route.fulfill({
        status: 503,
        json: { error: 'Synthetic upload failure' },
      });
    await route.continue();
  });
  try {
    const dialog = await newPackage(page, name);
    await dialog
      .getByLabel('Choose package photos')
      .setInputFiles([file('one.png'), file('two.png')]);
    await dialog
      .getByRole('button', { name: 'Save package', exact: true })
      .click();
    await expect.poll(() => uploads).toBe(1);
    await expect(
      dialog.getByRole('button', {
        name: 'Saving package and photos…',
        exact: true,
      }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    releaseUpload();
    await expect(dialog.getByRole('alert')).toContainText(
      'Package details were saved',
    );
    await expect(
      dialog.locator('[aria-label="Photos to save"] .package-photo'),
    ).toHaveCount(1);
    let data = await (await context.request.get(base + '/api/crm')).json();
    const created = data.packages.find(
      (p: { name: string }) => p.name === name,
    );
    expect(created.images).toHaveLength(1);
    await dialog
      .getByRole('button', { name: 'Save package changes', exact: true })
      .click();
    await expect(
      dialog.getByRole('tab', { name: 'Overview', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    data = await (await context.request.get(base + '/api/crm')).json();
    const matches = data.packages.filter(
      (p: { name: string }) => p.name === name,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(created.id);
    expect(matches[0].images).toHaveLength(2);
    expect(uploads).toBe(3);
    await page.reload();
    data = await (await context.request.get(base + '/api/crm')).json();
    expect(
      data.packages.find((p: { id: string }) => p.id === created.id).images,
    ).toHaveLength(2);
  } finally {
    releaseUpload();
    await removeFixtures(context, name);
    await context.close();
  }
});
