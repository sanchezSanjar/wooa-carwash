import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';

/** One SmsService per app (global), so the log-only outbox is shared. */
@Global()
@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
