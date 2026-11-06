import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@app/common/database/database.module';
import { SmsModule } from '@app/common/sms/sms.module';
import { Car, CarSchema } from '@app/common/schemas/car.schema';
import { DaySheet, DaySheetSchema } from '@app/common/schemas/daysheet.schema';
import { Invoice, InvoiceSchema } from '@app/common/schemas/invoice.schema';
import { Notification, NotificationSchema } from '@app/common/schemas/notification.schema';
import {
  Subscription,
  SubscriptionSchema,
  Wash,
  WashSchema,
} from '@app/common/schemas/subscription.schema';
import { User, UserSchema } from '@app/common/schemas/user.schema';
import { BatchController } from './batch.controller';
import { BillingJob } from './jobs/billing.job';
import { CloseOutJob } from './jobs/close-out.job';
import { WashReminderJob } from './jobs/wash-reminder.job';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SmsModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Wash.name, schema: WashSchema },
      { name: Car.name, schema: CarSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: DaySheet.name, schema: DaySheetSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  controllers: [BatchController],
  providers: [WashReminderJob, CloseOutJob, BillingJob],
})
export class BatchModule {}
