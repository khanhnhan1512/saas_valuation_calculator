// Sends email through the Resend API (POST /emails). Configured by RESEND_API_KEY, EMAIL_FROM
// and EMAIL_TEAM_TO; without them email is off in local development and tests.
import { EMAIL_TIMEOUT_MS } from '@/config/valuation-config';
import type { OutgoingEmail } from './lead-emails';

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
    console.error('email is not configured: set RESEND_API_KEY, EMAIL_FROM and EMAIL_TEAM_TO');
    return 'retry';
  },
};

/**
 * The Resend mailer from env, or null (email off) in local development and tests.
 * On Vercel a missing setup returns "retry", so leads stay stored and queued until it is fixed.
 */
export function mailerFromEnv(): Mailer | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const teamAddress = process.env.EMAIL_TEAM_TO?.trim();
  if (apiKey && from && teamAddress) return createResendMailer({ apiKey, from, teamAddress });
  return process.env.VERCEL ? notConfigured : null;
}
