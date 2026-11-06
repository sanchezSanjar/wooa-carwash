import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { SolapiMessageService } from 'solapi';
import { normalizePhone } from '../phone';

export interface SentSms {
  to: string;
  text: string;
  logOnly: boolean;
}

/**
 * SMS through Solapi (https://solapi.com). Keys in .env:
 *   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_NUMBER (registered as a sender in Solapi)
 * Without keys it runs in log-only mode: the text goes to the server log instead of a phone,
 * so the app still works locally and in tests. Log-only sends are also kept in `outbox` for tests.
 */
@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger('SmsService');
  private client: SolapiMessageService | null = null;
  private sender = '';
  readonly outbox: SentSms[] = [];

  onModuleInit(): void {
    const { SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_NUMBER } = process.env;
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SOLAPI_SENDER_NUMBER) {
      this.logger.warn('Solapi keys are missing in .env: SMS runs in LOG-ONLY mode, nothing is sent');
      return;
    }
    this.client = new SolapiMessageService(SOLAPI_API_KEY, SOLAPI_API_SECRET);
    this.sender = normalizePhone(SOLAPI_SENDER_NUMBER);
  }

  get isLogOnly(): boolean {
    return this.client === null;
  }

  async send(to: string, text: string): Promise<SentSms> {
    const phone = normalizePhone(to);
    if (!this.client) {
      this.logger.log(`[LOG-ONLY] SMS to ${mask(phone)}: ${text}`);
      const sent = { to: phone, text, logOnly: true };
      this.outbox.push(sent);
      if (this.outbox.length > 200) this.outbox.shift();
      return sent;
    }
    try {
      const result = await this.client.send({ to: phone, from: this.sender, text });
      const failed = result.failedMessageList?.[0];
      if (failed) throw new Error(`${failed.statusCode} ${failed.statusMessage}`);
      this.logger.log(`SMS sent to ${mask(phone)}`);
      return { to: phone, text, logOnly: false };
    } catch (err) {
      this.logger.error(`SMS to ${mask(phone)} failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new ServiceUnavailableException('Could not send the SMS. Please try again.');
    }
  }
}

const mask = (phone: string) => `${phone.slice(0, 3)}****${phone.slice(-4)}`;
