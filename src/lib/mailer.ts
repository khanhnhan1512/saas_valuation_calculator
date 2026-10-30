// Sends email through the Resend API (POST /emails), or over SMTP when SMTP_HOST is set (see
// smtp-mailer.ts). Without a setup, email is off in local development and tests.
import { EMAIL_TIMEOUT_MS } from '@/config/valuation-config';
import type { OutgoingEmail } from './lead-emails';
import { createSmtpMailer } from './smtp-mailer';

const RESEND_URL = 'https://api.resend.com/emails';

/** sent: accepted. rejected: Resend will never accept it. retry: try again later. */
export type SendOutcome = 'sent' | 'rejected' | 'retry';

export interface Mailer {
  /** Shared company inbox: receives every lead and the visitors' replies. */
  teamAddress: string;
  send(email: OutgoingEmail, idempotencyKey: string): Promise<SendOutcome>;
}

export interface ResendConfig {
  apiKey: string;
  from: string;
  teamAddress: string;
}

/**
 * 409: this idempotency key was already used, so the email is already sent or on its way.
 * 400/422: Resend will never accept this email (e.g. a malformed address); retrying cannot help.
 * Everything else (401/403 setup problems, 429 quota, 5xx) can be fixed or will pass, so retry.
 */
export function outcomeFor(status: number): SendOutcome {
  if ((status >= 200 && status < 300) || status === 409) return 'sent';
  if (status === 400 || status === 422) return 'rejected';
  return 'retry';
}

export function createResendMailer(config: ResendConfig, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    teamAddress: config.teamAddress,
    async send(email, idempotencyKey) {
      try {
        const res = await fetchImpl(RESEND_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            // Resend sends a repeated key only once (24 h), so a retry after a lost response never duplicates.
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            from: config.from,
            to: email.to,
            reply_to: email.replyTo,
            subject: email.subject,
            html: email.html,
            text: email.text,
            attachments: email.attachments?.map((a) => ({
              filename: a.filename,
              content: Buffer.from(a.content).toString('base64'),
            })),
          }),
          signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
        });
        const outcome = outcomeFor(res.status);
        if (outcome !== 'sent') {
          // Log the error name only; Resend's message can contain the address (personal information).
          const body = (await res.json().catch(() => null)) as { name?: unknown } | null;
          console.error(`email not sent: ${res.status} ${typeof body?.name === 'string' ? body.name : ''}`.trim());
        }
        return outcome;
      } catch (err) {
        console.error('email not sent:', err instanceof Error ? err.name : 'unknown');
        return 'retry';
      }
    },
  };
}

/** Used on Vercel when email is not set up: a missing setup must not pass silently. */
const notConfigured: Mailer = {
  teamAddress: '',
  async send() {
    console.error(
      'email is not configured: set EMAIL_FROM, EMAIL_TEAM_TO and RESEND_API_KEY (or SMTP_HOST, SMTP_USER, SMTP_PASS)',
    );
    return 'retry';
  },
};

const env = (name: string) => process.env[name]?.trim() ?? '';

/**
 * SMTP when SMTP_HOST is set (e.g. Gmail for a demo), otherwise Resend. Null (email off) in local
 * development and tests. On Vercel a missing setup returns "retry", so leads stay stored and queued.
 */
export function mailerFromEnv(): Mailer | null {
  const from = env('EMAIL_FROM');
  const teamAddress = env('EMAIL_TEAM_TO');
  if (from && teamAddress) {
    if (env('SMTP_HOST')) {
      const [host, user, pass] = [env('SMTP_HOST'), env('SMTP_USER'), env('SMTP_PASS')];
      const port = Number(env('SMTP_PORT')) || 465;
      if (user && pass) return createSmtpMailer({ host, port, user, pass, from, teamAddress });
    } else if (env('RESEND_API_KEY')) {
      return createResendMailer({ apiKey: env('RESEND_API_KEY'), from, teamAddress });
    }
  }
  return process.env.VERCEL ? notConfigured : null;
}
