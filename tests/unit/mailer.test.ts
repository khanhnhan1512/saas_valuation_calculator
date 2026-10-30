import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createResendMailer, mailerFromEnv, outcomeFor } from '@/lib/mailer';

const EMAIL = {
  to: 'jane@northwind.io',
  replyTo: 'leads@aspen.example',
  subject: 'Subject',
  html: '<p>Hi</p>',
  text: 'Hi',
};
const CONFIG = { apiKey: 're_test', from: 'Aspen <no-reply@aspen.example>', teamAddress: 'leads@aspen.example' };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('outcomeFor', () => {
  it.each([
    [200, 'sent'],
    [409, 'sent'], // idempotency key already used: the email already went out
    [400, 'rejected'],
    [422, 'rejected'],
    [401, 'retry'],
    [403, 'retry'],
    [429, 'retry'],
    [500, 'retry'],
    [503, 'retry'],
  ])('%i is %s', (status, outcome) => {
    expect(outcomeFor(status)).toBe(outcome);
  });
});

describe('Resend mailer', () => {
  it('posts the email to Resend with the idempotency key', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: 'email-1' }));
    const mailer = createResendMailer(CONFIG, fetchImpl as unknown as typeof fetch);

    expect(await mailer.send(EMAIL, 'lead-1-team')).toBe('sent');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_test', 'Idempotency-Key': 'lead-1-team' });
    expect(JSON.parse(init.body as string)).toEqual({
      from: CONFIG.from,
      to: EMAIL.to,
      reply_to: EMAIL.replyTo,
      subject: EMAIL.subject,
      html: EMAIL.html,
      text: EMAIL.text,
    });
  });

  it('sends attachments as base64', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: 'email-2' }));
    const mailer = createResendMailer(CONFIG, fetchImpl as unknown as typeof fetch);
    const file = { filename: 'leads.xlsx', content: new Uint8Array([1, 2, 3]) };

    expect(await mailer.send({ ...EMAIL, attachments: [file] }, 'daily-1')).toBe('sent');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).attachments).toEqual([{ filename: 'leads.xlsx', content: 'AQID' }]);
  });

  it('sends an inline image with its content_id', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: 'email-3' }));
    const mailer = createResendMailer(CONFIG, fetchImpl as unknown as typeof fetch);
    const logo = { filename: 'logo.png', content: new Uint8Array([1, 2, 3]), contentId: 'aspen-logo' };

    await mailer.send({ ...EMAIL, attachments: [logo] }, 'k');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).attachments).toEqual([
      { filename: 'logo.png', content: 'AQID', content_id: 'aspen-logo' },
    ]);
  });

  it('retries after a network error and reports a refused email', async () => {
    const offline = createResendMailer(CONFIG, (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch);
    expect(await offline.send(EMAIL, 'k')).toBe('retry');

    const refused = createResendMailer(CONFIG, (async () =>
      Response.json({ name: 'validation_error' }, { status: 422 })) as unknown as typeof fetch);
    expect(await refused.send(EMAIL, 'k')).toBe('rejected');
  });
});

describe('mailerFromEnv', () => {
  function setEnv(apiKey: string, from: string, team: string, vercel: string) {
    vi.stubEnv('RESEND_API_KEY', apiKey);
    vi.stubEnv('EMAIL_FROM', from);
    vi.stubEnv('EMAIL_TEAM_TO', team);
    vi.stubEnv('VERCEL', vercel);
  }

  it('is off without setup in local development', () => {
    setEnv('', '', '', '');
    expect(mailerFromEnv()).toBeNull();
  });

  it('on Vercel, a missing setup asks for a retry instead of skipping email', async () => {
    setEnv('re_test', '', 'leads@aspen.example', '1');
    expect(await mailerFromEnv()!.send(EMAIL, 'k')).toBe('retry');
  });

  it('uses Resend when all three variables are set', () => {
    setEnv('re_test', CONFIG.from, ' leads@aspen.example ', '1');
    expect(mailerFromEnv()?.teamAddress).toBe('leads@aspen.example');
  });

  function setSmtp(host: string, user: string, pass: string) {
    vi.stubEnv('SMTP_HOST', host);
    vi.stubEnv('SMTP_PORT', '1'); // nothing listens on port 1: the connection fails fast
    vi.stubEnv('SMTP_USER', user);
    vi.stubEnv('SMTP_PASS', pass);
  }

  it('uses SMTP instead of Resend when SMTP_HOST is set', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    setEnv('re_test', 'Aspen Valuations <demo@gmail.com>', 'leads@aspen.example', '1');
    setSmtp('127.0.0.1', 'demo@gmail.com', 'app-password');

    const mailer = mailerFromEnv();
    expect(mailer?.teamAddress).toBe('leads@aspen.example');
    expect(await mailer!.send(EMAIL, 'k')).toBe('retry'); // connection refused
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('an incomplete SMTP setup counts as not configured', async () => {
    setEnv('', 'Aspen Valuations <demo@gmail.com>', 'leads@aspen.example', '');
    setSmtp('smtp.gmail.com', 'demo@gmail.com', '');
    expect(mailerFromEnv()).toBeNull();

    vi.stubEnv('VERCEL', '1');
    expect(await mailerFromEnv()!.send(EMAIL, 'k')).toBe('retry');
  });
});
