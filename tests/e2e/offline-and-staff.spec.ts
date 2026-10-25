import ExcelJS from 'exceljs';
import { expect, test } from '@playwright/test';
import { BOOTH_URL, JANE, fillLead, headline, signInAsStaff, staffLeadCount, submitButton } from './helpers';

test.describe('staff access', () => {
  test('staff endpoints refuse anonymous requests', async ({ request }) => {
    expect((await request.get('/api/export')).status()).toBe(401);
    expect((await request.get('/api/leads/count')).status()).toBe(401);
  });

  test('wrong password is refused; staff link hidden from visitors', async ({ page }) => {
    await page.goto('/staff');
    await page.fill('#password', 'not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('That password is not correct.')).toBeVisible();
    await page.goto(BOOTH_URL);
    await expect(page.getByRole('link', { name: 'Export leads to Excel' })).toHaveCount(0);
  });

  test('the public page can create leads but never read them', async ({ request }) => {
    const res = await request.get('/api/leads');
    expect([404, 405]).toContain(res.status());
  });
});

test.describe('lead storage', () => {
  test('a submit is stored once and appears in the export', async ({ page }) => {
    await signInAsStaff(page);
    const before = await staffLeadCount(page);

    await page.goto(BOOTH_URL);
    await fillLead(page, { ...JANE, firstName: 'Online' });
    await submitButton(page).click();
    await expect(headline(page)).toHaveText('$7.8M to $10.5M');
    await expect.poll(() => staffLeadCount(page)).toBe(before + 1);
    await expect(page.getByText(`(${before + 1} saved)`)).toBeVisible();

    const download = await page.request.get('/api/export?source=saas-north-2026-booth');
    expect(download.status()).toBe(200);
    expect(download.headers()['content-disposition']).toMatch(/SaaS_North_Leads_\d{4}-\d{2}-\d{2}\.xlsx/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await download.body()).buffer as ArrayBuffer);
    const sheet = wb.getWorksheet('SaaS North Leads')!;
    const last = sheet.getRow(sheet.rowCount);
    expect(last.getCell(2).value).toBe('Online');
    expect(last.getCell(5).value).toBe('(647) 451-5164');
    expect(last.getCell(9).value).toBe('Industry-specific');
    expect(last.getCell(10).value).toBe('Healthcare');
    expect(last.getCell(11).value).toBe(2.29);
  });

  test('offline submit still unlocks and is saved exactly once when the network returns', async ({
    page,
    context,
  }) => {
    await signInAsStaff(page);
    const before = await staffLeadCount(page);
    await page.goto(BOOTH_URL);

    await context.setOffline(true);
    await fillLead(page, { ...JANE, firstName: 'Offline' });
    await submitButton(page).click();
    await expect(headline(page)).toHaveText('$7.8M to $10.5M');
    await expect(page.getByText('1 queued')).toBeVisible();

    // Reloading while queued must not lose or duplicate the lead.
    await context.setOffline(false);
    await page.reload();
    await expect.poll(() => staffLeadCount(page), { timeout: 40_000 }).toBe(before + 1);
    await expect(page.getByText('1 queued')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('aspen.leadQueue.v1'))).toBe('[]');

    // Give the 30 second retry loop no chance to send it twice.
    await page.waitForTimeout(1500);
    expect(await staffLeadCount(page)).toBe(before + 1);
  });

  test('a lead queued offline is retried when the browser comes back online', async ({ page, context }) => {
    await signInAsStaff(page);
    const before = await staffLeadCount(page);
    await page.goto(BOOTH_URL);
    await context.setOffline(true);
    await fillLead(page, { ...JANE, firstName: 'Retry' });
    await submitButton(page).click();
    await expect(page.getByText('1 queued')).toBeVisible();
    await context.setOffline(false);
    await expect.poll(() => staffLeadCount(page), { timeout: 40_000 }).toBe(before + 1);
    await expect(page.getByText('1 queued')).toHaveCount(0);
  });
});
