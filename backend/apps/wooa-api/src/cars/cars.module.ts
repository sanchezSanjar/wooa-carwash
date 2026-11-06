import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CarsService } from './cars.service';
import { Car, CarSchema } from '@app/common/schemas/car.schema';

/** Car storage. The HTTP controller lives in SubscriptionsModule (it checks subscriptions). */
@Module({
  imports: [MongooseModule.forFeature([{ name: Car.name, schema: CarSchema }])],
  providers: [CarsService],
  exports: [CarsService, MongooseModule],
})
export class CarsModule {}
