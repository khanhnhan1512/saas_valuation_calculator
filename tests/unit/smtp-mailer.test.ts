import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSmtpMailer, smtpOutcomeFor, type SmtpTransport } from '@/lib/smtp-mailer';

const EMAIL = {
  to: 'jane@northwind.io',
  replyTo: 'leads@aspen.example',
  subject: 'Subject',
  html: '<p>Hi</p>',
  text: 'Hi',
};
const CONFIG = {
  host: 'smtp.gmail.com',
  port: 465,
  user: 'demo@gmail.com',
  pass: 'app-password',
  from: 'Aspen Valuations <demo@gmail.com>',
  teamAddress: 'leads@aspen.example',
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('smtpOutcomeFor', () => {
  it.each([
    ['bad address (5.1.3)', { code: 'EENVELOPE', responseCode: 553, response: '553 5.1.3 invalid address' }, 'rejected'],
    ['no valid recipient', { code: 'EENVELOPE' }, 'rejected'],
    ['Gmail daily limit', { code: 'EMESSAGE', responseCode: 550, response: '550 5.4.5 Daily user sending limit exceeded' }, 'retry'],
    ['wrong app password', { code: 'EAUTH', responseCode: 535, response: '535 5.7.8 Username and Password not accepted' }, 'retry'],
    ['timeout', { code: 'ETIMEDOUT' }, 'retry'],
    ['connection closed', { code: 'ECONNECTION' }, 'retry'],
    ['unknown error', null, 'retry'],
  ])('%s is %s', (_name, err, outcome) => {
    expect(smtpOutcomeFor(err)).toBe(outcome);
  });
});

describe('SMTP mailer', () => {
  it('sends the email with a fixed Message-ID per idempotency key', async () => {
    const sendMail = vi.fn(async () => ({ messageId: 'x' }));
    const mailer = createSmtpMailer(CONFIG, { sendMail });

    expect(await mailer.send(EMAIL, 'lead-1-team')).toBe('sent');
    expect(sendMail).toHaveBeenCalledWith({
      from: CONFIG.from,
      to: EMAIL.to,
      replyTo: EMAIL.replyTo,
      subject: EMAIL.subject,
      html: EMAIL.html,
      text: EMAIL.text,
      messageId: '<lead-1-team@saas-valuation-calculator>',
    });
    expect(mailer.teamAddress).toBe('leads@aspen.example');
  });

  it('maps a failed send to retry or rejected', async () => {
    const failing = (err: object): SmtpTransport => ({
      sendMail: async () => {
        throw Object.assign(new Error('smtp error'), err);
      },
    });
    expect(await createSmtpMailer(CONFIG, failing({ code: 'EAUTH', responseCode: 535 })).send(EMAIL, 'k')).toBe('retry');
    expect(
      await createSmtpMailer(CONFIG, failing({ code: 'EENVELOPE', responseCode: 553, response: '553 5.1.3 bad' })).send(EMAIL, 'k'),
    ).toBe('rejected');
  });
});
