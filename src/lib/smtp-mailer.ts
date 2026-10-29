// Sends email over SMTP with nodemailer, e.g. through a Gmail account and an app password for a
// demo before the company domain is verified in Resend. mailerFromEnv() picks it when SMTP_HOST is set.
import nodemailer, { type SendMailOptions } from 'nodemailer';
import { EMAIL_TIMEOUT_MS } from '@/config/valuation-config';
import type { Mailer, SendOutcome } from './mailer';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  teamAddress: string;
}

/** The one transport method this module uses; tests pass a fake. */
export interface SmtpTransport {
  sendMail(message: SendMailOptions): Promise<unknown>;
}

type SmtpError = Partial<{ code: string; responseCode: number; response: string }>;

/**
 * Rejected for good only when the address itself is bad: an SMTP 5.1.x answer (e.g. 5.1.3 invalid
 * address) or nodemailer refusing the envelope before sending. Everything else (login, quota such as
 * Gmail's 550 5.4.5 daily limit, timeouts, network) can pass later, so retry.
 */
export function smtpOutcomeFor(err: unknown): SendOutcome {
  const { code, responseCode, response } = (err ?? {}) as SmtpError;
  if (typeof response === 'string' && /\b5\.1\.\d+\b/.test(response)) return 'rejected';
  if (code === 'EENVELOPE' && responseCode == null) return 'rejected';
  return 'retry';
}

export function createSmtpMailer(config: SmtpConfig, transport?: SmtpTransport): Mailer {
  const smtp =
    transport ??
    nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // 465: TLS from the start; 587: STARTTLS
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: EMAIL_TIMEOUT_MS,
      greetingTimeout: EMAIL_TIMEOUT_MS,
      socketTimeout: EMAIL_TIMEOUT_MS,
    });

  return {
    teamAddress: config.teamAddress,
    async send(email, idempotencyKey) {
      try {
        await smtp.sendMail({
          from: config.from,
          to: email.to,
          replyTo: email.replyTo,
          subject: email.subject,
          html: email.html,
          text: email.text,
          // SMTP has no idempotency key. A fixed Message-ID per lead and email lets mail services
          // that dedupe by Message-ID drop a rare repeat sent after a lost response.
          messageId: `<${idempotencyKey}@saas-valuation-calculator>`,
        });
        return 'sent';
      } catch (err) {
        // Log the SMTP code only; the server's message can contain the address (personal information).
        const { code, responseCode } = (err ?? {}) as SmtpError;
        console.error(`email not sent (smtp): ${responseCode ?? code ?? 'unknown'}`);
        return smtpOutcomeFor(err);
      }
    },
  };
}
