import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const WINDOW = 15 * 60_000;
const MAX_FAILURES = 5;
const MAX_TRACKED = 10_000;

export const TOO_MANY_PASSWORDS = 'Too many wrong passwords. Try again in 15 minutes or reset your password.';

/**
 * Wrong passwords per phone number: after 5 in 15 minutes the number is locked for 15 minutes,
 * whichever IP the guesses come from. Kept in memory (one API process); a restart clears it.
 */
@Injectable()
export class LoginAttempts {
  private readonly failures = new Map<string, { count: number; since: number }>();

  assertAllowed(phone: string, now = Date.now()): void {
    const entry = this.current(phone, now);
    if (entry && entry.count >= MAX_FAILURES) throw new HttpException(TOO_MANY_PASSWORDS, HttpStatus.TOO_MANY_REQUESTS);
  }

  failed(phone: string, now = Date.now()): void {
    const entry = this.current(phone, now);
    if (entry) entry.count++;
    else {
      if (this.failures.size >= MAX_TRACKED) this.prune(now);
      this.failures.set(phone, { count: 1, since: now });
    }
  }

  succeeded(phone: string): void {
    this.failures.delete(phone);
  }

  private current(phone: string, now: number) {
    const entry = this.failures.get(phone);
    if (entry && now - entry.since > WINDOW) {
      this.failures.delete(phone);
      return undefined;
    }
    return entry;
  }

  private prune(now: number) {
    for (const [phone, entry] of this.failures) if (now - entry.since > WINDOW) this.failures.delete(phone);
    // still full: drop the oldest entries rather than grow without limit
    for (const phone of this.failures.keys()) {
      if (this.failures.size < MAX_TRACKED) break;
      this.failures.delete(phone);
    }
  }
}
