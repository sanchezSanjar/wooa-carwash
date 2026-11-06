import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Car, CarSchema } from '@app/common/schemas/car.schema';
import { DaySheet, DaySheetSchema } from '@app/common/schemas/daysheet.schema';
import { Forecast, ForecastSchema } from '@app/common/schemas/forecast.schema';
import { Subscription, SubscriptionSchema, Wash, WashSchema } from '@app/common/schemas/subscription.schema';
import { User, UserSchema } from '@app/common/schemas/user.schema';
import { DaySheetsController } from './daysheets.controller';
import { DaySheetsXlsxService } from './daysheets-xlsx.service';
import { DaySheetsService } from './daysheets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DaySheet.name, schema: DaySheetSchema },
      { name: Forecast.name, schema: ForecastSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Wash.name, schema: WashSchema },
      { name: User.name, schema: UserSchema },
      { name: Car.name, schema: CarSchema },
    ]),
  ],
  controllers: [DaySheetsController],
  providers: [DaySheetsService, DaySheetsXlsxService],
})
export class DaySheetsModule {}
