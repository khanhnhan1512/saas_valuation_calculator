import { expect, test } from '@playwright/test';
import { JANE, errorLine, fillLead, headline, submitButton } from './helpers';

test.describe('calculator flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows each validation message in the spec order', async ({ page }) => {
    const steps: Array<[() => Promise<void>, string]> = [
      [async () => {}, 'Please enter your ARR in step 1.'],
      [() => page.fill('#arr', '4000000'), 'Please choose your software category or industry in step 1.'],
      [
        async () => {
          await page.selectOption('#selection', 'Healthcare');
        },
        'Please fill in your first name, last name, company, email and phone number.',
      ],
      [
        () => fillLead(page, { ...JANE, arr: '', selection: '', email: 'jane@northwind', phone: '', nextMove: '' }),
        'Please fill in your first name, last name, company, email and phone number.',
      ],
      [() => page.fill('#lead-phone', '647451'), 'Please check your email address.'],
      [() => page.fill('#lead-email', 'jane@northwind.io'), 'Please enter a 10 digit phone number.'],
      [() => page.fill('#lead-phone', '6474515164'), 'Please choose your next move.'],
    ];
    for (const [act, message] of steps) {
      await act();
      await submitButton(page).click();
      await expect(errorLine(page)).toHaveText(message);
    }
    await expect(page.locator('#result')).toContainText('Your value range is ready to generate');
  });

  test('"Other" needs its text box', async ({ page }) => {
    await fillLead(page, { ...JANE, nextMove: 'Other' });
    await submitButton(page).click();
    await expect(errorLine(page)).toHaveText('Please choose your next move.');
    await page.getByRole('textbox', { name: 'Your next move' }).fill('IPO prep');
    await submitButton(page).click();
    await expect(errorLine(page)).toHaveText('');
    await expect(headline(page)).toHaveText('$7.8M to $10.5M');
  });

  test('formats ARR and phone as typed, and syncs the slider and chips', async ({ page }) => {
    await page.locator('#arr').pressSequentially('4000000');
    await expect(page.locator('#arr')).toHaveValue('4,000,000');
    await page.locator('#lead-phone').pressSequentially('16474515164');
    await expect(page.locator('#lead-phone')).toHaveValue('(647) 451-5164');

    await page.getByRole('button', { name: '$10M', exact: true }).click();
    await expect(page.locator('#arr')).toHaveValue('10,000,000');
    await expect(page.getByRole('button', { name: '$10M', exact: true })).toHaveAttribute('aria-pressed', 'true');

    const slider = page.getByRole('slider', { name: 'ARR slider' });
    await slider.fill('0');
    await expect(page.locator('#arr')).toHaveValue('250,000');
    await slider.fill('1000');
    await expect(page.locator('#arr')).toHaveValue('50,000,000');

    await page.fill('#arr', '99999999999');
    await expect(page.locator('#arr')).toHaveValue('5,000,000,000');
  });

  test('Healthcare $4M unlocks the spec result, then Next visitor resets', async ({ page }) => {
    await fillLead(page);
    await submitButton(page).click();

    const result = page.locator('#result');
    await expect(headline(page)).toHaveText('$7.8M to $10.5M');
    await expect(result).toContainText('based on your category, size and industry, at 1.95x to 2.63x ARR');
    await expect(result).toContainText('lower · 1.95x');
    await expect(result).toContainText('midpoint · 2.29x');
    await expect(result).toContainText('higher · 2.63x');
    await expect(result).toContainText('$9.2M');
    await expect(result).toContainText('1.6x');
    await expect(result).toContainText('2.9x');
    await expect(submitButton(page)).toHaveText('Multiple generated');
    await expect(submitButton(page)).toBeDisabled();
    await expect(page.locator('#arr')).toBeDisabled();

    await page.getByRole('button', { name: /Next visitor/ }).click();
    await expect(result).toContainText('Your value range is ready to generate');
    await expect(page.locator('#arr')).toHaveValue('');
    await expect(page.locator('#selection')).toHaveValue('');
    await expect(page.locator('#lead-firstName')).toHaveValue('');
    await expect(submitButton(page)).toHaveText('Generate my ARR multiple');
    await expect(submitButton(page)).toBeEnabled();
  });

  test('Sales & Marketing $4M matches the second worked example', async ({ page }) => {
    await fillLead(page, { ...JANE, selection: 'Sales & Marketing' });
    await submitButton(page).click();
    await expect(headline(page)).toHaveText('$4.6M to $6.2M');
    await expect(page.locator('#result')).toContainText('midpoint · 1.35x');
    await expect(page.locator('#result')).toContainText('$5.4M');
  });

  test('locked result never contains the visitor numbers', async ({ page }) => {
    await fillLead(page);
    await expect(page.locator('#result')).not.toContainText('$7.8M');
  });

  test('the dropdown lists 11 industries, then 9 categories', async ({ page }) => {
    const options = await page.locator('#selection option').allTextContents();
    expect(options).toHaveLength(21);
    expect(options[0]).toBe('Choose a category');
    expect(options.slice(1, 4)).toEqual(['Healthcare', 'Financial Services', 'Real Estate']);
    expect(options[11]).toBe('Other industry');
    expect(options[12]).toBe('DevOps & IT Management');
    expect(options[20]).toBe('Other SaaS');
  });

  test('every field has autofill turned off', async ({ page }) => {
    const missing = await page
      .locator('#arr, #selection, input[id^="lead-"]')
      .evaluateAll((els) => els.filter((el) => el.getAttribute('autocomplete') !== 'off').length);
    expect(missing).toBe(0);
  });
});
