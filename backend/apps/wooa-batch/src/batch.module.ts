import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@app/common/database/database.module';
import { Car, CarSchema } from '@app/common/schemas/car.schema';
import { Notification, NotificationSchema } from '@app/common/schemas/notification.schema';
import {
  Subscription,
  SubscriptionSchema,
  Wash,
  WashSchema,
} from '@app/common/schemas/subscription.schema';
import { User, UserSchema } from '@app/common/schemas/user.schema';
import { BatchController } from './batch.controller';
import { CloseOutJob } from './jobs/close-out.job';
import { WashReminderJob } from './jobs/wash-reminder.job';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Wash.name, schema: WashSchema },
      { name: Car.name, schema: CarSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [BatchController],
  providers: [WashReminderJob, CloseOutJob],
})
export class BatchModule {}
