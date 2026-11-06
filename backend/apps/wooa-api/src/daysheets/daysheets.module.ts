import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DaySheet, DaySheetSchema } from '@app/common/schemas/daysheet.schema';
import { Subscription, SubscriptionSchema, Wash, WashSchema } from '@app/common/schemas/subscription.schema';
import { User, UserSchema } from '@app/common/schemas/user.schema';
import { DaySheetsController } from './daysheets.controller';
import { DaySheetsService } from './daysheets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DaySheet.name, schema: DaySheetSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Wash.name, schema: WashSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DaySheetsController],
  providers: [DaySheetsService],
})
export class DaySheetsModule {}
