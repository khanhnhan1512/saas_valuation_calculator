import { expect, test } from '@playwright/test';
import { BOOTH_URL, assertNoScroll, errorLine, fillLead, headline, submitButton } from './helpers';

const SIZES = [
  [1024, 768],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
] as const;

test.describe('one screen, no scrolling', () => {
  for (const [width, height] of SIZES) {
    test(`${width}x${height}: locked, error with "Other" open, and unlocked`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(BOOTH_URL);
      await assertNoScroll(page);

      await page.getByRole('button', { name: 'Other', exact: true }).click();
      await submitButton(page).click();
      await expect(errorLine(page)).not.toHaveText('');
      await assertNoScroll(page);

      await page.getByRole('button', { name: 'Raising capital', exact: true }).click();
      await fillLead(page, {
        arr: '4000000',
        selection: 'Healthcare',
        firstName: 'Layout',
        lastName: 'Test',
        company: 'Example Co',
        email: 'layout@example.com',
        phone: '4165550101',
      });
      await submitButton(page).click();
      await expect(headline(page)).toHaveText('$7.8M to $10.5M');
      await assertNoScroll(page);
    });
  }

  test('phones stack into one column and may scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const [left, right] = await Promise.all([
      page.locator('#arr').boundingBox(),
      page.locator('#result').boundingBox(),
    ]);
    expect(right!.y).toBeGreaterThan(left!.y);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });
});

test.describe('kiosk idle reset', () => {
  async function submitAndWait(page: import('@playwright/test').Page, url: string) {
    await page.clock.install();
    await page.goto(url);
    await fillLead(page);
    await submitButton(page).click();
    await expect(headline(page)).toHaveText('$7.8M to $10.5M');
  }

  test('kiosk=1 resets 2 minutes after a result with no activity', async ({ page }) => {
    await submitAndWait(page, BOOTH_URL);
    await page.clock.runFor('01:50');
    await expect(headline(page)).toHaveText('$7.8M to $10.5M');
    await page.clock.runFor('00:15');
    await expect(page.locator('#result')).toContainText('Your value range is ready to generate');
    await expect(page.locator('#lead-firstName')).toHaveValue('');
  });

  test('activity postpones the reset', async ({ page }) => {
    await submitAndWait(page, BOOTH_URL);
    await page.clock.runFor('01:30');
    await page.mouse.click(5, 5);
    await page.clock.runFor('01:30');
    await expect(headline(page)).toHaveText('$7.8M to $10.5M');
  });

  test('without kiosk=1 the result stays', async ({ page }) => {
    await submitAndWait(page, '/');
    await page.clock.runFor('03:00');
    await expect(headline(page)).toHaveText('$7.8M to $10.5M');
  });
});

test('web app manifest is served for the iPad home screen', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.start_url).toBe('/?source=saas-north-2026-booth&kiosk=1');
});
