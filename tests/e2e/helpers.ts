import { expect, type Page } from '@playwright/test';
import { E2E_STAFF_PASSWORD } from './e2e-env';

export const BOOTH_URL = '/?source=saas-north-2026-booth&kiosk=1';

export interface LeadInput {
  arr?: string;
  selection?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  email?: string;
  phone?: string;
  nextMove?: string;
}

export const JANE: Required<LeadInput> = {
  arr: '4000000',
  selection: 'Healthcare',
  firstName: 'Jane',
  lastName: 'Doe',
  company: 'Northwind Health',
  email: 'jane@northwind.io',
  phone: '6474515164',
  nextMove: 'Selling the business',
};

export async function fillLead(page: Page, lead: LeadInput = JANE) {
  if (lead.arr) await page.fill('#arr', lead.arr);
  if (lead.selection) await page.selectOption('#selection', lead.selection);
  if (lead.firstName) await page.fill('#lead-firstName', lead.firstName);
  if (lead.lastName) await page.fill('#lead-lastName', lead.lastName);
  if (lead.company) await page.fill('#lead-company', lead.company);
  if (lead.email) await page.fill('#lead-email', lead.email);
  if (lead.phone) await page.fill('#lead-phone', lead.phone);
  if (lead.nextMove) await page.getByRole('button', { name: lead.nextMove, exact: true }).click();
}

export const submitButton = (page: Page) => page.locator('button[type=submit]');
// Scoped to the form: Next.js adds its own role="alert" route announcer.
export const errorLine = (page: Page) => page.locator('form [role="alert"]');
export const headline = (page: Page) => page.locator('#result p').nth(1);

export async function assertNoScroll(page: Page) {
  const m = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    ih: window.innerHeight,
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
    clipped: [...document.querySelectorAll('[data-card]')].filter((c) => c.scrollHeight > c.clientHeight + 1)
      .length,
  }));
  expect(m.sh, 'page height').toBeLessThanOrEqual(m.ih);
  expect(m.sw, 'page width').toBeLessThanOrEqual(m.iw);
  expect(m.clipped, 'cards with clipped content').toBe(0);
}

/** Signs in on /staff with the E2E password; the cookie is shared by the page's context. */
export async function signInAsStaff(page: Page) {
  await page.goto('/staff');
  await page.fill('#password', E2E_STAFF_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Export leads to Excel' })).toBeVisible();
}

export async function staffLeadCount(page: Page): Promise<number> {
  const res = await page.request.get('/api/leads/count');
  expect(res.status()).toBe(200);
  return (await res.json()).count as number;
}
